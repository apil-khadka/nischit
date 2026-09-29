import { describe, expect, it } from "vitest";
import { NischitEngine } from "./engine.js";
import { DomainError, MockPaymentRail, MockPublicAttestationRail } from "./index.js";
import type { AcceptancePolicy } from "./types.js";

function setup(policy: Partial<AcceptancePolicy> = {}) {
  const payment = new MockPaymentRail();
  const attestation = new MockPublicAttestationRail();
  const engine = new NischitEngine(payment, attestation);
  const buyer = engine.createTenant({ id: "tenant-buyer", name: "Preview Laboratory", ownerUserId: "buyer-owner" });
  const supplier = engine.createTenant({ id: "tenant-supplier", name: "Preview Reagents", ownerUserId: "supplier-owner" });
  engine.addMembership({ tenantId: buyer.id, userId: "buyer-finance", displayName: "Finance", roles: ["finance"] });
  engine.addMembership({ tenantId: buyer.id, userId: "buyer-receiver", displayName: "Receiving", roles: ["receiving"] });
  engine.addMembership({ tenantId: buyer.id, userId: "buyer-qa", displayName: "QA", roles: ["qa"] });
  engine.addMembership({ tenantId: supplier.id, userId: "supplier-manager", displayName: "Supplier", roles: ["supplier"] });
  const buyerOwner = engine.actor(buyer.id, "buyer-owner");
  const finance = engine.actor(buyer.id, "buyer-finance");
  const receiver = engine.actor(buyer.id, "buyer-receiver");
  const qa = engine.actor(buyer.id, "buyer-qa");
  const supplierManager = engine.actor(supplier.id, "supplier-manager");
  const product = engine.createProduct(buyerOwner, {
    name: "HbA1c reagent kit",
    manufacturer: "Nischit Diagnostics",
    baseUnit: "kit",
    storageMinCelsius: 2,
    storageMaxCelsius: 8,
    minimumShelfLifeDays: 30,
    requiredDocuments: ["invoice", "coa"],
  });
  const po = engine.createPurchaseOrder(buyerOwner, {
    supplierTenantId: supplier.id,
    productId: product.id,
    quantity: 20,
    amountBaseUnits: "100000",
    token: "TEST_USD",
    policy: { maxTelemetryGapSeconds: 300, ...policy },
  });
  engine.createCollaborationGrant(buyerOwner, {
    receivingTenantId: supplier.id,
    purchaseOrderId: po.id,
    actions: ["view", "acknowledge", "submit_evidence", "respond"],
  });
  return { engine, payment, attestation, buyer, supplier, buyerOwner, finance, receiver, qa, supplierManager, po, product };
}

async function fundedShipment(policy: Partial<AcceptancePolicy> = {}) {
  const context = setup(policy);
  await context.engine.acknowledgePurchaseOrder(context.supplierManager, context.po.id, "ack-1");
  await context.engine.fundPurchaseOrder(context.finance, context.po.id, "fund-1");
  const declared = context.engine.declareShipment(context.supplierManager, {
    purchaseOrderId: context.po.id,
    manufacturerLotNumber: "HBA-09183",
    expiryDate: new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10),
    quantity: 20,
  });
  return { ...context, ...declared };
}

