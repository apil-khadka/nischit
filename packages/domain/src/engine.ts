import { randomUUID } from "node:crypto";
import { hashCommitment } from "./commitments.js";
import { conflict, DomainError, forbidden, notFound, PaymentNotSubmittedError, PaymentOutcomeUnknownError } from "./errors.js";
import { assessConditionCoverage, createConditionReport } from "./condition-evidence.js";
import type {
  AcceptancePolicy,
  Actor,
  AuditEvent,
  CollaborationGrant,
  ConditionReading,
  ConditionReport,
  EvidenceDocument,
  GoodsReceipt,
  Holding,
  InventoryEvent,
  InventoryEventKind,
  Lot,
  Membership,
  Product,
  PurchaseOrder,
  QADecision,
  QAStatus,
  Recall,
  Settlement,
  Shipment,
  Tenant,
  TenantSettings,
  TenantSite,
  UsageReasonCode,
  VerificationReport,
  PublicVerification,
  Role,
  FinanceQueueItem,
  QAQueueItem,
  ReceivingQueueItem,
  SupplierDirectoryItem,
  SupplierInboxItem,
} from "./types.js";
import type { PaymentRail, PublicAttestationRail } from "./ports.js";

export interface CreatePOInput {
  supplierTenantId: string;
  productId: string;
  quantity: number;
  amountBaseUnits: string;
  token: string;
  policy?: Partial<AcceptancePolicy>;
}

export interface DeclareShipmentInput {
  purchaseOrderId: string;
  manufacturerLotNumber: string;
  expiryDate: string;
  quantity: number;
}

export interface SubmitEvidenceInput {
  shipmentId: string;
  readings: ConditionReading[];
  documents: EvidenceDocument[];
}

export interface EngineSnapshot {
  tenants: Tenant[];
  tenantSettings: TenantSettings[];
  memberships: Membership[];
  grants: CollaborationGrant[];
  products: Product[];
  purchaseOrders: PurchaseOrder[];
  lots: Lot[];
  shipments: Shipment[];
  conditionReports: ConditionReport[];
  receipts: GoodsReceipt[];
  inventoryEvents: InventoryEvent[];
  holdings: Holding[];
  qaDecisions: QADecision[];
  settlements: Settlement[];
  recalls: Recall[];
  audit: AuditEvent[];
  idempotency: Record<string, unknown>;
  verificationSignatures: Record<string, string>;
}

const now = () => new Date().toISOString();
const hasAnyRole = (actor: Actor, roles: Role[]) => roles.some((role) => actor.roles.includes(role));

const defaultTenantSettings = (tenantId: string): TenantSettings => ({
  tenantId,
  timezone: "UTC",
  sites: [],
  usageReasonCodes: [
    { code: "testing", label: "Patient testing (no patient data)", kinds: ["consume_test"], active: true },
    { code: "quality-control", label: "Quality control", kinds: ["consume_qc"], active: true },
    { code: "training", label: "Training", kinds: ["training"], active: true },
    { code: "waste", label: "Waste or damage", kinds: ["waste", "disposal"], active: true },
  ],
});

export class NischitEngine {
  private state: EngineSnapshot;
  private persistenceCheckpoint?: () => Promise<void>;

  constructor(
    private readonly paymentRail: PaymentRail,
    private readonly attestationRail: PublicAttestationRail,
    snapshot?: EngineSnapshot,
  ) {
    this.state = snapshot
      ? {
        ...snapshot,
        conditionReports: snapshot.conditionReports.map((report) => ({
          ...report,
          coverageComplete: report.coverageComplete ?? false,
          evidenceIntegrityValid: report.evidenceIntegrityValid ?? false,
        })),
        tenantSettings: snapshot.tenantSettings?.length
          ? snapshot.tenantSettings
          : snapshot.tenants.map((tenant) => defaultTenantSettings(tenant.id)),
        verificationSignatures: snapshot.verificationSignatures ?? {},
      }
      : {
        tenants: [],
        tenantSettings: [],
        memberships: [],
        grants: [],
        products: [],
        purchaseOrders: [],
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
        verificationSignatures: {},
      };
  }

  snapshot(): EngineSnapshot {
    return structuredClone(this.state);
  }

  setPersistenceCheckpoint(checkpoint: () => Promise<void>) {
    this.persistenceCheckpoint = checkpoint;
  }

  replaceSnapshot(snapshot: EngineSnapshot) {
    const cloned = structuredClone(snapshot);
    this.state = {
      ...cloned,
      conditionReports: cloned.conditionReports.map((report) => ({
        ...report,
        coverageComplete: report.coverageComplete ?? false,
        evidenceIntegrityValid: report.evidenceIntegrityValid ?? false,
      })),
      tenantSettings: cloned.tenantSettings?.length
        ? cloned.tenantSettings
        : cloned.tenants.map((tenant) => defaultTenantSettings(tenant.id)),
      verificationSignatures: cloned.verificationSignatures ?? {},
    };
  }

  private record(actor: Actor, action: string, resourceType: string, resourceId: string, metadata = {}) {
    this.state.audit.push({
      id: randomUUID(),
      tenantId: actor.tenantId,
      actorId: actor.userId,
      action,
      resourceType,
      resourceId,
      createdAt: now(),
      metadata,
    });
  }

  private requireTenant(actor: Actor, tenantId: string) {
    if (actor.tenantId !== tenantId) throw forbidden("Active tenant does not match the resource tenant");
    const member = this.state.memberships.find(
      (candidate) => candidate.tenantId === tenantId && candidate.userId === actor.userId,
    );
    if (!member) throw forbidden("User is not a member of this tenant");
  }

  private getPO(id: string) {
    const po = this.state.purchaseOrders.find((candidate) => candidate.id === id);
    if (!po) throw notFound("Purchase order not found");
    return po;
  }

  private grantFor(actor: Actor, po: PurchaseOrder, action: CollaborationGrant["actions"][number]) {
    const grant = this.state.grants.find(
      (candidate) =>
        candidate.grantingTenantId === po.tenantId &&
        candidate.receivingTenantId === actor.tenantId &&
        candidate.resourceType === "purchase_order" &&
        candidate.resourceId === po.id &&
        candidate.status === "active" &&
        candidate.actions.includes(action),
    );
    if (!grant) throw forbidden(`Collaboration grant does not allow ${action}`);
  }

  private async checkpointPaymentIntent() {
    await this.persistenceCheckpoint?.();
  }

  private async beginPaymentAction(
    actor: Actor,
    settlement: Settlement,
    action: NonNullable<Settlement["pendingAction"]>,
    metadata: Record<string, string | number | boolean> = {},
  ) {
    const previous = structuredClone(settlement);
    const auditLength = this.state.audit.length;
    settlement.paymentActionPreviousStatus = settlement.status;
    settlement.pendingAction = action;
    settlement.paymentReference = undefined;
    settlement.status = "submitted";
    this.record(actor, `settlement.${action}.intent.created`, "settlement", settlement.id, metadata);
    try {
      await this.checkpointPaymentIntent();
    } catch (error) {
      Object.assign(settlement, previous);
      this.state.audit.length = auditLength;
      throw error;
    }
  }

  private async paymentSubmitted(settlement: Settlement, reference: string) {
    settlement.paymentReference = reference;
    await this.checkpointPaymentIntent();
  }

  private completePaymentAction(settlement: Settlement, action: NonNullable<Settlement["pendingAction"]>, reference?: string) {
    if (reference) settlement.paymentReference = reference;
    delete settlement.pendingAction;
    delete settlement.paymentActionPreviousStatus;
    if (action === "fund") settlement.status = "funded";
    if (action === "settle") {
      settlement.status = "confirmed";
      settlement.confirmedAt = now();
    }
    if (action === "refund") {
      settlement.status = "refunded";
      settlement.supplierAmountBaseUnits = 0n;
      settlement.buyerCreditBaseUnits = settlement.amountBaseUnits;
    }
  }

