import { describe, expect, it } from "vitest";
import { isReadyForHandling, processOutboxRows } from "./outbox.js";

describe("outbox release contract", () => {
  it("only treats unprocessed events whose availability time has arrived as ready", () => {
    const at = new Date("2026-09-18T10:00:00.000Z");
    expect(isReadyForHandling({ processedAt: null, availableAt: "2026-09-18T09:59:59.000Z" }, at)).toBe(true);
    expect(isReadyForHandling({ processedAt: null, availableAt: "2026-09-18T10:00:01.000Z" }, at)).toBe(false);
    expect(isReadyForHandling({ processedAt: "2026-09-18T09:59:59.000Z", availableAt: "2026-09-18T09:00:00.000Z" }, at)).toBe(false);
  });
});

describe("outbox handling", () => {
  it("acknowledges known audit events and leaves unknown work retryable", async () => {
    const queries: Array<{ text: string; values?: unknown[] }> = [];
    const client = { query: async (text: string, values?: unknown[]) => { queries.push({ text, values }); } };
    await processOutboxRows(client, [
      { id: "audit-1", topic: "audit.recorded", payload: {}, attempts: 0, processedAt: null, availableAt: "2026-09-18T10:00:00.000Z" },
      { id: "chain-1", topic: "tempo.submit", payload: {}, attempts: 1, processedAt: null, availableAt: "2026-09-18T10:00:00.000Z" },
    ]);
    expect(queries[0]).toMatchObject({ values: ["audit-1"] });
    expect(queries[0]!.text).toContain("processed_at = now()");
    expect(queries[1]).toMatchObject({ values: ["chain-1"] });
    expect(queries[1]!.text).toContain("attempts = attempts + 1");
  });
});
