export interface OutboxCandidate {
  processedAt: string | null;
  availableAt: string;
}

export interface OutboxRow extends OutboxCandidate {
  id: string;
  topic: string;
  payload: unknown;
  attempts: number;
}

export interface OutboxQueryClient {
  query(text: string, values?: unknown[]): Promise<unknown>;
}

export function isReadyForHandling(event: OutboxCandidate, at = new Date()): boolean {
  return event.processedAt === null && new Date(event.availableAt).getTime() <= at.getTime();
}

export async function processOutboxRows(client: OutboxQueryClient, rows: readonly OutboxRow[]) {
  for (const row of rows) {
    if (row.topic === "audit.recorded") {
      await client.query(
        "UPDATE outbox_events SET processed_at = now() WHERE id = $1 AND processed_at IS NULL",
        [row.id],
      );
      continue;
    }
    await client.query(
      "UPDATE outbox_events SET attempts = attempts + 1, available_at = now() + interval '60 seconds' WHERE id = $1 AND processed_at IS NULL",
      [row.id],
    );
  }
}
