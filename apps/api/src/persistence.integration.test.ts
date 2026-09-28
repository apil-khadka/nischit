import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { MockPaymentRail, MockPublicAttestationRail, NischitEngine, type EngineSnapshot } from "@nischit/domain";
import { auditEventsToOutbox, PostgresStateStore } from "./persistence.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgreSQL persistence integration", () => {
  it("applies the migration and persists tenants, audit, snapshot, and outbox atomically", async () => {
    const setupPool = new Pool({ connectionString: databaseUrl });
    const migration = await readFile(new URL("../../../db/migrations/0001_initial.sql", import.meta.url), "utf8");
    await setupPool.query(migration);
    await setupPool.query("TRUNCATE verification_signatures, nischit_idempotency, recalls, settlements, qa_decisions, inventory_holdings, inventory_events, goods_receipts, condition_reports, shipments, lots, purchase_orders, products, collaboration_grants, outbox_events, audit_events, memberships, tenants, nischit_engine_state, nischit_persistence_meta CASCADE");

    const audit = {
      id: "11111111-1111-4111-8111-111111111111",
      tenantId: "tenant-integration",
      actorId: "user-integration",
      action: "purchase_order.created",
      resourceType: "purchase_order",
      resourceId: "po-integration",
      createdAt: "2026-09-18T00:00:00.000Z",
      metadata: { status: "draft" },
    } as const;
    const snapshot = {
      tenants: [{ id: "tenant-integration", name: "Integration Laboratory", createdAt: audit.createdAt }],
      memberships: [{ tenantId: audit.tenantId, userId: audit.actorId, displayName: "Integration User", roles: ["owner"] }],
      grants: [], products: [], purchaseOrders: [], lots: [], shipments: [], conditionReports: [], receipts: [],
      inventoryEvents: [], holdings: [], qaDecisions: [], settlements: [], recalls: [], audit: [audit],
      idempotency: {}, verificationSignatures: {},
    } as unknown as EngineSnapshot;
    const store = new PostgresStateStore(databaseUrl!);
    await store.save(snapshot, [{ id: audit.id, tenantId: audit.tenantId, topic: "audit.recorded", payload: audit }]);
    const restored = await store.load();
    const outbox = await setupPool.query<{ count: string }>("SELECT count(*)::text AS count FROM outbox_events WHERE tenant_id = $1", [audit.tenantId]);

    expect(restored?.tenants[0]?.id).toBe("tenant-integration");
    expect(restored?.memberships[0]?.displayName).toBe("Integration User");
    expect(restored?.audit[0]?.action).toBe("purchase_order.created");
    expect(outbox.rows[0]?.count).toBe("1");

    const normalized = await setupPool.query<{ count: string }>("SELECT count(*)::text AS count FROM nischit_persistence_meta WHERE id = 'normalized-v1'");
    expect(normalized.rows[0]?.count).toBe("1");

    await store.close();
    await setupPool.end();
  });

  it("round-trips the procurement, condition, receipt, QA, inventory, and settlement aggregates without the singleton snapshot", async () => {
    const setupPool = new Pool({ connectionString: databaseUrl });
    const migration = await readFile(new URL("../../../db/migrations/0001_initial.sql", import.meta.url), "utf8");
    await setupPool.query(migration);
    await setupPool.query("TRUNCATE verification_signatures, nischit_idempotency, recalls, settlements, qa_decisions, inventory_holdings, inventory_events, goods_receipts, condition_reports, shipments, lots, purchase_orders, products, collaboration_grants, outbox_events, audit_events, memberships, tenants, nischit_engine_state, nischit_persistence_meta CASCADE");
    const payment = new MockPaymentRail();
    const engine = new NischitEngine(payment, new MockPublicAttestationRail());
    const buyer = engine.createTenant({ id: "normalized-buyer", name: "Normalized Laboratory", ownerUserId: "normalized-owner" });
    const supplier = engine.createTenant({ id: "normalized-supplier", name: "Normalized Supplier", ownerUserId: "normalized-supplier-owner" });
    engine.addMembership({ tenantId: buyer.id, userId: "normalized-finance", displayName: "Normalized Finance", roles: ["finance"] });
    engine.addMembership({ tenantId: buyer.id, userId: "normalized-receiver", displayName: "Normalized Receiver", roles: ["receiving"] });
    engine.addMembership({ tenantId: buyer.id, userId: "normalized-qa", displayName: "Normalized QA", roles: ["qa"] });
    engine.addMembership({ tenantId: supplier.id, userId: "normalized-supplier-manager", displayName: "Normalized Supplier Manager", roles: ["supplier"] });
    const owner = engine.actor(buyer.id, "normalized-owner");
    const finance = engine.actor(buyer.id, "normalized-finance");
    const receiver = engine.actor(buyer.id, "normalized-receiver");
    const qa = engine.actor(buyer.id, "normalized-qa");
    const supplierManager = engine.actor(supplier.id, "normalized-supplier-manager");
    const product = engine.createProduct(owner, {
      name: "Normalized reagent", manufacturer: "Nischit", baseUnit: "kit", storageMinCelsius: 2,
      storageMaxCelsius: 8, minimumShelfLifeDays: 30, requiredDocuments: ["coa"],
    });
    const po = engine.createPurchaseOrder(owner, {
      supplierTenantId: supplier.id, productId: product.id, quantity: 20, amountBaseUnits: "100000", token: "TEST_USD",
    });
    engine.createCollaborationGrant(owner, { receivingTenantId: supplier.id, purchaseOrderId: po.id, actions: ["view", "acknowledge", "submit_evidence", "respond"] });
    await engine.acknowledgePurchaseOrder(supplierManager, po.id);
    await engine.fundPurchaseOrder(finance, po.id);
    const declared = engine.declareShipment(supplierManager, {
      purchaseOrderId: po.id, manufacturerLotNumber: "NORM-1", expiryDate: new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10), quantity: 20,
    });
    engine.submitConditionEvidence(supplierManager, {
      shipmentId: declared.shipment.id,
      readings: [{ sequence: 1, timestamp: "2026-01-01T00:00:00.000Z", temperatureCelsius: 4 }],
      documents: [{ name: "coa", sha256: "c".repeat(64), objectId: "coa-1", contentType: "application/pdf" }],
    });
    const receipt = engine.receiveShipment(receiver, { shipmentId: declared.shipment.id, receivedQuantity: 20, siteId: "central" });
    engine.decideQA(qa, { receiptId: receipt.id, status: "accepted_with_adjustment", adjustmentBps: 500, reason: "Recorded exception", siteId: "central" });
    const lotId = declared.lot.id;
    engine.transferInventory(qa, { lotId, fromSiteId: "central", toSiteId: "branch", quantity: 5, unit: "kit", sourceId: "normalized-transfer" });

    const store = new PostgresStateStore(databaseUrl!);
    await store.save(engine.snapshot(), auditEventsToOutbox(engine.snapshot().audit, 0));
    const restored = await store.load();
    expect(restored?.purchaseOrders[0]?.amountBaseUnits).toBe(100000n);
    expect(restored?.conditionReports[0]?.telemetryMerkleRoot).toMatch(/^[a-f0-9]{64}$/);
    expect(restored?.conditionReports[0]?.documents[0]?.objectId).toBe("coa-1");
    expect(restored?.tenantSettings.find((settings) => settings.tenantId === buyer.id)?.timezone).toBe("UTC");
    expect(restored?.receipts[0]).toMatchObject({ siteId: "central", acceptedQuantity: 20, rejectedQuantity: 0 });
    expect(restored?.holdings).toEqual(expect.arrayContaining([
      expect.objectContaining({ siteId: "central", onHand: 15 }),
      expect.objectContaining({ siteId: "branch", onHand: 5 }),
    ]));
    expect(restored?.settlements[0]).toMatchObject({ supplierAmountBaseUnits: 95000n, buyerCreditBaseUnits: 5000n });
    const singleton = await setupPool.query<{ count: string }>("SELECT count(*)::text AS count FROM nischit_engine_state");
    expect(singleton.rows[0]?.count).toBe("0");
    await store.close();
    await setupPool.end();
  });
});
