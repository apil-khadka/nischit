import { describe, expect, it } from "vitest";
import { auditEventsToOutbox, decodeSnapshot, encodeSnapshot } from "./persistence.js";

describe("PostgreSQL snapshot encoding", () => {
  it("round-trips bigint token amounts without JSON precision loss", () => {
    const snapshot = {
      tenants: [],
      memberships: [],
      grants: [],
      products: [],
      purchaseOrders: [{
        id: "po",
        tenantId: "t",
        supplierTenantId: "s",
        productId: "p",
        quantity: 1,
        unit: "kit",
        amountBaseUnits: 90071992547409931234567890n,
        token: "TEST",
        settlementReference: "nsc_ref",
        policy: {
          version: 1,
          productId: "p",
          minQuantity: 1,
          maxQuantity: 1,
          minShelfLifeDays: 1,
          minTemperatureCelsius: 2,
          maxTemperatureCelsius: 8,
          requiredDocuments: [],
          allowAdjustmentBps: true,
        },
        termsHash: "hash",
        termsNonce: "nonce",
        status: "draft",
        createdAt: "2026-09-18T00:00:00.000Z",
      }],
      lots: [],
      shipments: [],
      conditionReports: [],
      receipts: [],
      inventoryEvents: [],
      holdings: [],
      qaDecisions: [],
      settlements: [],
      recalls: [],
      audit: [],
      idempotency: {},
    } as never;
    const restored = decodeSnapshot(encodeSnapshot(snapshot));
    expect(restored.purchaseOrders[0]!.amountBaseUnits).toBe(90071992547409931234567890n);
  });
});

describe("transactional outbox envelope", () => {
  it("emits only audit events created after the last persisted command", () => {
    const audit = [
      { id: "audit-1", tenantId: "tenant-a", actorId: "user-a", action: "old", resourceType: "po", resourceId: "po-1", createdAt: "2026-09-18T00:00:00.000Z", metadata: {} },
      { id: "audit-2", tenantId: "tenant-a", actorId: "user-a", action: "new", resourceType: "po", resourceId: "po-1", createdAt: "2026-09-18T00:01:00.000Z", metadata: { status: "funded" } },
    ] as const;
    expect(auditEventsToOutbox(audit, 1)).toEqual([{
      id: "audit-2",
      tenantId: "tenant-a",
      topic: "audit.recorded",
      payload: audit[1],
    }]);
  });
});
