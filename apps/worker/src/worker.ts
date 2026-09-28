import { processOutboxRows, type OutboxRow, type OutboxQueryClient } from "./outbox.js";

export interface OutboxDatabase {
  connect(): Promise<OutboxDatabaseClient>;
}

export interface OutboxDatabaseClient extends OutboxQueryClient {
  release(): void;
}

interface RowResult {
  rows: OutboxRow[];
}

interface TenantResult {
  rows: Array<{ id: string }>;
}

/**
 * Execute one transactional outbox drain. The worker is deliberately at-least-once:
 * claiming and acknowledgement happen in the same transaction, and every handler
 * must be idempotent before a real external side effect is enabled.
 */
export async function drainOutboxOnce(pool: OutboxDatabase): Promise<number> {
  const client = await pool.connect();
  try {
    const tenants = await client.query("SELECT id FROM tenants ORDER BY id") as TenantResult;
    let drained = 0;
    for (const tenant of tenants.rows) {
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenant.id]);
        const result = await client.query(
          "SELECT id, topic, payload, attempts, processed_at AS \"processedAt\", available_at AS \"availableAt\" FROM outbox_events WHERE processed_at IS NULL AND available_at <= now() ORDER BY created_at LIMIT 10 FOR UPDATE SKIP LOCKED",
        ) as RowResult;
        await processOutboxRows(client, result.rows);
        await client.query("COMMIT");
        drained += result.rows.length;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return drained;
  } finally {
    client.release();
  }
}