  /** Reconcile durable in-flight state before any user-requested retry. */
  private async reconcilePendingPayment(actor: Actor, po: PurchaseOrder, settlement: Settlement, action: NonNullable<Settlement["pendingAction"]>) {
    if (!settlement.pendingAction || settlement.pendingAction !== action) {
      throw conflict("A different payment action is awaiting reconciliation");
    }
    let verification;
    try {
      verification = await this.paymentRail.verify({ purchaseOrder: po, settlement });
    } catch {
      throw conflict("Payment remains unknown; reconcile it before retrying");
    }
    if (verification.status === "verified") {
      const previous = structuredClone(settlement);
      const previousPOStatus = po.status;
      try {
        this.completePaymentAction(settlement, action, verification.reference ?? settlement.paymentReference);
        if (action === "fund") po.status = "funded";
        this.record(actor, `settlement.${action}.reconciled`, "settlement", settlement.id);
        await this.checkpointPaymentIntent();
        return true;
      } catch {
        Object.assign(settlement, previous);
        settlement.status = "unknown";
        settlement.pendingAction = action;
        po.status = previousPOStatus;
        throw new PaymentOutcomeUnknownError();
      }
    }
    if (verification.status === "failed") {
      const previous = structuredClone(settlement);
      const auditLength = this.state.audit.length;
      settlement.status = settlement.paymentActionPreviousStatus ?? (action === "fund" ? "draft" : "authorized");
      delete settlement.pendingAction;
      delete settlement.paymentActionPreviousStatus;
      delete settlement.paymentReference;
      this.record(actor, `settlement.${action}.failed`, "settlement", settlement.id);
      try {
        await this.checkpointPaymentIntent();
      } catch {
        Object.assign(settlement, previous);
        this.state.audit.length = auditLength;
        throw new PaymentOutcomeUnknownError();
      }
      return false;
    }
    throw conflict(`Payment is ${verification.status}; reconcile it before retrying`);
  }

  private async markPaymentUnknown(
    actor: Actor,
    settlement: Settlement,
    action: NonNullable<Settlement["pendingAction"]>,
    previous: Settlement,
    keepAuditThrough: number,
    rollback?: () => void,
  ): Promise<never> {
    const paymentReference = settlement.paymentReference;
    Object.assign(settlement, previous);
    if (paymentReference) settlement.paymentReference = paymentReference;
    else delete settlement.paymentReference;
    settlement.status = "unknown";
    settlement.pendingAction = action;
    settlement.paymentActionPreviousStatus = previous.status;
    this.state.audit.length = keepAuditThrough;
    rollback?.();
    this.record(actor, `settlement.${action}.unknown`, "settlement", settlement.id);
    try {
      await this.checkpointPaymentIntent();
    } catch {
      // The submitted intent was checkpointed before the rail call. Keep that
      // durable record and let the next request reconcile chain state.
    }
    throw new PaymentOutcomeUnknownError();
  }

  private async markPaymentNotSubmitted(
    actor: Actor,
    settlement: Settlement,
    action: NonNullable<Settlement["pendingAction"]>,
    previous: Settlement,
    keepAuditThrough: number,
  ): Promise<never> {
    Object.assign(settlement, previous);
    this.state.audit.length = keepAuditThrough;
    this.record(actor, `settlement.${action}.not_submitted`, "settlement", settlement.id);
    try {
      await this.checkpointPaymentIntent();
    } catch {
      settlement.status = "unknown";
      settlement.pendingAction = action;
      settlement.paymentActionPreviousStatus = previous.status;
      delete settlement.paymentReference;
      this.record(actor, `settlement.${action}.unknown`, "settlement", settlement.id);
      try {
        await this.checkpointPaymentIntent();
      } catch {
        // The previously saved intent remains available for manual reconciliation.
      }
      throw new PaymentOutcomeUnknownError();
    }
    throw new PaymentNotSubmittedError();
  }

  private scopedIdempotencyKey(actor: Actor, key: string | undefined, operation: string) {
    return key ? `${actor.tenantId}:${actor.userId}:${operation}:${key}` : undefined;
  }

  private idempotent<T>(key: string | undefined, action: () => T): T {
    if (!key) return action();
    const existing = this.state.idempotency[key];
    if (existing !== undefined) return structuredClone(existing) as T;
    const result = action();
    this.state.idempotency[key] = structuredClone(result);
    return result;
  }

  private async idempotentAsync<T>(key: string | undefined, action: () => T | Promise<T>): Promise<T> {
    if (key) {
      const existing = this.state.idempotency[key];
      if (existing !== undefined) return structuredClone(existing) as T;
    }
    const result = await action();
    if (key) this.state.idempotency[key] = structuredClone(result);
    return result;
  }

  createTenant(input: { id?: string; name: string; ownerUserId: string; ownerName?: string }) {
    const tenant: Tenant = { id: input.id ?? randomUUID(), name: input.name, createdAt: now() };
    this.state.tenants.push(tenant);
    this.state.memberships.push({
      tenantId: tenant.id,
      userId: input.ownerUserId,
      displayName: input.ownerName ?? input.ownerUserId,
      roles: ["owner", "admin"],
    });
    this.state.tenantSettings.push(defaultTenantSettings(tenant.id));
    return tenant;
  }

