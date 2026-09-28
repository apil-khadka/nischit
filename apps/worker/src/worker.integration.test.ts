import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { drainOutboxOnce } from "./worker.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgreSQL outbox worker integration", () => {
  it("locks, processes, and commits known/unknown events atomically", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const tenantId = `worker-test-${Date.now()}`;
    const eventId = randomUUID();
    const retryId = randomUUID();
    try {
      // The API integration suite may have left older ready events in the shared
      // test database. Keep this fixture isolated so the worker's batch limit
      // cannot hide either event under test.
      await pool.query("DELETE FROM outbox_events");
      await pool.query("INSERT INTO tenants (id, name) VALUES ($1, $2)", [tenantId, "Worker test tenant"]);
      await pool.query(
        "INSERT INTO outbox_events (id, tenant_id, topic, payload) VALUES ($1, $2, 'audit.recorded', '{}'::jsonb), ($3, $2, 'tempo.submit', '{}'::jsonb)",
        [eventId, tenantId, retryId],
      );

      await expect(drainOutboxOnce(pool)).resolves.toBeGreaterThanOrEqual(2);
      const result = await pool.query<{ id: string; processed_at: Date | null; attempts: number }>(
        "SELECT id, processed_at, attempts FROM outbox_events WHERE id IN ($1, $2) ORDER BY id",
        [eventId, retryId],
      );
      expect(result.rows).toHaveLength(2);
      expect(result.rows.find((row) => row.id === eventId)).toEqual(
        expect.objectContaining({ id: eventId, processed_at: expect.any(Date), attempts: 0 }),
      );
      expect(result.rows.find((row) => row.id === retryId)).toEqual(
        expect.objectContaining({ id: retryId, processed_at: null, attempts: 1 }),
      );
    } finally {
      await pool.query("DELETE FROM outbox_events WHERE id IN ($1, $2)", [eventId, retryId]);
      await pool.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
      await pool.end();
    }
  });
});