describe("Nischit domain workflow", () => {
  it("requires supplier acknowledgement before funding and keeps business identifiers off the public memo", async () => {
    const { engine, finance, po } = setup();
    await expect(engine.fundPurchaseOrder(finance, po.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(po.settlementReference).toMatch(/^nsc_[a-z0-9]+$/);
    expect(po.settlementReference).not.toContain(po.id);
  });

  it("evaluates missing evidence as insufficient instead of silently passing", async () => {
    const { engine, supplierManager, shipment } = await fundedShipment();
    const report = engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [],
      documents: [],
    });
    expect(report.status).toBe("insufficient_evidence");
  });

  it("does not pass malformed or duplicate telemetry sequences", async () => {
    const { engine, supplierManager, shipment } = await fundedShipment();
    const report = engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [
        { sequence: 1, timestamp: new Date().toISOString(), temperatureCelsius: 4 },
        { sequence: 1, timestamp: new Date().toISOString(), temperatureCelsius: 4 },
      ],
      documents: [
        { name: "invoice", sha256: "invoice-hash" },
        { name: "coa", sha256: "coa-hash" },
      ],
    });
    expect(report.status).toBe("insufficient_evidence");
  });

  it("does not pass non-finite temperatures or a shipment window without sufficient telemetry", async () => {
    const { engine, supplierManager, receiver, shipment } = await fundedShipment();
    const report = engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [
        { sequence: 1, timestamp: shipment.dispatchedAt, temperatureCelsius: Number.NaN },
        { sequence: 2, timestamp: new Date().toISOString(), temperatureCelsius: 4 },
      ],
      documents: [
        { name: "invoice", sha256: "invoice-hash" },
        { name: "coa", sha256: "coa-hash" },
      ],
    });
    expect(report.status).toBe("insufficient_evidence");
    engine.receiveShipment(receiver, { shipmentId: shipment.id, receivedQuantity: 20, siteId: "central" });
    expect(report.status).toBe("insufficient_evidence");
  });

  it("marks evidence pass only after two valid readings cover dispatch through receipt", async () => {
    const { engine, supplierManager, receiver, shipment } = await fundedShipment();
    const report = engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [
        { sequence: 1, timestamp: shipment.dispatchedAt, temperatureCelsius: 4 },
        { sequence: 2, timestamp: new Date().toISOString(), temperatureCelsius: 5 },
      ],
      documents: [
        { name: "invoice", sha256: "invoice-hash" },
        { name: "coa", sha256: "coa-hash" },
      ],
    });
    expect(report.status).toBe("insufficient_evidence");
    engine.receiveShipment(receiver, { shipmentId: shipment.id, receivedQuantity: 20, siteId: "central" });
    expect(report.status).toBe("pass");
    expect(report.coverageComplete).toBe(true);
  });

  it("does not pass a claimed signed telemetry chain with a broken predecessor hash", async () => {
    const { engine, supplierManager, shipment } = await fundedShipment();
    const report = engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [
        { sequence: 1, timestamp: "2026-01-01T00:00:00.000Z", temperatureCelsius: 4, deviceId: "logger-1", signature: "sig-1" },
        { sequence: 2, timestamp: "2026-01-01T00:01:00.000Z", temperatureCelsius: 4, deviceId: "logger-1", previousHash: "tampered", signature: "sig-2" },
      ],
      documents: [{ name: "invoice", sha256: "invoice-hash" }, { name: "coa", sha256: "coa-hash" }],
    });
    expect(report.status).toBe("insufficient_evidence");
    expect(report.signatureCoverage).toBe(0);
    expect(report.hashChainValid).toBe(false);
  });

  it("routes a temperature excursion to QA and requires a reason", async () => {
    const { engine, supplierManager, receiver, qa, shipment } = await fundedShipment({ allowAdjustmentBps: true });
    const start = Date.now() - 299_000;
    const report = engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [
        { sequence: 1, timestamp: new Date(start).toISOString(), temperatureCelsius: 4 },
        { sequence: 2, timestamp: new Date(start + 60_000).toISOString(), temperatureCelsius: 9 },
        { sequence: 3, timestamp: new Date(start + 120_000).toISOString(), temperatureCelsius: 11 },
        { sequence: 4, timestamp: new Date(start + 240_000).toISOString(), temperatureCelsius: 4 },
      ],
      documents: [
        { name: "invoice", sha256: "invoice-hash" },
        { name: "coa", sha256: "coa-hash" },
      ],
    });
    expect(report.status).toBe("insufficient_evidence");
    expect(report.firstReadingAt).toBe(new Date(start).toISOString());
    expect(report.lastReadingAt).toBe(new Date(start + 240_000).toISOString());
    expect(report.averageTemperatureCelsius).toBe(7);
    expect(report.excursionCount).toBe(1);
    expect(report.longestExcursionSeconds).toBe(60);
    expect(report.telemetryMerkleRoot).toMatch(/^[a-f0-9]{64}$/);
    const receipt = engine.receiveShipment(receiver, { shipmentId: shipment.id, receivedQuantity: 20, siteId: "central" });
    expect(report.status).toBe("exception");
    expect(() => engine.decideQA(qa, { receiptId: receipt.id, status: "accepted", reason: "Wrong site", siteId: "branch" }))
      .toThrowError(expect.objectContaining({ code: "CONFLICT" }));
    expect(() => engine.decideQA(qa, { receiptId: receipt.id, status: "accepted", reason: "", siteId: "central" }))
      .toThrowError(expect.objectContaining({ code: "CONFLICT" }));
    const decision = engine.decideQA(qa, {
      receiptId: receipt.id,
      status: "accepted_with_adjustment",
      adjustmentBps: 500,
      reason: "QA approved the documented exception with supplier credit",
      siteId: "central",
    });
    expect(decision.adjustmentBps).toBe(500);
    const settlement = engine.snapshot().settlements[0]!;
    expect(settlement.supplierAmountBaseUnits).toBe(95000n);
    expect(settlement.buyerCreditBaseUnits).toBe(5000n);
    expect(settlement.supplierAmountBaseUnits! + settlement.buyerCreditBaseUnits!).toBe(settlement.amountBaseUnits);
  });

  it("keeps settlement held when QA chooses Hold", async () => {
    const { engine, supplierManager, receiver, qa, finance, shipment, po } = await fundedShipment();
    engine.submitConditionEvidence(supplierManager, { shipmentId: shipment.id, readings: [], documents: [] });
    const receipt = engine.receiveShipment(receiver, { shipmentId: shipment.id, receivedQuantity: 20, siteId: "central" });
    engine.decideQA(qa, { receiptId: receipt.id, status: "held", reason: "Review the missing logger interval", siteId: "central" });
    expect(engine.snapshot().settlements[0]!.status).toBe("held");
    await expect(engine.settle(finance, po.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects a QA discount when the agreed policy does not allow adjustments", async () => {
    const { engine, supplierManager, receiver, qa, po } = setup({ allowAdjustmentBps: false });
    await engine.acknowledgePurchaseOrder(supplierManager, po.id);
    const finance = engine.actor("tenant-buyer", "buyer-finance");
    await engine.fundPurchaseOrder(finance, po.id);
    const declared = engine.declareShipment(supplierManager, {
      purchaseOrderId: po.id,
      manufacturerLotNumber: "HBA-NO-ADJUST",
      expiryDate: new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10),
      quantity: 20,
    });
    engine.submitConditionEvidence(supplierManager, { shipmentId: declared.shipment.id, readings: [], documents: [] });
    const receipt = engine.receiveShipment(receiver, { shipmentId: declared.shipment.id, receivedQuantity: 20, siteId: "central" });
    expect(() => engine.decideQA(qa, {
      receiptId: receipt.id,
      status: "accepted_with_adjustment",
      adjustmentBps: 500,
      reason: "Supplier credit",
      siteId: "central",
    })).toThrowError(expect.objectContaining({ code: "CONFLICT" }));
    expect(engine.snapshot().settlements[0]!.adjustmentBps).toBe(0);
  });

  it("keeps supplier access scoped and prevents supplier QA", async () => {
    const { engine, supplierManager, po } = setup();
    await engine.acknowledgePurchaseOrder(supplierManager, po.id);
    expect(() => engine.decideQA(supplierManager, {
        receiptId: "not-owned",
        status: "accepted",
        reason: "forged",
        siteId: "central",
      })).toThrowError(expect.objectContaining({ code: "NOT_FOUND" }));
    const foreignActor = engine.actor("tenant-supplier", "supplier-manager");
    expect(foreignActor.tenantId).toBe("tenant-supplier");
    expect(engine.listTenantPurchaseOrders(foreignActor)).toHaveLength(0);
  });

  it("lists only active, explicitly granted purchase orders in the supplier inbox", () => {
    const { engine, supplierManager, po, product, supplier } = setup();
    const inbox = engine.listSupplierInbox(supplierManager);

    expect(inbox).toEqual([
      expect.objectContaining({
        purchaseOrderId: po.id,
        buyerTenantId: "tenant-buyer",
        buyerTenantName: "Preview Laboratory",
        supplierTenantId: supplier.id,
        productId: product.id,
        productName: product.name,
        status: "draft",
        availableActions: ["view", "acknowledge", "submit_evidence", "respond"],
      }),
    ]);
    expect(inbox[0]).not.toHaveProperty("settlementReference");

    const snapshot = engine.snapshot();
    snapshot.grants = [];
    engine.replaceSnapshot(snapshot);
    expect(engine.listSupplierInbox(supplierManager)).toEqual([]);
  });

  it("builds role-specific receiving, QA, and finance queues from the same aggregate", async () => {
    const context = await fundedShipment();
    context.engine.configureTenant(context.buyerOwner, {
      sites: [{ id: "central", name: "Central store", kind: "warehouse", active: true }],
    });

    expect(context.engine.listReceivingQueue(context.receiver)).toEqual([
      expect.objectContaining({ shipmentId: context.shipment.id, productName: context.product.name, availableSites: [expect.objectContaining({ id: "central" })] }),
    ]);
    const receipt = context.engine.receiveShipment(context.receiver, { shipmentId: context.shipment.id, receivedQuantity: 20, siteId: "central" });
    expect(context.engine.listQAQueue(context.qa)).toEqual([
      expect.objectContaining({ receiptId: receipt.id, shipmentId: context.shipment.id, siteId: "central" }),
    ]);
    expect(context.engine.listFinanceQueue(context.finance)).toEqual([
      expect.objectContaining({ purchaseOrderId: context.po.id, settlementStatus: "awaiting_qa", supplierTenantName: "Preview Reagents" }),
    ]);
  });

  it("rejects uploaded evidence documents without a cryptographic hash and object reference", async () => {
    const { engine, supplierManager, shipment } = await fundedShipment();

    expect(() => engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [{ sequence: 1, timestamp: new Date().toISOString(), temperatureCelsius: 4 }],
      documents: [{ name: "coa", sha256: "not-a-sha", source: "upload", objectId: "coa-1", contentType: "application/pdf" }],
    })).toThrowError(expect.objectContaining({ code: "CONFLICT" }));
  });

  it("preserves inventory conservation and rejects double spending", async () => {
    const { engine, supplierManager, receiver, qa, shipment, product } = await fundedShipment();
    engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [{ sequence: 1, timestamp: new Date().toISOString(), temperatureCelsius: 4 }],
      documents: [
        { name: "invoice", sha256: "invoice-hash" },
        { name: "coa", sha256: "coa-hash" },
      ],
    });
    const receipt = engine.receiveShipment(receiver, { shipmentId: shipment.id, receivedQuantity: 20, siteId: "central" });
    engine.decideQA(qa, { receiptId: receipt.id, status: "accepted", reason: "All checks passed", siteId: "central" });
    const lotId = engine.snapshot().lots[0]!.id;
    engine.recordUsage(qa, {
      lotId,
      siteId: "central",
      kind: "consume_test",
      quantity: 6,
      unit: product.baseUnit,
      sourceId: "test-run-1",
    });
    engine.recordUsage(qa, {
      lotId,
      siteId: "central",
      kind: "consume_qc",
      quantity: 2,
      unit: product.baseUnit,
      sourceId: "qc-run-1",
    });
    expect(() => engine.recordUsage(qa, {
        lotId,
        siteId: "central",
        kind: "waste",
        quantity: 20,
        unit: product.baseUnit,
        sourceId: "waste-too-much",
      })).toThrowError(expect.objectContaining({ code: "CONFLICT" }));
    const holding = engine.listTenantHoldings(qa)[0]!;
    expect(holding.onHand).toBe(12);
    expect(holding.usable).toBe(12);
  });

  it("transfers usable stock between sites without changing total quantity", async () => {
    const { engine, supplierManager, receiver, qa, shipment, product } = await fundedShipment();
    engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [{ sequence: 1, timestamp: new Date().toISOString(), temperatureCelsius: 4 }],
      documents: [{ name: "invoice", sha256: "invoice-hash" }, { name: "coa", sha256: "coa-hash" }],
    });
    const receipt = engine.receiveShipment(receiver, { shipmentId: shipment.id, receivedQuantity: 20, siteId: "central" });
    engine.decideQA(qa, { receiptId: receipt.id, status: "accepted", reason: "Pass", siteId: "central" });
    const lotId = engine.snapshot().lots[0]!.id;
    const transfer = engine.transferInventory(qa, {
      lotId,
      fromSiteId: "central",
      toSiteId: "branch",
      quantity: 5,
      unit: product.baseUnit,
      sourceId: "transfer-1",
    }, "transfer-retry");
    expect(transfer.transferOut.kind).toBe("transfer_out");
    expect(engine.listTenantHoldings(qa)).toEqual(expect.arrayContaining([
      expect.objectContaining({ siteId: "central", onHand: 15, usable: 15 }),
      expect.objectContaining({ siteId: "branch", onHand: 5, usable: 5 }),
    ]));
    const retry = engine.transferInventory(qa, {
      lotId,
      fromSiteId: "central",
      toSiteId: "branch",
      quantity: 5,
      unit: product.baseUnit,
      sourceId: "transfer-1",
    }, "transfer-retry");
    expect(retry).toEqual(transfer);
    expect(engine.snapshot().inventoryEvents.filter((event) => event.sourceId.includes("transfer-1"))).toHaveLength(2);
  });

  it("keeps tenant sites and usage reasons configurable while preserving safe inventory events", async () => {
    const { engine, buyerOwner, supplierManager, receiver, qa, shipment, product } = await fundedShipment();
    engine.configureTenant(buyerOwner, {
      timezone: "Asia/Kathmandu",
      sites: [
        { id: "central", name: "Central store", kind: "warehouse", active: true },
        { id: "branch", name: "Branch laboratory", kind: "branch", active: true },
      ],
      usageReasonCodes: [
        { code: "patient-testing", label: "Patient testing", kinds: ["consume_test"], active: true },
        { code: "qc", label: "Quality control", kinds: ["consume_qc"], active: true },
      ],
    });
    engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [{ sequence: 1, timestamp: "2026-01-01T00:00:00.000Z", temperatureCelsius: 4 }],
      documents: [{ name: "invoice", sha256: "invoice-hash" }, { name: "coa", sha256: "coa-hash" }],
    });
    const receipt = engine.receiveShipment(receiver, { shipmentId: shipment.id, receivedQuantity: 20, siteId: "central" });
    engine.decideQA(qa, { receiptId: receipt.id, status: "accepted", reason: "Pass", siteId: "central" });
    const lotId = engine.snapshot().lots[0]!.id;
    const opening = engine.recordOpening(qa, {
      lotId, siteId: "central", quantity: 1, unit: product.baseUnit, sourceId: "opening-1", reason: "Opened kit for run",
    });
    expect(engine.recordOpening(qa, {
      lotId, siteId: "central", quantity: 1, unit: product.baseUnit, sourceId: "opening-1", reason: "Opened kit for run",
    })).toEqual(opening);
    engine.recordUsage(qa, {
      lotId, siteId: "central", kind: "consume_test", quantity: 1, unit: product.baseUnit,
      sourceId: "usage-1", reasonCode: "patient-testing",
    });
    const correction = engine.recordCorrection(qa, {
      lotId, siteId: "central", quantity: 1, unit: product.baseUnit, sourceId: "correction-1", reason: "Physical recount",
    });
    expect(correction.kind).toBe("correction");
    expect(engine.listTenantSettings(qa)).toMatchObject({ timezone: "Asia/Kathmandu", sites: [{ id: "central" }, { id: "branch" }] });
    expect(() => engine.recordUsage(qa, {
      lotId, siteId: "unconfigured", kind: "consume_test", quantity: 1, unit: product.baseUnit,
      sourceId: "usage-bad-site", reasonCode: "patient-testing",
    })).toThrowError(expect.objectContaining({ code: "CONFLICT" }));
  });

  it("returns an authorized verification report without exposing document contents", async () => {
    const { engine, supplierManager, receiver, qa, shipment } = await fundedShipment();
    engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [{ sequence: 1, timestamp: "2026-01-01T00:00:00.000Z", temperatureCelsius: 4 }],
      documents: [{ name: "coa", sha256: "c".repeat(64), source: "upload", objectId: "private-coa", contentType: "application/pdf" }],
    });
    const receipt = engine.receiveShipment(receiver, { shipmentId: shipment.id, receivedQuantity: 20, siteId: "central" });
    engine.decideQA(qa, { receiptId: receipt.id, status: "accepted", reason: "Pass", siteId: "central" });
    const report = engine.verificationReport(qa, engine.snapshot().purchaseOrders[0]!.id);
    expect(report.condition).toMatchObject({ documentNames: ["coa"], documentHashes: ["c".repeat(64)] });
    expect(JSON.stringify(report)).not.toContain("private-coa");
    expect(() => engine.verificationReport(supplierManager, engine.snapshot().purchaseOrders[0]!.id))
      .toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("requires an authorized QA release before quarantined stock becomes usable again", async () => {
    const { engine, supplierManager, receiver, qa, finance, po, shipment } = await fundedShipment();
    engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [{ sequence: 1, timestamp: new Date().toISOString(), temperatureCelsius: 4 }],
      documents: [{ name: "invoice", sha256: "invoice-hash" }, { name: "coa", sha256: "coa-hash" }],
    });
    const receipt = engine.receiveShipment(receiver, { shipmentId: shipment.id, receivedQuantity: 20, siteId: "central" });
    engine.decideQA(qa, { receiptId: receipt.id, status: "accepted", reason: "Pass", siteId: "central" });
    const lotId = engine.snapshot().lots[0]!.id;
    const quarantine = engine.quarantineLot(qa, { lotId, siteId: "central", quantity: 4, reason: "Recall review" });
    expect(engine.listTenantHoldings(qa)[0]).toMatchObject({ usable: 16, quarantined: 4 });
    expect(engine.recallImpact(qa, quarantine.recall.id)).toMatchObject({
      recall: expect.objectContaining({ id: quarantine.recall.id, status: "active" }),
      locations: [expect.objectContaining({ siteId: "central", recordedRemaining: 20, quarantined: 4 })],
    });
    await expect(engine.settle(finance, po.id)).rejects.toMatchObject({ code: "CONFLICT" });
    const released = engine.releaseRecall(qa, {
      recallId: quarantine.recall.id,
      lotId,
      siteId: "central",
      quantity: 4,
      reason: "QA cleared the lot after review",
    }, "release-1");
    expect(released.recall.status).toBe("cleared");
    expect(engine.listTenantHoldings(qa)[0]).toMatchObject({ usable: 20, quarantined: 0 });
  });

  it("blocks consumption of an expired lot even when usable balance remains", async () => {
    const { engine, supplierManager, receiver, qa, shipment } = await fundedShipment();
    const lot = engine.snapshot().lots[0]!;
    lot.expiryDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const current = engine.snapshot();
    engine.replaceSnapshot({ ...current, lots: [lot] });
    engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [{ sequence: 1, timestamp: new Date().toISOString(), temperatureCelsius: 4 }],
      documents: [{ name: "invoice", sha256: "invoice-hash" }, { name: "coa", sha256: "coa-hash" }],
    });
    const receipt = engine.receiveShipment(receiver, { shipmentId: shipment.id, receivedQuantity: 20, siteId: "central" });
    engine.decideQA(qa, { receiptId: receipt.id, status: "accepted", reason: "QA review recorded", siteId: "central" });
    expect(() => engine.recordUsage(qa, {
      lotId: lot.id, siteId: "central", kind: "consume_test", quantity: 1, unit: lot.unit, sourceId: "expired-use",
    })).toThrowError(expect.objectContaining({ code: "CONFLICT" }));
  });

  it("does not duplicate a receipt or QA inventory event on retries", async () => {
    const { engine, supplierManager, receiver, qa, shipment } = await fundedShipment();
    engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [{ sequence: 1, timestamp: new Date().toISOString(), temperatureCelsius: 4 }],
      documents: [
        { name: "invoice", sha256: "invoice-hash" },
        { name: "coa", sha256: "coa-hash" },
      ],
    });
    const receipt = engine.receiveShipment(receiver, { shipmentId: shipment.id, receivedQuantity: 20, siteId: "central" }, "receive-1");
    expect(() => engine.receiveShipment(receiver, { shipmentId: shipment.id, receivedQuantity: 20, siteId: "central" }, "receive-2"))
      .toThrowError(expect.objectContaining({ code: "CONFLICT" }));
    engine.decideQA(qa, { receiptId: receipt.id, status: "accepted", reason: "Pass", siteId: "central" }, "qa-1");
    expect(() => engine.decideQA(qa, { receiptId: receipt.id, status: "accepted", reason: "Pass", siteId: "central" }, "qa-2"))
      .toThrowError(expect.objectContaining({ code: "CONFLICT" }));
    expect(engine.listTenantHoldings(qa)[0]!.onHand).toBe(20);
  });

  it("scopes idempotency keys by actor and operation", async () => {
    const { engine, buyerOwner, supplierManager, finance, po } = setup();
    const acknowledged = await engine.acknowledgePurchaseOrder(supplierManager, po.id, "same-key");
    expect(acknowledged.status).toBe("acknowledged");
    await expect(engine.fundPurchaseOrder(finance, po.id, "same-key")).resolves.toMatchObject({ status: "funded" });
    expect(engine.snapshot().settlements[0]!.status).toBe("funded");
    expect(buyerOwner.tenantId).not.toBe(supplierManager.tenantId);
  });

  it("is idempotent for funding and settlement retries", async () => {
    const { engine, payment, supplierManager, finance, receiver, qa, shipment, po } = await fundedShipment();
    expect(payment.calls.filter((call) => call.startsWith("fund:"))).toHaveLength(1);
    engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [{ sequence: 1, timestamp: new Date().toISOString(), temperatureCelsius: 4 }],
      documents: [
        { name: "invoice", sha256: "invoice-hash" },
        { name: "coa", sha256: "coa-hash" },
      ],
    });
    const receipt = engine.receiveShipment(receiver, { shipmentId: shipment.id, receivedQuantity: 20, siteId: "central" });
    engine.decideQA(qa, { receiptId: receipt.id, status: "accepted", reason: "Pass", siteId: "central" });
    const first = await engine.settle(finance, po.id, "settle-1");
    const second = await engine.settle(finance, po.id, "settle-1");
    expect(second.paymentReference).toBe(first.paymentReference);
    expect(payment.calls.filter((call) => call.startsWith("settle:"))).toHaveLength(1);
  });

  it("persists an unknown settlement and reconciles its submitted reference before retrying", async () => {
    const { engine, payment, supplierManager, finance, receiver, qa, shipment, po } = await fundedShipment();
    payment.failNextSettlement = true;
    engine.submitConditionEvidence(supplierManager, {
      shipmentId: shipment.id,
      readings: [{ sequence: 1, timestamp: new Date().toISOString(), temperatureCelsius: 4 }],
      documents: [{ name: "invoice", sha256: "invoice-hash" }, { name: "coa", sha256: "coa-hash" }],
    });
    const receipt = engine.receiveShipment(receiver, { shipmentId: shipment.id, receivedQuantity: 20, siteId: "central" });
    engine.decideQA(qa, { receiptId: receipt.id, status: "accepted", reason: "Pass", siteId: "central" });
    await expect(engine.settle(finance, po.id, "settle-unknown")).rejects.toMatchObject({ code: "PAYMENT_OUTCOME_UNKNOWN" });
    expect(engine.snapshot().settlements[0]!.status).toBe("unknown");
    expect(engine.snapshot().settlements[0]!.pendingAction).toBe("settle");
    expect(engine.snapshot().settlements[0]!.paymentReference).toMatch(/^tempo-test-settle-/);
    await expect(engine.settle(finance, po.id, "settle-unknown")).resolves.toMatchObject({ status: "confirmed" });
    expect(payment.calls.filter((call) => call.startsWith("settle:")).length).toBe(1);
  });

  it("does not treat Solana publication as payment confirmation", async () => {
    const { engine, attestation, finance, qa, po } = setup();
    const verification = await engine.publishVerification(qa, po.id);
    expect(verification.paymentStatus).toBe("draft");
    expect(attestation.calls).toEqual([`publish:${po.id}`]);
    expect(verification.solanaReceiptSignature).toContain("solana-devnet");
    expect(engine.publicVerification(po.id).solanaReceiptSignature).toBe(verification.solanaReceiptSignature);
    await expect(engine.publishVerification(finance, "unknown")).rejects.toBeInstanceOf(DomainError);
  });
});
