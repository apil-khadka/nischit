import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";
import { EngineService } from "./engine.service.js";

describe("HTTP API seam", () => {
  async function createApp() {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api");
    await app.init();
    return app;
  }

  it("exposes health and a preview directory", async () => {
    const app = await createApp();
    const server = app.getHttpAdapter().getInstance();
    const health = await server.inject({ method: "GET", url: "/api/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ ok: true, service: "nischit-api" });
    const readiness = await server.inject({ method: "GET", url: "/api/health/ready" });
    expect(readiness.statusCode).toBe(200);
    expect(readiness.json()).toMatchObject({ ok: true, checks: { persistence: "memory", identity: "local" } });
    const preview = await server.inject({ method: "GET", url: "/api/preview" });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ buyerTenantId: "preview-buyer", supplierTenantId: "preview-supplier" });
    await app.close();
  });

  it("does not return another tenant's purchase orders", async () => {
    const app = await createApp();
    const server = app.getHttpAdapter().getInstance();
    const response = await server.inject({
      method: "GET",
      url: "/api/purchase-orders",
      headers: { "x-tenant-id": "preview-supplier", "x-user-id": "preview-supplier-manager" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
    await app.close();
  });

  it("returns the authenticated preview session shape through the session endpoint", async () => {
    const app = await createApp();
    const server = app.getHttpAdapter().getInstance();
    const response = await server.inject({
      method: "GET",
      url: "/api/session",
      headers: { "x-tenant-id": "preview-buyer", "x-user-id": "preview-buyer-owner" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      kind: "preview",
      tenantId: "preview-buyer",
      userId: "preview-buyer-owner",
      name: "Preview Buyer",
      tenantName: "Nischit Preview Laboratory",
      role: "buyer",
      roles: ["owner", "admin"],
    });
    await app.close();
  });

  it("exposes a grant-scoped supplier inbox without changing buyer PO visibility", async () => {
    const app = await createApp();
    const server = app.getHttpAdapter().getInstance();
    const preview = (await server.inject({ method: "GET", url: "/api/preview" })).json();
    const buyer = { "x-tenant-id": preview.buyerTenantId, "x-user-id": preview.users.buyerOwner };
    const supplier = { "x-tenant-id": preview.supplierTenantId, "x-user-id": preview.users.supplier };
    const create = await server.inject({
      method: "POST", url: "/api/purchase-orders", headers: buyer,
      payload: { supplierTenantId: preview.supplierTenantId, productId: preview.productId, quantity: 4, amountBaseUnits: "4000", token: "TEST_USD", policy: { maxTelemetryGapSeconds: 300 } },
    });
    const po = create.json();
    expect((await server.inject({ method: "GET", url: "/api/supplier/inbox", headers: supplier })).json()).toEqual([]);
    const grantHeaders = { ...buyer, "idempotency-key": "grant-once" };
    const firstGrant = await server.inject({ method: "POST", url: `/api/purchase-orders/${po.id}/grants`, headers: grantHeaders, payload: { receivingTenantId: preview.supplierTenantId } });
    const repeatedGrant = await server.inject({ method: "POST", url: `/api/purchase-orders/${po.id}/grants`, headers: grantHeaders, payload: { receivingTenantId: preview.supplierTenantId } });
    expect(firstGrant.statusCode).toBe(201);
    expect(repeatedGrant.statusCode).toBe(201);
    expect(repeatedGrant.json().id).toBe(firstGrant.json().id);
    const inbox = await server.inject({ method: "GET", url: "/api/supplier/inbox", headers: supplier });
    expect(inbox.statusCode).toBe(200);
    expect(inbox.json()).toEqual([expect.objectContaining({ purchaseOrderId: po.id, productName: "HbA1c reagent kit" })]);
    const buyerInbox = await server.inject({ method: "GET", url: "/api/supplier/inbox", headers: buyer });
    expect(buyerInbox.statusCode).toBe(200);
    expect(buyerInbox.json()).toEqual([]);
    expect((await server.inject({ method: "GET", url: "/api/products", headers: buyer })).json()).toEqual(expect.arrayContaining([expect.objectContaining({ name: "HbA1c reagent kit" })]));
    expect((await server.inject({ method: "GET", url: "/api/suppliers", headers: buyer })).json()).toEqual(expect.arrayContaining([expect.objectContaining({ tenantId: preview.supplierTenantId })]));
    expect((await server.inject({ method: "GET", url: "/api/receiving/queue", headers: buyer })).statusCode).toBe(200);
    expect((await server.inject({ method: "GET", url: "/api/qa/queue", headers: buyer })).statusCode).toBe(200);
    expect((await server.inject({ method: "GET", url: "/api/finance/queue", headers: buyer })).statusCode).toBe(200);
    await app.close();
  });

  it("fails closed when private evidence storage is not configured", async () => {
    const app = await createApp();
    const server = app.getHttpAdapter().getInstance();
    const response = await server.inject({
      method: "POST",
      url: "/api/evidence",
      headers: { "x-tenant-id": "preview-buyer", "x-user-id": "preview-buyer-owner" },
      payload: { objectId: "evidence-1", contentBase64: "dGVzdA==", sha256: "0".repeat(64) },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: "OBJECT_STORE_UNAVAILABLE" });
    await app.close();
  });

  it("presigns evidence only through the active tenant's object-store namespace", async () => {
    const app = await createApp();
    const service = app.get(EngineService);
    service.objectStore = {
      putEvidence: async () => ({ key: "unused", sha256: "0".repeat(64) }),
      getEvidence: async () => ({
        tenantId: "preview-buyer",
        objectId: "evidence-1",
        contentType: "application/pdf",
        body: new Uint8Array(),
        sha256: "0".repeat(64),
      }),
      presignEvidence: async ({ tenantId, objectId }) => `https://private.example/${tenantId}/${objectId}`,
    };
    const server = app.getHttpAdapter().getInstance();
    const response = await server.inject({
      method: "GET",
      url: "/api/evidence/evidence-1",
      headers: { "x-tenant-id": "preview-buyer", "x-user-id": "preview-buyer-owner" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      tenantId: "preview-buyer",
      objectId: "evidence-1",
      url: "https://private.example/preview-buyer/evidence-1",
    });
    await app.close();
  });

  it("returns an authentication error instead of a server error for missing context", async () => {
    const app = await createApp();
    const server = app.getHttpAdapter().getInstance();
    const response = await server.inject({ method: "GET", url: "/api/purchase-orders" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "UNAUTHENTICATED" });
    await app.close();
  });

  it("runs the documented PO-to-verification golden path through HTTP", async () => {
    const app = await createApp();
    const server = app.getHttpAdapter().getInstance();
    const service = app.get(EngineService);
    service.objectStore = {
      putEvidence: async () => ({ key: "unused", sha256: "c".repeat(64) }),
      getEvidence: async ({ tenantId, objectId }) => ({ tenantId, objectId, contentType: "application/pdf", body: new Uint8Array(), sha256: "c".repeat(64) }),
      presignEvidence: async ({ tenantId, objectId }) => `https://private.example/${tenantId}/${objectId}`,
    };
    const preview = (await server.inject({ method: "GET", url: "/api/preview" })).json();
    const buyer = { "x-tenant-id": preview.buyerTenantId, "x-user-id": preview.users.buyerOwner };
    const supplier = { "x-tenant-id": preview.supplierTenantId, "x-user-id": preview.users.supplier };
    const finance = { "x-tenant-id": preview.buyerTenantId, "x-user-id": preview.users.finance };
    const receiver = { "x-tenant-id": preview.buyerTenantId, "x-user-id": preview.users.receiver };
    const qa = { "x-tenant-id": preview.buyerTenantId, "x-user-id": preview.users.qa };
    const post = (url: string, headers: Record<string, string>, payload: Record<string, unknown>, key: string) =>
      server.inject({ method: "POST", url, headers: { ...headers, "idempotency-key": key }, payload });

    const poResponse = await post("/api/purchase-orders", buyer, {
      supplierTenantId: preview.supplierTenantId, productId: preview.productId, quantity: 20, amountBaseUnits: "100000", token: "TEST_USD",
      policy: { maxTelemetryGapSeconds: 300 },
    }, "http-po");
    expect([200, 201]).toContain(poResponse.statusCode);
    const po = poResponse.json();
    expect(po.amountBaseUnits).toBe("100000");

    expect([200, 201]).toContain((await post("/api/purchase-orders/" + po.id + "/grants", buyer, { receivingTenantId: preview.supplierTenantId }, "http-grant")).statusCode);
    expect([200, 201]).toContain((await post("/api/purchase-orders/" + po.id + "/acknowledge", supplier, {}, "http-ack")).statusCode);
    expect((await post("/api/purchase-orders/" + po.id + "/fund", finance, {}, "http-fund")).json().status).toBe("funded");
    const shipmentResponse = await post("/api/shipments", supplier, {
      purchaseOrderId: po.id, manufacturerLotNumber: "HBA-HTTP-1",
      expiryDate: new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10), quantity: 20,
    }, "http-shipment");
    expect([200, 201]).toContain(shipmentResponse.statusCode);
    const shipment = shipmentResponse.json().shipment;
    const dispatchTime = Date.parse(shipment.dispatchedAt);
    const mismatchedEvidence = await post("/api/shipments/" + shipment.id + "/evidence", supplier, {
      readings: [{ sequence: 1, timestamp: new Date().toISOString(), temperatureCelsius: 4 }],
      documents: [{ name: "coa", sha256: "d".repeat(64), source: "upload", objectId: "coa-1", contentType: "application/pdf" }],
    }, "http-bad-evidence");
    expect(mismatchedEvidence.statusCode).toBe(409);
    const evidence = await post("/api/shipments/" + shipment.id + "/evidence", supplier, {
      readings: [
        { sequence: 1, timestamp: new Date(dispatchTime).toISOString(), temperatureCelsius: 4 },
        { sequence: 2, timestamp: new Date().toISOString(), temperatureCelsius: 4 },
      ],
      documents: [
        { name: "invoice", sha256: "c".repeat(64), source: "upload", objectId: "invoice-1", contentType: "application/pdf" },
        { name: "coa", sha256: "c".repeat(64), source: "upload", objectId: "coa-1", contentType: "application/pdf" },
      ],
    }, "http-evidence");
    expect(evidence.json().status).toBe("insufficient_evidence");
    expect(evidence.json().documents).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "coa", objectId: "coa-1" }),
    ]));
    const receipt = (await post("/api/shipments/" + shipment.id + "/receive", receiver, { receivedQuantity: 20, siteId: "central" }, "http-receive")).json();
    const qaQueue = await server.inject({ method: "GET", url: "/api/qa/queue", headers: qa });
    expect(qaQueue.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ receiptId: receipt.id, conditionStatus: "pass", evidenceDocuments: expect.arrayContaining([expect.objectContaining({ objectId: "invoice-1" })]) }),
    ]));
    const buyerEvidence = await server.inject({
      method: "GET",
      url: `/api/purchase-orders/${po.id}/evidence/invoice-1`,
      headers: qa,
    });
    expect(buyerEvidence.statusCode).toBe(200);
    expect(buyerEvidence.json()).toEqual({
      tenantId: preview.supplierTenantId,
      objectId: "invoice-1",
      url: `https://private.example/${preview.supplierTenantId}/invoice-1`,
    });
    expect((await post("/api/receipts/" + receipt.id + "/qa", qa, { status: "accepted", reason: "All checks passed", siteId: "central" }, "http-qa")).json().status).toBe("accepted");
    const holdings = (await server.inject({ method: "GET", url: "/api/holdings", headers: qa })).json();
    const lot = holdings[0];
    expect([200, 201]).toContain((await post("/api/inventory/transfers", qa, {
      lotId: lot.lotId, fromSiteId: "central", toSiteId: "branch", quantity: 5, unit: "kit", sourceId: "http-transfer",
    }, "http-transfer")).statusCode);
    const recall = (await post("/api/inventory/quarantine", qa, {
      lotId: lot.lotId, siteId: "central", quantity: 2, reason: "Review before release",
    }, "http-quarantine")).json().recall;
    const impact = await server.inject({ method: "GET", url: `/api/recalls/${recall.id}/impact`, headers: qa });
    expect(impact.statusCode).toBe(200);
    expect(impact.json().locations).toEqual(expect.arrayContaining([
      expect.objectContaining({ siteId: "central", quarantined: 2 }),
    ]));
    expect((await post(`/api/recalls/${recall.id}/release`, qa, {
      lotId: lot.lotId, siteId: "central", quantity: 2, reason: "QA cleared the recorded exception",
    }, "http-release")).json().recall.status).toBe("cleared");
    expect((await post("/api/purchase-orders/" + po.id + "/settle", finance, {}, "http-settle")).json().status).toBe("confirmed");
    const verification = await post("/api/purchase-orders/" + po.id + "/verification", qa, {}, "http-verification");
    expect(verification.json().solanaReceiptSignature).toContain("solana-devnet");
    const publicView = await server.inject({ method: "GET", url: "/api/public/purchase-orders/" + po.id + "/verification" });
    expect(publicView.statusCode).toBe(200);
    expect(publicView.json()).toMatchObject({ paymentStatus: "confirmed", purchaseOrderId: po.id });
    expect(publicView.json().solanaReceiptSignature).toContain("solana-devnet");
    await app.close();
  });
});
