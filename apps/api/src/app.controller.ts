import { createHash } from "node:crypto";
import { Body, Controller, Get, Headers, Inject, Param, Post, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { conflict, DomainError, notFound } from "@nischit/domain";
import { EvidenceObjectAlreadyExistsError } from "@nischit/storage";
import { EngineService } from "./engine.service.js";
import { EvidenceScanError, validateEvidenceContent } from "./evidence-scanner.js";

type HeadersShape = Record<string, string | string[] | undefined>;
type BodyShape = Record<string, unknown>;
const jsonSafe = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value, (_key, nested) => (typeof nested === "bigint" ? nested.toString() : nested))) as T;

@Controller()
export class AppController {
  constructor(@Inject(EngineService) private readonly service: EngineService) {}
  private actor(headers: HeadersShape) { return this.service.actorFromHeaders(headers); }
  private execute<T>(reply: FastifyReply, action: () => T | Promise<T>) {
    return this.service.run(action).then(jsonSafe).catch((error: unknown) => {
      if (error instanceof DomainError) { reply.code(error.statusCode); return { error: error.code, message: error.message }; }
      reply.code(500); return { error: "INTERNAL_ERROR", message: "Unexpected server error" };
    });
  }

  @Get("health")
  health() { return { ok: true, service: "nischit-api", version: "0.1.0" }; }
  @Get("health/ready")
  readiness(@Res({ passthrough: true }) reply: FastifyReply) {
    const status = this.service.readiness();
    if (!status.ok) reply.code(503);
    return status;
  }
  @Get("session")
  session(@Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.sessionFromHeaders(headers));
  }
  @Get("preview")
  preview() {
    if (!this.service.preview) throw notFound("Preview directory is disabled");
    return this.service.preview;
  }

  @Get("purchase-orders")
  listPurchaseOrders(@Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.listTenantPurchaseOrders(this.actor(headers)));
  }
  @Get("supplier/inbox")
  supplierInbox(@Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.listSupplierInbox(this.actor(headers)));
  }
  @Get("products")
  listProducts(@Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.listTenantProducts(this.actor(headers)));
  }
  @Get("suppliers")
  listSuppliers(@Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.listSupplierTenants(this.actor(headers)));
  }
  @Get("receiving/queue")
  receivingQueue(@Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.listReceivingQueue(this.actor(headers)));
  }
  @Get("qa/queue")
  qaQueue(@Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.listQAQueue(this.actor(headers)));
  }
  @Get("finance/queue")
  financeQueue(@Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.listFinanceQueue(this.actor(headers)));
  }
  @Get("holdings")
  listHoldings(@Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.listTenantHoldings(this.actor(headers)));
  }
  @Get("recalls")
  listRecalls(@Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.listTenantRecalls(this.actor(headers)));
  }
  @Get("recalls/:id/impact")
  recallImpact(@Param("id") id: string, @Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.recallImpact(this.actor(headers), id));
  }
  @Get("audit")
  audit(@Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.listAudit(this.actor(headers)));
  }

  @Get("tenant/settings")
  tenantSettings(@Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.listTenantSettings(this.actor(headers)));
  }

  @Post("tenant/settings")
  updateTenantSettings(@Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.configureTenant(this.actor(headers), {
      timezone: body.timezone === undefined ? undefined : String(body.timezone),
      sites: Array.isArray(body.sites) ? body.sites.map((site) => {
        const value = site as Record<string, unknown>;
        return {
          id: String(value.id ?? ""), name: String(value.name ?? ""),
          kind: value.kind as "warehouse" | "laboratory" | "branch" | "other",
          active: value.active !== false,
        };
      }) : undefined,
      usageReasonCodes: Array.isArray(body.usageReasonCodes) ? body.usageReasonCodes.map((reason) => {
        const value = reason as Record<string, unknown>;
        return {
          code: String(value.code ?? ""), label: String(value.label ?? ""),
          kinds: (Array.isArray(value.kinds) ? value.kinds : []).map(String) as never,
          active: value.active !== false,
        };
      }) : undefined,
    }));
  }

  @Post("products")
  createProduct(@Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.createProduct(this.actor(headers), {
      name: String(body.name), manufacturer: String(body.manufacturer), baseUnit: body.baseUnit as "kit" | "bottle" | "ml" | "test",
      storageMinCelsius: Number(body.storageMinCelsius), storageMaxCelsius: Number(body.storageMaxCelsius),
      minimumShelfLifeDays: Number(body.minimumShelfLifeDays), requiredDocuments: Array.isArray(body.requiredDocuments) ? body.requiredDocuments.map(String) : [],
    }));
  }

  @Post("evidence")
  uploadEvidence(@Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, async () => {
      const actor = this.actor(headers);
      if (!this.service.objectStore) {
        reply.code(503);
        return { error: "OBJECT_STORE_UNAVAILABLE", message: "Evidence storage is not configured" };
      }
      if (!this.service.evidenceScanner) {
        reply.code(503);
        return { error: "EVIDENCE_SCANNER_UNAVAILABLE", message: "Evidence uploads are disabled until scanning is configured" };
      }
      const objectId = String(body.objectId ?? "");
      const declaredContentType = String(body.contentType ?? "application/octet-stream");
      const encoded = String(body.contentBase64 ?? "");
      const sha256 = String(body.sha256 ?? "").toLowerCase();
      if (!objectId || !encoded || !/^[a-f0-9]{64}$/.test(sha256)) throw conflict("Evidence objectId, contentBase64, and sha256 are required");
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(objectId)) throw conflict("Evidence objectId is invalid");
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw conflict("Evidence contentBase64 is invalid");
      const content = Buffer.from(encoded, "base64");
      const maxBytes = Number(process.env.MAX_EVIDENCE_BYTES ?? 10_485_760);
      if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || content.byteLength > maxBytes) throw conflict("Evidence file exceeds the configured size limit");
      if (createHash("sha256").update(content).digest("hex") !== sha256) throw conflict("Evidence checksum does not match content");
      let contentType: ReturnType<typeof validateEvidenceContent>;
      try {
        contentType = validateEvidenceContent(content, declaredContentType);
      } catch (error) {
        if (error instanceof EvidenceScanError && error.kind === "unsupported") throw conflict(error.message);
        throw error;
      }
      try {
        await this.service.evidenceScanner.scan(content);
      } catch (error) {
        if (error instanceof EvidenceScanError && error.kind === "infected") throw conflict("Evidence file failed malware scanning");
        if (error instanceof EvidenceScanError && error.kind === "unsupported") throw conflict(error.message);
        reply.code(503);
        return { error: "EVIDENCE_SCAN_FAILED", message: "Evidence could not be scanned; retry after the scanner is available" };
      }
      let result;
      try {
        result = await this.service.objectStore.putEvidence({
          tenantId: actor.tenantId,
          objectId,
          contentType,
          body: content,
          sha256,
        });
      } catch (error) {
        if (error instanceof EvidenceObjectAlreadyExistsError) throw conflict(error.message);
        throw error;
      }
      return { ...result, tenantId: actor.tenantId, objectId };
    });
  }

  @Get("evidence/:objectId")
  presignEvidence(@Param("objectId") objectId: string, @Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, async () => {
      const actor = this.actor(headers);
      if (!this.service.objectStore) {
        reply.code(503);
        return { error: "OBJECT_STORE_UNAVAILABLE", message: "Evidence storage is not configured" };
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(objectId)) throw conflict("Evidence objectId is invalid");
      const url = await this.service.objectStore.presignEvidence({ tenantId: actor.tenantId, objectId });
      return { tenantId: actor.tenantId, objectId, url };
    });
  }

  @Get("purchase-orders/:id/evidence/:objectId")
  presignPurchaseOrderEvidence(
    @Param("id") id: string,
    @Param("objectId") objectId: string,
    @Headers() headers: HeadersShape,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.execute(reply, async () => {
      const actor = this.actor(headers);
      if (!this.service.objectStore) {
        reply.code(503);
        return { error: "OBJECT_STORE_UNAVAILABLE", message: "Evidence storage is not configured" };
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(objectId)) throw conflict("Evidence objectId is invalid");
      const location = this.service.engine.evidenceStorageLocation(actor, id, objectId);
      let stored;
      try {
        stored = await this.service.objectStore.getEvidence(location);
      } catch {
        reply.code(503);
        return { error: "EVIDENCE_VERIFICATION_FAILED", message: "Stored evidence could not be verified" };
      }
      if (stored.sha256.toLowerCase() !== location.sha256.toLowerCase()) {
        throw conflict("Stored evidence does not match the checksum attached to this purchase order");
      }
      const url = await this.service.objectStore.presignEvidence(location);
      return { tenantId: location.tenantId, objectId: location.objectId, url };
    });
  }

  @Post("purchase-orders")
  createPO(@Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.createPurchaseOrder(this.actor(headers), {
      supplierTenantId: String(body.supplierTenantId), productId: String(body.productId), quantity: Number(body.quantity),
      amountBaseUnits: String(body.amountBaseUnits), token: String(body.token), policy: body.policy as never,
    }, headers["idempotency-key"]?.toString()));
  }

  @Post("purchase-orders/:id/grants")
  grant(@Param("id") id: string, @Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.createCollaborationGrant(this.actor(headers), {
      purchaseOrderId: id, receivingTenantId: String(body.receivingTenantId),
      actions: (Array.isArray(body.actions) ? body.actions : ["view", "acknowledge", "submit_evidence", "respond"]) as never,
    }, headers["idempotency-key"]?.toString()));
  }
  @Post("purchase-orders/:id/acknowledge")
  acknowledge(@Param("id") id: string, @Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.acknowledgePurchaseOrder(this.actor(headers), id, headers["idempotency-key"]?.toString()));
  }
  @Post("purchase-orders/:id/fund")
  fund(@Param("id") id: string, @Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.fundPurchaseOrder(this.actor(headers), id, headers["idempotency-key"]?.toString()));
  }

  @Post("shipments")
  shipment(@Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.declareShipment(this.actor(headers), {
      purchaseOrderId: String(body.purchaseOrderId), manufacturerLotNumber: String(body.manufacturerLotNumber),
      expiryDate: String(body.expiryDate), quantity: Number(body.quantity),
    }, headers["idempotency-key"]?.toString()));
  }
  @Post("shipments/:id/evidence")
  evidence(@Param("id") id: string, @Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, async () => {
      const actor = this.actor(headers);
      const documents = Array.isArray(body.documents)
        ? body.documents.map((document) => {
          const value = document as Record<string, unknown>;
          return {
            name: String(value.name ?? ""),
            sha256: String(value.sha256 ?? "").toLowerCase(),
            ...(value.source ? { source: value.source as "manual" | "upload" | "device" } : {}),
            ...(value.objectId ? { objectId: String(value.objectId) } : {}),
            ...(value.contentType ? { contentType: String(value.contentType) } : {}),
          };
        })
        : [];
      for (const document of documents) {
        if (!document.objectId) continue;
        if (!this.service.objectStore) {
          reply.code(503);
          return { error: "OBJECT_STORE_UNAVAILABLE", message: "Uploaded evidence storage is not configured" };
        }
        let stored;
        try {
          stored = await this.service.objectStore.getEvidence({ tenantId: actor.tenantId, objectId: document.objectId });
        } catch {
          throw conflict("Evidence object could not be verified");
        }
        if (stored.sha256.toLowerCase() !== document.sha256) throw conflict("Evidence object checksum does not match document hash");
        if (!this.service.evidenceScanner) {
          reply.code(503);
          return { error: "EVIDENCE_SCANNER_UNAVAILABLE", message: "Uploaded evidence cannot be accepted until scanning is configured" };
        }
        if (document.contentType && document.contentType !== stored.contentType) throw conflict("Evidence content type does not match the stored object");
      }
      return this.service.engine.submitConditionEvidence(actor, {
        shipmentId: id, readings: (Array.isArray(body.readings) ? body.readings : []) as never, documents,
      }, headers["idempotency-key"]?.toString());
    });
  }
  @Post("shipments/:id/receive")
  receive(@Param("id") id: string, @Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.receiveShipment(this.actor(headers), {
      shipmentId: id, receivedQuantity: Number(body.receivedQuantity), siteId: String(body.siteId),
    }, headers["idempotency-key"]?.toString()));
  }
  @Post("receipts/:id/qa")
  qa(@Param("id") id: string, @Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.decideQA(this.actor(headers), {
      receiptId: id, status: body.status as "accepted" | "accepted_with_adjustment" | "held" | "rejected",
      reason: String(body.reason), adjustmentBps: body.adjustmentBps === undefined ? undefined : Number(body.adjustmentBps), siteId: String(body.siteId),
    }, headers["idempotency-key"]?.toString()));
  }

  @Post("purchase-orders/:id/settle")
  settle(@Param("id") id: string, @Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.settle(this.actor(headers), id, headers["idempotency-key"]?.toString()));
  }
  @Post("purchase-orders/:id/reconcile-payment")
  reconcilePayment(@Param("id") id: string, @Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.reconcileSettlementPayment(this.actor(headers), id));
  }
  @Post("purchase-orders/:id/refund")
  refund(@Param("id") id: string, @Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.refund(this.actor(headers), id, String(body.reason), headers["idempotency-key"]?.toString()));
  }

  @Post("inventory/usage")
  usage(@Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.recordUsage(this.actor(headers), {
      lotId: String(body.lotId), siteId: String(body.siteId),
      kind: body.kind as "consume_test" | "consume_qc" | "training" | "waste" | "disposal",
      quantity: Number(body.quantity), unit: body.unit as "kit" | "bottle" | "ml" | "test", sourceId: String(body.sourceId),
      reason: body.reason ? String(body.reason) : undefined, reasonCode: body.reasonCode ? String(body.reasonCode) : undefined,
    }, headers["idempotency-key"]?.toString()));
  }

  @Post("inventory/openings")
  opening(@Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.recordOpening(this.actor(headers), {
      lotId: String(body.lotId), siteId: String(body.siteId), quantity: Number(body.quantity),
      unit: body.unit as "kit" | "bottle" | "ml" | "test", sourceId: String(body.sourceId), reason: String(body.reason),
    }, headers["idempotency-key"]?.toString()));
  }

  @Post("inventory/corrections")
  correction(@Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.recordCorrection(this.actor(headers), {
      lotId: String(body.lotId), siteId: String(body.siteId), quantity: Number(body.quantity),
      unit: body.unit as "kit" | "bottle" | "ml" | "test", sourceId: String(body.sourceId), reason: String(body.reason),
    }, headers["idempotency-key"]?.toString()));
  }
  @Post("inventory/quarantine")
  quarantine(@Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.quarantineLot(this.actor(headers), {
      lotId: String(body.lotId), siteId: String(body.siteId), quantity: body.quantity === undefined ? undefined : Number(body.quantity), reason: String(body.reason),
    }, headers["idempotency-key"]?.toString()));
  }

  @Post("inventory/transfers")
  transfer(@Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.transferInventory(this.actor(headers), {
      lotId: String(body.lotId),
      fromSiteId: String(body.fromSiteId),
      toSiteId: String(body.toSiteId),
      quantity: Number(body.quantity),
      unit: body.unit as "kit" | "bottle" | "ml" | "test",
      sourceId: String(body.sourceId),
      reason: body.reason ? String(body.reason) : undefined,
    }, headers["idempotency-key"]?.toString()));
  }

  @Post("recalls/:id/release")
  releaseRecall(@Param("id") id: string, @Headers() headers: HeadersShape, @Body() body: BodyShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.releaseRecall(this.actor(headers), {
      recallId: id,
      lotId: String(body.lotId),
      siteId: String(body.siteId),
      quantity: Number(body.quantity),
      reason: String(body.reason),
    }, headers["idempotency-key"]?.toString()));
  }

  @Post("purchase-orders/:id/verification")
  verification(@Param("id") id: string, @Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.publishVerification(this.actor(headers), id, headers["idempotency-key"]?.toString()));
  }
  @Get("purchase-orders/:id/verification-report")
  verificationReport(@Param("id") id: string, @Headers() headers: HeadersShape, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.verificationReport(this.actor(headers), id));
  }
  @Get("public/purchase-orders/:id/verification")
  publicVerification(@Param("id") id: string, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.execute(reply, () => this.service.engine.verifyPublicPurchaseOrder(id));
  }
}