  configureTenant(
    actor: Actor,
    input: { timezone?: string; sites?: TenantSite[]; usageReasonCodes?: UsageReasonCode[] },
  ) {
    this.requireTenant(actor, actor.tenantId);
    if (!hasAnyRole(actor, ["owner", "admin"])) throw forbidden("Tenant administrator role required");
    const settings = this.tenantSettings(actor.tenantId);
    if (input.timezone !== undefined) {
      if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(input.timezone)) throw conflict("Timezone must be an IANA name");
      settings.timezone = input.timezone;
    }
    if (input.sites !== undefined) {
      const ids = new Set<string>();
      for (const site of input.sites) {
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(site.id) || !site.name.trim() || ids.has(site.id)) {
          throw conflict("Tenant sites must have unique safe IDs and names");
        }
        ids.add(site.id);
      }
      settings.sites = structuredClone(input.sites);
    }
    if (input.usageReasonCodes !== undefined) {
      const codes = new Set<string>();
      for (const reason of input.usageReasonCodes) {
        if (!/^[a-z][a-z0-9-]{1,31}$/.test(reason.code) || !reason.label.trim() || codes.has(reason.code) || reason.kinds.length === 0) {
          throw conflict("Usage reason codes must be unique, safe, and non-empty");
        }
        codes.add(reason.code);
      }
      settings.usageReasonCodes = structuredClone(input.usageReasonCodes);
    }
    this.record(actor, "tenant.settings.updated", "tenant", actor.tenantId);
    return structuredClone(settings);
  }

  tenantSettings(tenantId: string) {
    const settings = this.state.tenantSettings.find((candidate) => candidate.tenantId === tenantId);
    if (!settings) throw notFound("Tenant settings not found");
    return settings;
  }

  listTenantSettings(actor: Actor) {
    this.requireTenant(actor, actor.tenantId);
    return structuredClone(this.tenantSettings(actor.tenantId));
  }

  addMembership(input: { tenantId: string; userId: string; displayName: string; roles: Role[] }) {
    if (!this.state.tenants.some((tenant) => tenant.id === input.tenantId)) throw notFound("Tenant not found");
    const membership: Membership = { ...input };
    this.state.memberships.push(membership);
    return membership;
  }

  actor(tenantId: string, userId: string): Actor {
    const membership = this.state.memberships.find(
      (candidate) => candidate.tenantId === tenantId && candidate.userId === userId,
    );
    if (!membership) throw forbidden("Membership not found");
    return { tenantId, userId, roles: membership.roles };
  }

  createCollaborationGrant(
    actor: Actor,
    input: { receivingTenantId: string; purchaseOrderId: string; actions: CollaborationGrant["actions"] },
    idempotencyKey?: string,
  ) {
    return this.idempotent(this.scopedIdempotencyKey(actor, idempotencyKey, "collaboration.grant"), () => {
      const po = this.getPO(input.purchaseOrderId);
      this.requireTenant(actor, po.tenantId);
      if (!hasAnyRole(actor, ["owner", "admin", "procurement"])) throw forbidden("Only buyer administrators can grant access");
      if (po.supplierTenantId !== input.receivingTenantId) throw conflict("Grant recipient is not the PO supplier");
      if (!this.state.tenants.some((tenant) => tenant.id === input.receivingTenantId)) throw notFound("Grant recipient tenant not found");
      if (input.actions.length === 0 || input.actions.some((action) => !["view", "acknowledge", "submit_evidence", "respond"].includes(action))) {
        throw conflict("Grant must include at least one supported action");
      }
      const grant: CollaborationGrant = {
        id: randomUUID(),
        grantingTenantId: po.tenantId,
        receivingTenantId: input.receivingTenantId,
        resourceType: "purchase_order",
        resourceId: po.id,
        actions: input.actions,
        status: "active",
        createdAt: now(),
      };
      this.state.grants.push(grant);
      this.record(actor, "collaboration.grant.created", "purchase_order", po.id);
      return grant;
    });
  }

  createProduct(actor: Actor, input: Omit<Product, "id" | "tenantId">) {
    this.requireTenant(actor, actor.tenantId);
    if (!hasAnyRole(actor, ["owner", "admin", "procurement"])) throw forbidden("Product management is restricted");
    const product: Product = { ...input, id: randomUUID(), tenantId: actor.tenantId };
    this.state.products.push(product);
    this.record(actor, "product.created", "product", product.id);
    return product;
  }

  createPurchaseOrder(actor: Actor, input: CreatePOInput, idempotencyKey?: string) {
    return this.idempotent(this.scopedIdempotencyKey(actor, idempotencyKey, "purchase-order.create"), () => {
      this.requireTenant(actor, actor.tenantId);
      if (!hasAnyRole(actor, ["owner", "admin", "procurement"])) throw forbidden("Only procurement can create a PO");
      if (!this.state.tenants.some((tenant) => tenant.id === input.supplierTenantId)) throw notFound("Supplier tenant not found");
      const product = this.state.products.find(
        (candidate) => candidate.id === input.productId && candidate.tenantId === actor.tenantId,
      );
      if (!product) throw notFound("Product not found");
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw conflict("Quantity must be a positive integer");
      if (!/^[0-9]+$/.test(input.amountBaseUnits)) throw conflict("Settlement amount must be a positive integer");
      const amount = BigInt(input.amountBaseUnits);
      if (amount <= 0n) throw conflict("Settlement amount must be positive");
      const maxTelemetryGapSeconds = input.policy?.maxTelemetryGapSeconds;
      if (!Number.isInteger(maxTelemetryGapSeconds) || (maxTelemetryGapSeconds ?? 0) <= 0) {
        throw conflict("A positive product-specific maximum telemetry gap in seconds is required");
      }
      const minQuantity = input.policy?.minQuantity ?? input.quantity;
      const maxQuantity = input.policy?.maxQuantity ?? input.quantity;
      const minShelfLifeDays = input.policy?.minShelfLifeDays ?? product.minimumShelfLifeDays;
      const minTemperatureCelsius = input.policy?.minTemperatureCelsius ?? product.storageMinCelsius;
      const maxTemperatureCelsius = input.policy?.maxTemperatureCelsius ?? product.storageMaxCelsius;
      const requiredDocuments = input.policy?.requiredDocuments ?? product.requiredDocuments;
      if (!Number.isInteger(minQuantity) || minQuantity <= 0 || !Number.isInteger(maxQuantity) || maxQuantity < input.quantity || minQuantity > input.quantity) {
        throw conflict("Purchase-order quantity limits must be positive whole numbers and include the ordered quantity");
      }
      if (!Number.isInteger(minShelfLifeDays) || minShelfLifeDays < 0) throw conflict("Minimum shelf life must be a non-negative whole number of days");
      if (!Number.isFinite(minTemperatureCelsius) || !Number.isFinite(maxTemperatureCelsius) || minTemperatureCelsius > maxTemperatureCelsius) {
        throw conflict("Temperature limits must be finite and ordered");
      }
      if (!Array.isArray(requiredDocuments) || requiredDocuments.some((document) => typeof document !== "string" || !document.trim())) {
        throw conflict("Required document names must be non-empty strings");
      }
      if (input.policy?.allowAdjustmentBps !== undefined && typeof input.policy.allowAdjustmentBps !== "boolean") {
        throw conflict("Adjustment authority must be explicitly true or false");
      }
      const policy: AcceptancePolicy = {
        version: 1,
        productId: product.id,
        minQuantity,
        maxQuantity,
        minShelfLifeDays,
        minTemperatureCelsius,
        maxTemperatureCelsius,
        maxTelemetryGapSeconds: maxTelemetryGapSeconds!,
        requiredDocuments,
        allowAdjustmentBps: input.policy?.allowAdjustmentBps ?? false,
      };
      const termsNonce = randomUUID();
      const termsHash = hashCommitment({
        domain: "nischit.purchase-order.terms",
        version: 1,
        nonce: termsNonce,
        buyerTenantId: actor.tenantId,
        supplierTenantId: input.supplierTenantId,
        productId: product.id,
        quantity: input.quantity,
        unit: product.baseUnit,
        amountBaseUnits: input.amountBaseUnits,
        token: input.token,
        policy,
      });
      const po: PurchaseOrder = {
        id: randomUUID(),
        tenantId: actor.tenantId,
        supplierTenantId: input.supplierTenantId,
        productId: product.id,
        quantity: input.quantity,
        unit: product.baseUnit,
        amountBaseUnits: amount,
        token: input.token,
        settlementReference: `nsc_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
        policy,
        termsHash,
        termsNonce,
        status: "draft",
        createdAt: now(),
      };
      this.state.purchaseOrders.push(po);
      this.state.settlements.push({
        id: randomUUID(),
        purchaseOrderId: po.id,
        amountBaseUnits: amount,
        adjustmentBps: 0,
        supplierAmountBaseUnits: amount,
        buyerCreditBaseUnits: 0n,
        status: "draft",
      });
      this.record(actor, "purchase_order.created", "purchase_order", po.id);
      return po;
    });
  }

  acknowledgePurchaseOrder(actor: Actor, purchaseOrderId: string, idempotencyKey?: string) {
    return this.idempotent(this.scopedIdempotencyKey(actor, idempotencyKey, "purchase-order.acknowledge"), () => {
      const po = this.getPO(purchaseOrderId);
      if (actor.tenantId !== po.supplierTenantId) throw forbidden("Only the supplier tenant can acknowledge");
      this.grantFor(actor, po, "acknowledge");
      if (po.status !== "draft") throw conflict("Purchase order is not awaiting acknowledgement");
      po.status = "acknowledged";
      po.acknowledgedAt = now();
      this.record(actor, "purchase_order.acknowledged", "purchase_order", po.id);
      return po;
    });
  }

  async fundPurchaseOrder(actor: Actor, purchaseOrderId: string, idempotencyKey?: string) {
    return this.idempotentAsync(this.scopedIdempotencyKey(actor, idempotencyKey, "purchase-order.fund"), async () => {
      const po = this.getPO(purchaseOrderId);
      this.requireTenant(actor, po.tenantId);
      if (!hasAnyRole(actor, ["owner", "admin", "finance"])) throw forbidden("Only finance can fund a PO");
      if (po.status !== "acknowledged") throw conflict("Supplier must acknowledge the agreed terms before funding");
      const settlement = this.getSettlement(po.id);
      if (settlement.status === "unknown" || settlement.status === "submitted") {
        if (await this.reconcilePendingPayment(actor, po, settlement, "fund")) return settlement;
      }
      if (settlement.status !== "draft") throw conflict("Settlement is not awaiting funding");
      const previous = structuredClone(settlement);
      await this.beginPaymentAction(actor, settlement, "fund");
      const keepAuditThrough = this.state.audit.length;
      try {
        const funded = await this.paymentRail.fund({
          purchaseOrder: po,
          onSubmitted: (reference) => this.paymentSubmitted(settlement, reference),
        });
        await this.paymentSubmitted(settlement, funded.paymentReference);
        this.completePaymentAction(settlement, "fund", funded.paymentReference);
        po.status = "funded";
        this.record(actor, "settlement.funded", "settlement", settlement.id);
        await this.checkpointPaymentIntent();
        return settlement;
      } catch (error) {
        if (error instanceof PaymentNotSubmittedError) {
          return this.markPaymentNotSubmitted(actor, settlement, "fund", previous, keepAuditThrough);
        }
        return this.markPaymentUnknown(actor, settlement, "fund", previous, keepAuditThrough, () => { po.status = "acknowledged"; });
      }
    });
  }

  declareShipment(actor: Actor, input: DeclareShipmentInput, idempotencyKey?: string) {
    return this.idempotent(this.scopedIdempotencyKey(actor, idempotencyKey, "shipment.declare"), () => {
      const po = this.getPO(input.purchaseOrderId);
      if (actor.tenantId !== po.supplierTenantId) throw forbidden("Only the supplier can declare a shipment");
      this.grantFor(actor, po, "submit_evidence");
      if (!["funded", "in_transit"].includes(po.status)) throw conflict("PO is not funded for shipment");
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw conflict("Shipment quantity must be a positive integer");
      if (input.quantity < po.policy.minQuantity || input.quantity > po.policy.maxQuantity) {
        throw conflict("Shipment quantity is outside the agreed policy");
      }
      const expiry = new Date(input.expiryDate);
      if (Number.isNaN(expiry.valueOf())) throw conflict("Expiry date is invalid");
      const lot: Lot = {
        id: randomUUID(),
        tenantId: po.supplierTenantId,
        productId: po.productId,
        manufacturerLotNumber: input.manufacturerLotNumber,
        expiryDate: input.expiryDate,
        quantity: input.quantity,
        unit: po.unit,
      };
      const shipment: Shipment = {
        id: randomUUID(),
        tenantId: po.supplierTenantId,
        supplierTenantId: po.supplierTenantId,
        purchaseOrderId: po.id,
        lotId: lot.id,
        quantity: input.quantity,
        dispatchedAt: now(),
        status: "in_transit",
      };
      this.state.lots.push(lot);
      this.state.shipments.push(shipment);
      po.status = "in_transit";
      this.record(actor, "shipment.declared", "shipment", shipment.id);
      return { lot, shipment };
    });
  }

  submitConditionEvidence(actor: Actor, input: SubmitEvidenceInput, idempotencyKey?: string) {
    return this.idempotent(this.scopedIdempotencyKey(actor, idempotencyKey, "shipment.evidence"), () => {
      const shipment = this.state.shipments.find((candidate) => candidate.id === input.shipmentId);
      if (!shipment) throw notFound("Shipment not found");
      const po = this.getPO(shipment.purchaseOrderId);
      if (actor.tenantId !== po.supplierTenantId) throw forbidden("Only the supplier can submit evidence");
      this.grantFor(actor, po, "submit_evidence");
      const expiry = this.state.lots.find((lot) => lot.id === shipment.lotId)?.expiryDate;
      if (!expiry) throw notFound("Lot not found");
      const report = createConditionReport({
        id: randomUUID(),
        shipmentId: shipment.id,
        readings: input.readings,
        documents: input.documents,
        policy: po.policy,
        createdAt: now(),
      });
      const existingReceipt = this.state.receipts.find((receipt) => receipt.shipmentId === shipment.id);
      assessConditionCoverage(report, po.policy, shipment, expiry, existingReceipt?.receivedAt);
      this.state.conditionReports.push(report);
      this.record(actor, "condition.evidence.submitted", "condition_report", report.id, { status: report.status });
      return report;
    });
  }

  receiveShipment(actor: Actor, input: { shipmentId: string; receivedQuantity: number; siteId: string }, idempotencyKey?: string) {
    return this.idempotent(this.scopedIdempotencyKey(actor, idempotencyKey, "shipment.receive"), () => {
      const shipment = this.state.shipments.find((candidate) => candidate.id === input.shipmentId);
      if (!shipment) throw notFound("Shipment not found");
      const po = this.getPO(shipment.purchaseOrderId);
      this.requireTenant(actor, po.tenantId);
      if (!hasAnyRole(actor, ["owner", "admin", "receiving"])) throw forbidden("Receiving role required");
      this.ensureSiteAllowed(actor.tenantId, input.siteId);
      if (this.state.receipts.some((candidate) => candidate.shipmentId === shipment.id)) throw conflict("Shipment has already been received");
      if (input.receivedQuantity <= 0 || input.receivedQuantity > shipment.quantity) throw conflict("Received quantity is invalid");
      const receipt: GoodsReceipt = {
        id: randomUUID(),
        tenantId: actor.tenantId,
        purchaseOrderId: po.id,
        shipmentId: shipment.id,
        siteId: input.siteId,
        receivedQuantity: input.receivedQuantity,
        status: "pending_qa",
        receivedAt: now(),
        receivedBy: actor.userId,
      };
      this.state.receipts.push(receipt);
      shipment.status = "received";
      po.status = "received";
      const settlement = this.getSettlement(po.id);
      settlement.status = "awaiting_qa";
      const conditionReport = [...this.state.conditionReports].reverse().find((report) => report.shipmentId === shipment.id);
      if (conditionReport) {
        const expiry = this.state.lots.find((lot) => lot.id === shipment.lotId)?.expiryDate;
        if (!expiry) throw notFound("Lot not found");
        assessConditionCoverage(conditionReport, po.policy, shipment, expiry, receipt.receivedAt);
      }
      this.record(actor, "goods_receipt.created", "goods_receipt", receipt.id, { siteId: input.siteId });
      return receipt;
    });
  }

  decideQA(
    actor: Actor,
    input: { receiptId: string; status: Extract<QAStatus, "accepted" | "accepted_with_adjustment" | "held" | "rejected">; reason: string; adjustmentBps?: number; siteId: string },
    idempotencyKey?: string,
  ) {
    return this.idempotent(this.scopedIdempotencyKey(actor, idempotencyKey, "receipt.qa"), () => {
      const receipt = this.state.receipts.find((candidate) => candidate.id === input.receiptId);
      if (!receipt) throw notFound("Goods receipt not found");
      this.requireTenant(actor, receipt.tenantId);
      if (!hasAnyRole(actor, ["owner", "admin", "qa"])) throw forbidden("QA role required");
      this.ensureSiteAllowed(actor.tenantId, input.siteId);
      if (input.siteId !== receipt.siteId) throw conflict("QA site must match the goods receipt site");
      if (this.state.qaDecisions.some((candidate) => candidate.receiptId === receipt.id)) throw conflict("QA decision already recorded");
      if (!input.reason.trim()) throw conflict("QA reason is required");
      const report = [...this.state.conditionReports].reverse().find((candidate) => {
        const shipment = this.state.shipments.find((item) => item.id === candidate.shipmentId);
        return shipment?.id === receipt.shipmentId;
      });
      if (!report) throw conflict("Condition evidence is required before QA");
      const po = this.getPO(receipt.purchaseOrderId);
      const adjustmentBps = input.adjustmentBps ?? 0;
      if (!Number.isInteger(adjustmentBps) || adjustmentBps < 0 || adjustmentBps > 10_000) {
        throw conflict("Adjustment must be a whole number between 0 and 10000 bps");
      }
      if (input.status === "accepted_with_adjustment" && adjustmentBps === 0) throw conflict("Adjustment decision requires a non-zero adjustment");
      if (input.status === "accepted" && adjustmentBps !== 0) throw conflict("Accepted decision cannot carry an adjustment");
      if (input.status === "accepted_with_adjustment" && !po.policy.allowAdjustmentBps) {
        throw conflict("The agreed purchase-order policy does not allow an adjustment");
      }
      if (input.status !== "accepted_with_adjustment" && adjustmentBps !== 0) {
        throw conflict("Only an accepted-with-adjustment decision can carry an adjustment");
      }
      const decision: QADecision = {
        id: randomUUID(),
        receiptId: receipt.id,
        status: input.status,
        reason: input.reason,
        adjustmentBps,
        evidenceHash: hashCommitment({ report, status: input.status, reason: input.reason, adjustmentBps }),
        decidedBy: actor.userId,
        decidedAt: now(),
      };
      this.state.qaDecisions.push(decision);
      receipt.status = input.status;
      receipt.acceptedQuantity = ["accepted", "accepted_with_adjustment"].includes(input.status) ? receipt.receivedQuantity : 0;
      receipt.rejectedQuantity = input.status === "rejected" ? receipt.receivedQuantity : 0;
      const settlement = this.getSettlement(receipt.purchaseOrderId);
      settlement.adjustmentBps = adjustmentBps;
      const buyerCredit = (settlement.amountBaseUnits * BigInt(adjustmentBps)) / 10_000n;
      settlement.buyerCreditBaseUnits = buyerCredit;
      settlement.supplierAmountBaseUnits = settlement.amountBaseUnits - buyerCredit;
      settlement.status = input.status === "accepted" || input.status === "accepted_with_adjustment" ? "authorized" : "held";
      if (input.status === "accepted" || input.status === "accepted_with_adjustment") {
        const shipment = this.state.shipments.find((candidate) => candidate.id === receipt.shipmentId)!;
        const lot = this.state.lots.find((candidate) => candidate.id === shipment.lotId)!;
        this.applyInventoryEvent(actor, {
          lotId: lot.id,
          siteId: input.siteId,
          kind: "receipt",
          quantity: receipt.receivedQuantity,
          unit: lot.unit,
          sourceId: receipt.id,
          reason: "Accepted into pending usable stock",
        });
      }
      this.record(actor, "qa.decision.recorded", "qa_decision", decision.id, { status: input.status, adjustmentBps });
      return decision;
    });
  }

  async settle(actor: Actor, purchaseOrderId: string, idempotencyKey?: string) {
    return this.idempotentAsync(this.scopedIdempotencyKey(actor, idempotencyKey, "settlement.settle"), async () => {
      const po = this.getPO(purchaseOrderId);
      this.requireTenant(actor, po.tenantId);
      if (!hasAnyRole(actor, ["owner", "admin", "finance"])) throw forbidden("Finance role required");
      const settlement = this.getSettlement(po.id);
      if (settlement.status === "unknown" || settlement.status === "submitted") {
        if (await this.reconcilePendingPayment(actor, po, settlement, "settle")) return settlement;
      }
      if (settlement.status !== "authorized") throw conflict("Settlement is not authorized");
      if (this.purchaseOrderHasActiveRecall(po.id)) throw conflict("Settlement is blocked by an active recall");
      const previous = structuredClone(settlement);
      await this.beginPaymentAction(actor, settlement, "settle");
      const keepAuditThrough = this.state.audit.length;
      try {
        const payment = await this.paymentRail.settle({
          purchaseOrder: po,
          settlement,
          supplierTenantId: po.supplierTenantId,
          onSubmitted: (reference) => this.paymentSubmitted(settlement, reference),
        });
        await this.paymentSubmitted(settlement, payment.paymentReference);
        this.completePaymentAction(settlement, "settle", payment.paymentReference);
        this.record(actor, "settlement.confirmed", "settlement", settlement.id);
        await this.checkpointPaymentIntent();
        return settlement;
      } catch (error) {
        if (error instanceof PaymentNotSubmittedError) {
          return this.markPaymentNotSubmitted(actor, settlement, "settle", previous, keepAuditThrough);
        }
        return this.markPaymentUnknown(actor, settlement, "settle", previous, keepAuditThrough);
      }
    });
  }

  async reconcileSettlementPayment(actor: Actor, purchaseOrderId: string) {
    const po = this.getPO(purchaseOrderId);
    this.requireTenant(actor, po.tenantId);
    if (!hasAnyRole(actor, ["owner", "admin", "finance"])) throw forbidden("Finance role required");
    const settlement = this.getSettlement(po.id);
    if (settlement.status !== "unknown" && settlement.status !== "submitted") {
      throw conflict("There is no unresolved payment action for this purchase order");
    }
    if (!settlement.pendingAction) throw conflict("Payment action details are missing; manual reconciliation is required");
    await this.reconcilePendingPayment(actor, po, settlement, settlement.pendingAction);
    return settlement;
  }

  async refund(actor: Actor, purchaseOrderId: string, reason: string, idempotencyKey?: string) {
    return this.idempotentAsync(this.scopedIdempotencyKey(actor, idempotencyKey, "settlement.refund"), async () => {
      const po = this.getPO(purchaseOrderId);
      this.requireTenant(actor, po.tenantId);
      if (!hasAnyRole(actor, ["owner", "admin", "finance"])) throw forbidden("Finance role required");
      const settlement = this.getSettlement(po.id);
      if (settlement.status === "unknown" || settlement.status === "submitted") {
        if (await this.reconcilePendingPayment(actor, po, settlement, "refund")) return settlement;
      }
      if (!["funded", "awaiting_qa", "held", "authorized"].includes(settlement.status)) throw conflict("Settlement cannot be refunded");
      if (!reason.trim()) throw conflict("Refund reason is required");
      const previous = structuredClone(settlement);
      await this.beginPaymentAction(actor, settlement, "refund", { reason });
      const keepAuditThrough = this.state.audit.length;
      try {
        const payment = await this.paymentRail.refund({
          purchaseOrder: po,
          settlement,
          onSubmitted: (reference) => this.paymentSubmitted(settlement, reference),
        });
        await this.paymentSubmitted(settlement, payment.paymentReference);
        this.completePaymentAction(settlement, "refund", payment.paymentReference);
        this.record(actor, "settlement.refunded", "settlement", settlement.id, { reason });
        await this.checkpointPaymentIntent();
        return settlement;
      } catch (error) {
        if (error instanceof PaymentNotSubmittedError) {
          return this.markPaymentNotSubmitted(actor, settlement, "refund", previous, keepAuditThrough);
        }
        return this.markPaymentUnknown(actor, settlement, "refund", previous, keepAuditThrough);
      }
    });
  }

  recordUsage(
    actor: Actor,
    input: { lotId: string; siteId: string; kind: Extract<InventoryEventKind, "consume_test" | "consume_qc" | "training" | "waste" | "disposal">; quantity: number; unit: Lot["unit"]; sourceId: string; reason?: string; reasonCode?: string },
    idempotencyKey?: string,
  ) {
    return this.idempotent(this.scopedIdempotencyKey(actor, idempotencyKey, "inventory.usage"), () => {
      this.requireTenant(actor, actor.tenantId);
      if (!hasAnyRole(actor, ["owner", "admin", "receiving", "qa"])) throw forbidden("Inventory role required");
      this.ensureSiteAllowed(actor.tenantId, input.siteId);
      const lot = this.findLotVisibleToTenant(input.lotId, actor.tenantId);
      if (!lot) throw notFound("Lot not found in active tenant");
      if (this.lotHasActiveRecall(lot.id)) throw conflict("Usage is blocked by an active recall");
      if (new Date(lot.expiryDate).valueOf() <= Date.now()) throw conflict("Expired lot cannot be used");
      if (lot.unit !== input.unit) throw conflict("Inventory event unit does not match the lot");
      if (input.quantity <= 0) throw conflict("Inventory quantity must be positive");
      this.ensureReasonCodeAllowed(actor.tenantId, input.kind, input.reasonCode);
      const holding = this.getHolding(actor.tenantId, lot.id, input.siteId, lot.unit);
      const existing = this.existingInventoryEvent(actor.tenantId, input.sourceId);
      if (existing) {
        if (existing.lotId !== lot.id || existing.siteId !== input.siteId || existing.quantity !== input.quantity || existing.kind !== input.kind) {
          throw conflict("Inventory sourceId has already been used for a different event");
        }
        return existing;
      }
      if (holding.usable < input.quantity) throw conflict("Insufficient usable stock");
      return this.applyInventoryEvent(actor, input);
    });
  }

  recordOpening(
    actor: Actor,
    input: { lotId: string; siteId: string; quantity: number; unit: Lot["unit"]; sourceId: string; reason?: string },
    idempotencyKey?: string,
  ) {
    return this.idempotent(this.scopedIdempotencyKey(actor, idempotencyKey, "inventory.opening"), () => {
      this.requireTenant(actor, actor.tenantId);
      if (!hasAnyRole(actor, ["owner", "admin", "receiving", "qa"])) throw forbidden("Inventory role required");
      this.ensureSiteAllowed(actor.tenantId, input.siteId);
      if (!input.reason?.trim()) throw conflict("Opening reason is required");
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw conflict("Opening quantity must be a positive integer");
      const lot = this.findLotVisibleToTenant(input.lotId, actor.tenantId);
      if (!lot) throw notFound("Lot not found");
      if (lot.unit !== input.unit) throw conflict("Inventory event unit does not match the lot");
      const existing = this.existingInventoryEvent(actor.tenantId, input.sourceId);
      if (existing) return existing;
      const holding = this.getHolding(actor.tenantId, lot.id, input.siteId, lot.unit);
      if (holding.usable < input.quantity) throw conflict("Insufficient usable stock to open");
      return this.applyInventoryEvent(actor, { ...input, lotId: lot.id, kind: "opening" });
    });
  }

  recordCorrection(
    actor: Actor,
    input: { lotId: string; siteId: string; quantity: number; unit: Lot["unit"]; sourceId: string; reason: string },
    idempotencyKey?: string,
  ) {
    return this.idempotent(this.scopedIdempotencyKey(actor, idempotencyKey, "inventory.correction"), () => {
      this.requireTenant(actor, actor.tenantId);
      if (!hasAnyRole(actor, ["owner", "admin", "qa"])) throw forbidden("QA or administrator role required");
      this.ensureSiteAllowed(actor.tenantId, input.siteId);
      if (!input.reason.trim()) throw conflict("Correction reason is required");
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw conflict("Correction quantity must be a positive integer");
      const lot = this.findLotVisibleToTenant(input.lotId, actor.tenantId);
      if (!lot) throw notFound("Lot not found");
      if (lot.unit !== input.unit) throw conflict("Inventory event unit does not match the lot");
      const existing = this.existingInventoryEvent(actor.tenantId, input.sourceId);
      if (existing) return existing;
      return this.applyInventoryEvent(actor, { ...input, lotId: lot.id, kind: "correction" });
    });
  }

  quarantineLot(actor: Actor, input: { lotId: string; siteId: string; quantity?: number; reason: string }, idempotencyKey?: string) {
    return this.idempotent(this.scopedIdempotencyKey(actor, idempotencyKey, "inventory.quarantine"), () => {
      this.requireTenant(actor, actor.tenantId);
      if (!hasAnyRole(actor, ["owner", "admin", "qa"])) throw forbidden("QA role required");
      this.ensureSiteAllowed(actor.tenantId, input.siteId);
      if (!input.reason.trim()) throw conflict("Quarantine reason is required");
      const lot = this.findLotVisibleToTenant(input.lotId, actor.tenantId);
      if (!lot) throw notFound("Lot not found");
      const holding = this.getHolding(actor.tenantId, lot.id, input.siteId, lot.unit);
      const quantity = input.quantity ?? holding.usable;
      if (quantity <= 0 || quantity > holding.usable) throw conflict("Quarantine quantity is invalid");
      const event = this.applyInventoryEvent(actor, {
        lotId: lot.id,
        siteId: input.siteId,
        kind: "quarantine",
        quantity,
        unit: lot.unit,
        sourceId: `quarantine:${randomUUID()}`,
        reason: input.reason,
      });
      const recall: Recall = {
        id: randomUUID(),
        tenantId: actor.tenantId,
        lotId: lot.id,
        reason: input.reason,
        status: "active",
        createdAt: now(),
        createdBy: actor.userId,
      };
      this.state.recalls.push(recall);
      this.record(actor, "recall.created", "recall", recall.id);
      return { event, recall };
    });
  }

  transferInventory(
    actor: Actor,
    input: { lotId: string; fromSiteId: string; toSiteId: string; quantity: number; unit: Lot["unit"]; sourceId: string; reason?: string },
    idempotencyKey?: string,
  ) {
    return this.idempotent(this.scopedIdempotencyKey(actor, idempotencyKey, "inventory.transfer"), () => {
      this.requireTenant(actor, actor.tenantId);
      if (!hasAnyRole(actor, ["owner", "admin", "receiving", "qa"])) throw forbidden("Inventory role required");
      this.ensureSiteAllowed(actor.tenantId, input.fromSiteId);
      this.ensureSiteAllowed(actor.tenantId, input.toSiteId);
      if (!input.fromSiteId || !input.toSiteId || input.fromSiteId === input.toSiteId) throw conflict("Transfer sites must be distinct");
      if (!input.sourceId.trim()) throw conflict("Transfer sourceId is required");
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw conflict("Transfer quantity must be a positive integer");
      const lot = this.findLotVisibleToTenant(input.lotId, actor.tenantId);
      if (!lot) throw notFound("Lot not found in active tenant");
      if (lot.unit !== input.unit) throw conflict("Inventory event unit does not match the lot");
      if (this.lotHasActiveRecall(lot.id)) throw conflict("Transfer is blocked by an active recall");
      const source = this.getHolding(actor.tenantId, lot.id, input.fromSiteId, lot.unit);
      if (source.usable < input.quantity) throw conflict("Insufficient usable stock to transfer");
      const transferOut = this.applyInventoryEvent(actor, {
        lotId: lot.id,
        siteId: input.fromSiteId,
        kind: "transfer_out",
        quantity: input.quantity,
        unit: lot.unit,
        sourceId: `${input.sourceId}:out`,
        reason: input.reason,
      });
      const transferIn = this.applyInventoryEvent(actor, {
        lotId: lot.id,
        siteId: input.toSiteId,
        kind: "transfer_in",
        quantity: input.quantity,
        unit: lot.unit,
        sourceId: `${input.sourceId}:in`,
        reason: input.reason,
      });
      return { transferOut, transferIn };
    });
  }

  releaseRecall(
    actor: Actor,
    input: { recallId: string; lotId: string; siteId: string; quantity: number; reason: string },
    idempotencyKey?: string,
  ) {
    return this.idempotent(this.scopedIdempotencyKey(actor, idempotencyKey, "inventory.release-recall"), () => {
      this.requireTenant(actor, actor.tenantId);
      if (!hasAnyRole(actor, ["owner", "admin", "qa"])) throw forbidden("QA role required");
      this.ensureSiteAllowed(actor.tenantId, input.siteId);
      if (!input.reason.trim()) throw conflict("Recall release reason is required");
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) throw conflict("Recall release quantity must be a positive integer");
      const recall = this.state.recalls.find((candidate) => candidate.id === input.recallId && candidate.tenantId === actor.tenantId);
      if (!recall) throw notFound("Recall not found");
      if (recall.status !== "active") throw conflict("Recall is already cleared");
      if (recall.lotId !== input.lotId) throw conflict("Recall does not apply to this lot");
      const lot = this.findLotVisibleToTenant(input.lotId, actor.tenantId);
      if (!lot) throw notFound("Lot not found in active tenant");
      const event = this.applyInventoryEvent(actor, {
        lotId: lot.id,
        siteId: input.siteId,
        kind: "release_quarantine",
        quantity: input.quantity,
        unit: lot.unit,
        sourceId: `recall-release:${recall.id}:${input.siteId}:${input.quantity}`,
        reason: input.reason,
      });
      const remaining = this.state.holdings.some((holding) => holding.lotId === lot.id && holding.quarantined > 0);
      if (!remaining) recall.status = "cleared";
      this.record(actor, "recall.cleared", "recall", recall.id, { quantity: input.quantity, siteId: input.siteId });
      return { event, recall };
    });
  }

  getHolding(tenantId: string, lotId: string, siteId: string, unit: Holding["unit"]) {
    let holding = this.state.holdings.find(
      (candidate) =>
        candidate.tenantId === tenantId && candidate.lotId === lotId && candidate.siteId === siteId && candidate.unit === unit,
    );
    if (!holding) {
      holding = { tenantId, lotId, siteId, unit, onHand: 0, quarantined: 0, usable: 0 };
      this.state.holdings.push(holding);
    }
    return holding;
  }

  private findLotVisibleToTenant(lotId: string, tenantId: string) {
    const lot = this.state.lots.find((candidate) => candidate.id === lotId);
    if (!lot) return undefined;
    if (lot.tenantId === tenantId) return lot;
    const receivedForTenant = this.state.shipments.some((shipment) => {
      if (shipment.lotId !== lotId) return false;
      return this.state.purchaseOrders.some((po) => po.id === shipment.purchaseOrderId && po.tenantId === tenantId);
    });
    return receivedForTenant ? lot : undefined;
  }

  private lotHasActiveRecall(lotId: string) {
    return this.state.recalls.some((recall) => recall.lotId === lotId && recall.status === "active");
  }

  private purchaseOrderHasActiveRecall(purchaseOrderId: string) {
    const lotIds = this.state.shipments
      .filter((shipment) => shipment.purchaseOrderId === purchaseOrderId)
      .map((shipment) => shipment.lotId);
    return lotIds.some((lotId) => this.lotHasActiveRecall(lotId));
  }

  private applyInventoryEvent(actor: Actor, input: Omit<InventoryEvent, "id" | "tenantId" | "createdAt" | "createdBy">) {
    const holding = this.getHolding(actor.tenantId, input.lotId, input.siteId, input.unit);
    const negativeKinds: InventoryEventKind[] = ["consume_test", "consume_qc", "training", "waste", "disposal"];
    if (negativeKinds.includes(input.kind)) {
      if (holding.usable < input.quantity) throw conflict("Insufficient usable stock");
      holding.usable -= input.quantity;
      holding.onHand -= input.quantity;
    } else if (input.kind === "quarantine") {
      if (holding.usable < input.quantity) throw conflict("Insufficient usable stock to quarantine");
      holding.usable -= input.quantity;
      holding.quarantined += input.quantity;
    } else if (input.kind === "release_quarantine") {
      if (holding.quarantined < input.quantity) throw conflict("Insufficient quarantined stock");
      holding.quarantined -= input.quantity;
      holding.usable += input.quantity;
    } else if (input.kind === "receipt" || input.kind === "transfer_in" || input.kind === "correction") {
      holding.onHand += input.quantity;
      holding.usable += input.quantity;
    } else if (input.kind === "transfer_out") {
      if (holding.usable < input.quantity) throw conflict("Insufficient usable stock to transfer");
      holding.onHand -= input.quantity;
      holding.usable -= input.quantity;
    } else if (input.kind === "opening") {
      if (holding.usable < input.quantity) throw conflict("Cannot open more than usable stock");
    }
    if (holding.onHand < 0 || holding.usable < 0 || holding.quarantined < 0) throw new DomainError("Inventory conservation failed", "INVARIANT_VIOLATION", 500);
    const event: InventoryEvent = { ...input, id: randomUUID(), tenantId: actor.tenantId, createdAt: now(), createdBy: actor.userId };
    this.state.inventoryEvents.push(event);
    this.record(actor, `inventory.${input.kind}`, "lot", input.lotId, { quantity: input.quantity, siteId: input.siteId });
    return event;
  }

  async publishVerification(actor: Actor, purchaseOrderId: string, idempotencyKey?: string) {
    return this.idempotentAsync(this.scopedIdempotencyKey(actor, idempotencyKey, "verification.publish"), async () => {
      const po = this.getPO(purchaseOrderId);
      this.requireTenant(actor, po.tenantId);
      if (!hasAnyRole(actor, ["owner", "admin", "qa", "auditor", "finance"])) throw forbidden("Verification access is restricted");
      const report = this.state.conditionReports.find((candidate) => {
        const shipment = this.state.shipments.find((item) => item.id === candidate.shipmentId);
        return shipment?.purchaseOrderId === po.id;
      });
      const decision = this.state.qaDecisions.find((candidate) => {
        const receipt = this.state.receipts.find((item) => item.id === candidate.receiptId);
        return receipt?.purchaseOrderId === po.id;
      });
      const settlement = this.getSettlement(po.id);
      const result = await this.attestationRail.publish({
        purchaseOrderId: po.id,
        settlementReference: po.settlementReference,
        termsHash: po.termsHash,
        conditionReportHash: report?.readingsHash,
        qaDecisionHash: decision?.evidenceHash,
        paymentReference: settlement.paymentReference,
      });
      this.state.verificationSignatures[po.id] = result.signature;
      this.record(actor, "verification.receipt.published", "purchase_order", po.id);
      return {
        purchaseOrderId: po.id,
        settlementReference: po.settlementReference,
        termsHash: po.termsHash,
        conditionReportHash: report?.readingsHash,
        qaDecisionHash: decision?.evidenceHash,
        paymentReference: settlement.paymentReference,
        paymentStatus: settlement.status,
        solanaReceiptSignature: result.signature,
      } satisfies PublicVerification;
    });
  }

  publicVerification(purchaseOrderId: string): PublicVerification {
    const po = this.getPO(purchaseOrderId);
    const report = this.state.conditionReports.find((candidate) => this.state.shipments.find((item) => item.id === candidate.shipmentId)?.purchaseOrderId === po.id);
    const decision = this.state.qaDecisions.find((candidate) => this.state.receipts.find((item) => item.id === candidate.receiptId)?.purchaseOrderId === po.id);
    const settlement = this.getSettlement(po.id);
    return {
      purchaseOrderId: po.id,
      settlementReference: po.settlementReference,
      termsHash: po.termsHash,
      conditionReportHash: report?.readingsHash,
      qaDecisionHash: decision?.evidenceHash,
      paymentReference: settlement.paymentReference,
      solanaReceiptSignature: this.state.verificationSignatures[po.id],
      paymentStatus: settlement.status,
    };
  }

  async verifyPublicPurchaseOrder(purchaseOrderId: string): Promise<PublicVerification> {
    const verification = this.publicVerification(purchaseOrderId);
    const po = this.getPO(purchaseOrderId);
    const settlement = this.getSettlement(po.id);
    const [tempo, solana] = await Promise.all([
      this.paymentRail.verify({ purchaseOrder: po, settlement }),
      this.attestationRail.verify({
        purchaseOrderId: po.id,
        settlementReference: po.settlementReference,
        termsHash: po.termsHash,
        conditionReportHash: verification.conditionReportHash,
        qaDecisionHash: verification.qaDecisionHash,
        paymentReference: settlement.paymentReference,
        signature: this.state.verificationSignatures[po.id],
      }),
    ]);
    return { ...verification, liveVerification: { tempo, solana } };
  }

  verificationReport(actor: Actor, purchaseOrderId: string): VerificationReport {
    const po = this.getPO(purchaseOrderId);
    this.requireTenant(actor, po.tenantId);
    if (!hasAnyRole(actor, ["owner", "admin", "qa", "auditor", "finance"])) throw forbidden("Verification access is restricted");
    const shipmentIds = new Set(this.state.shipments.filter((shipment) => shipment.purchaseOrderId === po.id).map((shipment) => shipment.id));
    const lotIds = new Set(this.state.shipments.filter((shipment) => shipment.purchaseOrderId === po.id).map((shipment) => shipment.lotId));
    const receipts = this.state.receipts.filter((receipt) => receipt.purchaseOrderId === po.id);
    const qa = this.state.qaDecisions.find((decision) => receipts.some((receipt) => receipt.id === decision.receiptId));
    const report = this.state.conditionReports.find((candidate) => shipmentIds.has(candidate.shipmentId));
    const condition = report ? {
      status: report.status,
      readingCount: report.readingCount,
      firstReadingAt: report.firstReadingAt,
      lastReadingAt: report.lastReadingAt,
      minimumTemperatureCelsius: report.minimumTemperatureCelsius,
      maximumTemperatureCelsius: report.maximumTemperatureCelsius,
      averageTemperatureCelsius: report.averageTemperatureCelsius,
      excursionCount: report.excursionCount,
      longestExcursionSeconds: report.longestExcursionSeconds,
      missingSequenceCount: report.missingSequenceCount,
      signatureCoverage: report.signatureCoverage,
      hashChainValid: report.hashChainValid,
      readingsHash: report.readingsHash,
      telemetryMerkleRoot: report.telemetryMerkleRoot,
      documentNames: report.documents.map((document) => document.name),
      documentHashes: report.documents.map((document) => document.sha256),
    } : undefined;
    const recalls = this.state.recalls
      .filter((recall) => lotIds.has(recall.lotId) && recall.tenantId === actor.tenantId)
      .map((recall) => ({ ...recall, locations: this.recallImpact(actor, recall.id).locations }));
    return {
      public: this.publicVerification(po.id),
      ...(condition ? { condition } : {}),
      ...(qa ? { qa: structuredClone(qa) } : {}),
      receipts: structuredClone(receipts),
      inventory: structuredClone(this.state.inventoryEvents.filter((event) => event.tenantId === actor.tenantId && lotIds.has(event.lotId))),
      recalls,
    };
  }

  listTenantPurchaseOrders(actor: Actor) {
    this.requireTenant(actor, actor.tenantId);
    return this.state.purchaseOrders.filter((po) => po.tenantId === actor.tenantId);
  }

  listSupplierInbox(actor: Actor): SupplierInboxItem[] {
    this.requireTenant(actor, actor.tenantId);
    if (!hasAnyRole(actor, ["owner", "admin", "supplier"])) throw forbidden("Supplier inbox access is restricted");
    return this.state.purchaseOrders
      .filter((po) => po.supplierTenantId === actor.tenantId)
      .flatMap((po) => {
        const grant = this.state.grants.find((candidate) =>
          candidate.grantingTenantId === po.tenantId &&
          candidate.receivingTenantId === actor.tenantId &&
          candidate.resourceType === "purchase_order" &&
          candidate.resourceId === po.id &&
          candidate.status === "active" &&
          candidate.actions.includes("view"),
        );
        if (!grant) return [];
        const buyer = this.state.tenants.find((tenant) => tenant.id === po.tenantId);
        const product = this.state.products.find((candidate) => candidate.id === po.productId);
        if (!buyer || !product) return [];
        return [{
          purchaseOrderId: po.id,
          buyerTenantId: buyer.id,
          buyerTenantName: buyer.name,
          supplierTenantId: po.supplierTenantId,
          productId: po.productId,
          productName: product.name,
          quantity: po.quantity,
          unit: po.unit,
          amountBaseUnits: po.amountBaseUnits,
          token: po.token,
          status: po.status,
          policy: structuredClone(po.policy),
          termsHash: po.termsHash,
          createdAt: po.createdAt,
          ...(po.acknowledgedAt ? { acknowledgedAt: po.acknowledgedAt } : {}),
          availableActions: [...grant.actions],
        } satisfies SupplierInboxItem];
      });
  }

  listTenantProducts(actor: Actor) {
    this.requireTenant(actor, actor.tenantId);
    return this.state.products.filter((product) => product.tenantId === actor.tenantId);
  }

  listSupplierTenants(actor: Actor): SupplierDirectoryItem[] {
    this.requireTenant(actor, actor.tenantId);
    if (!hasAnyRole(actor, ["owner", "admin", "procurement"])) throw forbidden("Supplier directory access is restricted");
    const supplierTenantIds = new Set(this.state.memberships.filter((membership) => membership.roles.includes("supplier")).map((membership) => membership.tenantId));
    return this.state.tenants
      .filter((tenant) => tenant.id !== actor.tenantId && supplierTenantIds.has(tenant.id))
      .map(({ id, name }) => ({ tenantId: id, name }));
  }

  listReceivingQueue(actor: Actor): ReceivingQueueItem[] {
    this.requireTenant(actor, actor.tenantId);
    if (!hasAnyRole(actor, ["owner", "admin", "receiving"])) throw forbidden("Receiving queue access is restricted");
    const settings = this.tenantSettings(actor.tenantId);
    return this.state.shipments.flatMap((shipment) => {
      const po = this.state.purchaseOrders.find((candidate) => candidate.id === shipment.purchaseOrderId && candidate.tenantId === actor.tenantId);
      const lot = this.state.lots.find((candidate) => candidate.id === shipment.lotId);
      const product = po ? this.state.products.find((candidate) => candidate.id === po.productId) : undefined;
      if (!po || !lot || !product || this.state.receipts.some((receipt) => receipt.shipmentId === shipment.id)) return [];
      return [{
        shipmentId: shipment.id,
        purchaseOrderId: po.id,
        productId: po.productId,
        productName: product.name,
        manufacturerLotNumber: lot.manufacturerLotNumber,
        expiryDate: lot.expiryDate,
        quantity: shipment.quantity,
        unit: shipment.quantity === lot.quantity ? lot.unit : po.unit,
        dispatchedAt: shipment.dispatchedAt,
        availableSites: structuredClone(settings.sites.filter((site) => site.active)),
      } satisfies ReceivingQueueItem];
    });
  }

  listQAQueue(actor: Actor): QAQueueItem[] {
    this.requireTenant(actor, actor.tenantId);
    if (!hasAnyRole(actor, ["owner", "admin", "qa"])) throw forbidden("QA queue access is restricted");
    return this.state.receipts.filter((receipt) => receipt.tenantId === actor.tenantId && receipt.status === "pending_qa").flatMap((receipt) => {
      const shipment = this.state.shipments.find((candidate) => candidate.id === receipt.shipmentId);
      const po = this.state.purchaseOrders.find((candidate) => candidate.id === receipt.purchaseOrderId && candidate.tenantId === actor.tenantId);
      const product = po ? this.state.products.find((candidate) => candidate.id === po.productId) : undefined;
      const condition = shipment ? [...this.state.conditionReports].reverse().find((report) => report.shipmentId === shipment.id) : undefined;
      if (!shipment || !po || !product) return [];
      return [{
        receiptId: receipt.id,
        shipmentId: shipment.id,
        purchaseOrderId: po.id,
        productId: po.productId,
        productName: product.name,
        siteId: receipt.siteId,
        receivedQuantity: receipt.receivedQuantity,
        receivedAt: receipt.receivedAt,
        ...(condition ? {
          conditionStatus: condition.status,
          readingCount: condition.readingCount,
          documentCount: condition.documents.length,
          evidenceDocuments: condition.documents.map(({ name, sha256, objectId, contentType }) => ({
            name,
            sha256,
            ...(objectId ? { objectId } : {}),
            ...(contentType ? { contentType } : {}),
          })),
        } : {}),
      } satisfies QAQueueItem];
    });
  }

  evidenceStorageLocation(actor: Actor, purchaseOrderId: string, objectId: string) {
    const po = this.getPO(purchaseOrderId);
    this.requireTenant(actor, po.tenantId);
    if (!hasAnyRole(actor, ["owner", "admin", "qa"])) throw forbidden("QA evidence access is restricted");
    const attached = this.state.conditionReports.flatMap((report) => {
      const shipment = this.state.shipments.find((candidate) => candidate.id === report.shipmentId);
      if (shipment?.purchaseOrderId !== po.id || shipment.supplierTenantId !== po.supplierTenantId) return [];
      return report.documents.filter((document) => document.objectId === objectId);
    }).at(-1);
    if (!attached) throw notFound("Evidence is not attached to this purchase order");
    this.record(actor, "evidence.download.authorized", "purchase_order", po.id, { objectId });
    return { tenantId: po.supplierTenantId, objectId, sha256: attached.sha256 };
  }

  listFinanceQueue(actor: Actor): FinanceQueueItem[] {
    this.requireTenant(actor, actor.tenantId);
    if (!hasAnyRole(actor, ["owner", "admin", "finance"])) throw forbidden("Finance queue access is restricted");
    return this.state.purchaseOrders.filter((po) => po.tenantId === actor.tenantId).flatMap((po) => {
      const settlement = this.getSettlement(po.id);
      const supplier = this.state.tenants.find((tenant) => tenant.id === po.supplierTenantId);
      const receipt = this.state.receipts.find((candidate) => candidate.purchaseOrderId === po.id);
      const qa = receipt ? this.state.qaDecisions.find((decision) => decision.receiptId === receipt.id) : undefined;
      if (!supplier) return [];
      return [{
        purchaseOrderId: po.id,
        supplierTenantId: supplier.id,
        supplierTenantName: supplier.name,
        amountBaseUnits: settlement.amountBaseUnits,
        token: po.token,
        purchaseOrderStatus: po.status,
        settlementStatus: settlement.status,
        ...(settlement.paymentReference ? { paymentReference: settlement.paymentReference } : {}),
        ...(qa ? { qaStatus: qa.status } : {}),
        adjustmentBps: settlement.adjustmentBps,
      } satisfies FinanceQueueItem];
    });
  }

  listTenantHoldings(actor: Actor) {
    this.requireTenant(actor, actor.tenantId);
    return this.state.holdings.filter((holding) => holding.tenantId === actor.tenantId);
  }

  listTenantRecalls(actor: Actor) {
    this.requireTenant(actor, actor.tenantId);
    if (!hasAnyRole(actor, ["owner", "admin", "qa", "auditor", "receiving"])) throw forbidden("Recall access is restricted");
    return this.state.recalls.filter((recall) => recall.tenantId === actor.tenantId);
  }

  recallImpact(actor: Actor, recallId: string) {
    this.requireTenant(actor, actor.tenantId);
    if (!hasAnyRole(actor, ["owner", "admin", "qa", "auditor", "receiving"])) throw forbidden("Recall access is restricted");
    const recall = this.state.recalls.find((candidate) => candidate.id === recallId && candidate.tenantId === actor.tenantId);
    if (!recall) throw notFound("Recall not found");
    const lot = this.findLotVisibleToTenant(recall.lotId, actor.tenantId);
    if (!lot) throw notFound("Lot not found in active tenant");
    const locations = this.state.holdings
      .filter((holding) => holding.tenantId === actor.tenantId && holding.lotId === lot.id)
      .map((holding) => {
        const events = this.state.inventoryEvents.filter((event) =>
          event.tenantId === actor.tenantId && event.lotId === lot.id && event.siteId === holding.siteId,
        );
        return {
          siteId: holding.siteId,
          recordedRemaining: holding.onHand,
          usable: holding.usable,
          quarantined: holding.quarantined,
          consumed: events.filter((event) => ["consume_test", "consume_qc", "training"].includes(event.kind))
            .reduce((total, event) => total + event.quantity, 0),
          wasted: events.filter((event) => ["waste", "disposal"].includes(event.kind))
            .reduce((total, event) => total + event.quantity, 0),
        };
      });
    return { recall, lot, locations };
  }

  listAudit(actor: Actor) {
    this.requireTenant(actor, actor.tenantId);
    if (!hasAnyRole(actor, ["owner", "admin", "auditor"])) throw forbidden("Audit access is restricted");
    return this.state.audit.filter((event) => event.tenantId === actor.tenantId);
  }

  private getSettlement(purchaseOrderId: string) {
    const settlement = this.state.settlements.find((candidate) => candidate.purchaseOrderId === purchaseOrderId);
    if (!settlement) throw notFound("Settlement not found");
    return settlement;
  }

  private ensureSiteAllowed(tenantId: string, siteId: string) {
    if (!siteId.trim()) throw conflict("Site is required");
    const settings = this.tenantSettings(tenantId);
    if (settings.sites.length > 0 && !settings.sites.some((site) => site.id === siteId && site.active)) {
      throw conflict("Site is not configured or is inactive for this tenant");
    }
  }

  private ensureReasonCodeAllowed(tenantId: string, kind: Extract<InventoryEventKind, "consume_test" | "consume_qc" | "training" | "waste" | "disposal">, reasonCode?: string) {
    if (!reasonCode) return;
    const configured = this.tenantSettings(tenantId).usageReasonCodes.find((candidate) => candidate.code === reasonCode && candidate.active);
    if (!configured || !configured.kinds.includes(kind)) throw conflict("Usage reason code is not configured for this event kind");
  }

  private existingInventoryEvent(tenantId: string, sourceId: string) {
    if (!sourceId.trim()) throw conflict("Inventory sourceId is required");
    return this.state.inventoryEvents.find((event) => event.tenantId === tenantId && event.sourceId === sourceId);
  }
}
