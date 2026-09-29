export type Role =
  | "owner"
  | "admin"
  | "procurement"
  | "supplier"
  | "receiving"
  | "qa"
  | "finance"
  | "auditor";

export type TenantId = string;
export type UserId = string;
export type Unit = "kit" | "bottle" | "ml" | "test";
export type QAStatus = "pending" | "accepted" | "accepted_with_adjustment" | "held" | "rejected";
export type ConditionStatus = "pass" | "exception" | "insufficient_evidence";
export type SettlementStatus =
  | "draft"
  | "funded"
  | "awaiting_qa"
  | "authorized"
  | "submitted"
  | "confirmed"
  | "refunded"
  | "held"
  | "unknown";

export interface Actor {
  userId: UserId;
  tenantId: TenantId;
  roles: Role[];
}

export interface Tenant {
  id: TenantId;
  name: string;
  createdAt: string;
}

export interface TenantSite {
  id: string;
  name: string;
  kind: "warehouse" | "laboratory" | "branch" | "other";
  active: boolean;
}

export interface UsageReasonCode {
  code: string;
  label: string;
  kinds: Extract<InventoryEventKind, "consume_test" | "consume_qc" | "training" | "waste" | "disposal">[];
  active: boolean;
}

export interface TenantSettings {
  tenantId: TenantId;
  timezone: string;
  sites: TenantSite[];
  usageReasonCodes: UsageReasonCode[];
}

export interface Membership {
  tenantId: TenantId;
  userId: UserId;
  displayName: string;
  roles: Role[];
}

export interface CollaborationGrant {
  id: string;
  grantingTenantId: TenantId;
  receivingTenantId: TenantId;
  resourceType: "purchase_order";
  resourceId: string;
  actions: ("view" | "acknowledge" | "submit_evidence" | "respond")[];
  status: "active" | "revoked";
  createdAt: string;
}

export interface Product {
  id: string;
  tenantId: TenantId;
  name: string;
  manufacturer: string;
  baseUnit: Unit;
  storageMinCelsius: number;
  storageMaxCelsius: number;
  minimumShelfLifeDays: number;
  requiredDocuments: string[];
}

export interface AcceptancePolicy {
  version: number;
  productId: string;
  minQuantity: number;
  maxQuantity: number;
  minShelfLifeDays: number;
  minTemperatureCelsius: number;
  maxTemperatureCelsius: number;
  /** Maximum allowed time between expected telemetry readings for this product. */
  maxTelemetryGapSeconds: number;
  requiredDocuments: string[];
  allowAdjustmentBps: boolean;
}

export interface PurchaseOrder {
  id: string;
  tenantId: TenantId;
  supplierTenantId: TenantId;
  productId: string;
  quantity: number;
  unit: Unit;
  amountBaseUnits: bigint;
  token: string;
  settlementReference: string;
  policy: AcceptancePolicy;
  termsHash: string;
  termsNonce: string;
  status: "draft" | "acknowledged" | "funded" | "in_transit" | "received" | "closed";
  createdAt: string;
  acknowledgedAt?: string;
}

export interface Lot {
  id: string;
  tenantId: TenantId;
  productId: string;
  manufacturerLotNumber: string;
  expiryDate: string;
  quantity: number;
  unit: Unit;
}

export interface Shipment {
  id: string;
  tenantId: TenantId;
  supplierTenantId: TenantId;
  purchaseOrderId: string;
  lotId: string;
  quantity: number;
  dispatchedAt: string;
  status: "ready" | "in_transit" | "received";
}

export interface EvidenceDocument {
  name: string;
  sha256: string;
  /** Manual is a declared operator reference; upload/device evidence must be cryptographically hashed. */
  source?: "manual" | "upload" | "device";
  /** Opaque tenant-scoped object-store identifier, when the document is private. */
  objectId?: string;
  contentType?: string;
}

export interface ConditionReading {
  sequence: number;
  timestamp: string;
  temperatureCelsius: number;
  deviceId?: string;
  humidityPercent?: number;
  batteryPercent?: number;
  previousHash?: string;
  signature?: string;
}

export interface ConditionReport {
  id: string;
  shipmentId: string;
  status: ConditionStatus;
  readingCount: number;
  firstReadingAt?: string;
  lastReadingAt?: string;
  minimumTemperatureCelsius?: number;
  maximumTemperatureCelsius?: number;
  averageTemperatureCelsius?: number;
  excursionCount: number;
  longestExcursionSeconds: number;
  missingSequenceCount: number;
  maximumObservedGapSeconds?: number;
  coverageComplete: boolean;
  evidenceIntegrityValid: boolean;
  signatureCoverage: number;
  hashChainValid: boolean;
  documents: EvidenceDocument[];
  readingsHash: string;
  telemetryMerkleRoot: string;
  createdAt: string;
}

export interface GoodsReceipt {
  id: string;
  tenantId: TenantId;
  purchaseOrderId: string;
  shipmentId: string;
  siteId: string;
  receivedQuantity: number;
  acceptedQuantity?: number;
  rejectedQuantity?: number;
  status: "pending_qa" | "accepted" | "accepted_with_adjustment" | "held" | "rejected";
  receivedAt: string;
  receivedBy: UserId;
}

export type InventoryEventKind =
  | "receipt"
  | "transfer_out"
  | "transfer_in"
  | "opening"
  | "consume_test"
  | "consume_qc"
  | "training"
  | "waste"
  | "disposal"
  | "quarantine"
  | "release_quarantine"
  | "correction";

export interface InventoryEvent {
  id: string;
  tenantId: TenantId;
  lotId: string;
  siteId: string;
  kind: InventoryEventKind;
  quantity: number;
  unit: Unit;
  sourceId: string;
  reason?: string;
  reasonCode?: string;
  createdAt: string;
  createdBy: UserId;
}

export interface Holding {
  tenantId: TenantId;
  lotId: string;
  siteId: string;
  unit: Unit;
  onHand: number;
  quarantined: number;
  usable: number;
}

export interface QADecision {
  id: string;
  receiptId: string;
  status: QAStatus;
  reason: string;
  adjustmentBps: number;
  evidenceHash: string;
  decidedBy: UserId;
  decidedAt: string;
}

export interface Settlement {
  id: string;
  purchaseOrderId: string;
  amountBaseUnits: bigint;
  adjustmentBps: number;
  supplierAmountBaseUnits?: bigint;
  buyerCreditBaseUnits?: bigint;
  status: SettlementStatus;
  paymentReference?: string;
  pendingAction?: "fund" | "settle" | "refund";
  paymentActionPreviousStatus?: SettlementStatus;
  confirmedAt?: string;
}

export interface Recall {
  id: string;
  tenantId: TenantId;
  lotId: string;
  reason: string;
  status: "active" | "cleared";
  createdAt: string;
  createdBy: UserId;
}

export interface PublicVerification {
  purchaseOrderId: string;
  settlementReference: string;
  termsHash: string;
  conditionReportHash?: string;
  qaDecisionHash?: string;
  paymentReference?: string;
  paymentStatus: SettlementStatus;
  solanaReceiptSignature?: string;
  liveVerification?: {
    tempo: ChainVerification;
    solana: ChainVerification;
  };
}

export type ChainVerificationStatus = "verified" | "pending" | "failed" | "mismatch" | "unavailable" | "unverifiable";

export interface ChainVerification {
  rail: "tempo" | "solana";
  status: ChainVerificationStatus;
  reference?: string;
  network?: string;
  event?: string;
  block?: string;
  slot?: string;
  confirmations?: number;
  detail: string;
}

export interface VerificationReport {
  public: PublicVerification;
  condition?: Pick<ConditionReport, "status" | "readingCount" | "firstReadingAt" | "lastReadingAt" | "minimumTemperatureCelsius" | "maximumTemperatureCelsius" | "averageTemperatureCelsius" | "excursionCount" | "longestExcursionSeconds" | "missingSequenceCount" | "signatureCoverage" | "hashChainValid" | "readingsHash" | "telemetryMerkleRoot"> & { documentNames: string[]; documentHashes: string[] };
  qa?: QADecision;
  receipts: GoodsReceipt[];
  inventory: InventoryEvent[];
  recalls: Array<Recall & { locations: Array<{ siteId: string; recordedRemaining: number; usable: number; quarantined: number; consumed: number; wasted: number }> }>;
}

export interface SupplierInboxItem {
  purchaseOrderId: string;
  buyerTenantId: TenantId;
  buyerTenantName: string;
  supplierTenantId: TenantId;
  productId: string;
  productName: string;
  quantity: number;
  unit: Unit;
  amountBaseUnits: bigint;
  token: string;
  status: PurchaseOrder["status"];
  policy: AcceptancePolicy;
  termsHash: string;
  createdAt: string;
  acknowledgedAt?: string;
  availableActions: CollaborationGrant["actions"];
}

export interface SupplierDirectoryItem {
  tenantId: TenantId;
  name: string;
}

export interface ReceivingQueueItem {
  shipmentId: string;
  purchaseOrderId: string;
  productId: string;
  productName: string;
  manufacturerLotNumber: string;
  expiryDate: string;
  quantity: number;
  unit: Unit;
  dispatchedAt: string;
  availableSites: TenantSite[];
}

export interface QAQueueItem {
  receiptId: string;
  shipmentId: string;
  purchaseOrderId: string;
  productId: string;
  productName: string;
  siteId: string;
  receivedQuantity: number;
  receivedAt: string;
  conditionStatus?: ConditionStatus;
  readingCount?: number;
  documentCount?: number;
  evidenceDocuments?: Array<Pick<EvidenceDocument, "name" | "sha256" | "objectId" | "contentType">>;
}

export interface FinanceQueueItem {
  purchaseOrderId: string;
  supplierTenantId: TenantId;
  supplierTenantName: string;
  amountBaseUnits: bigint;
  token: string;
  purchaseOrderStatus: PurchaseOrder["status"];
  settlementStatus: SettlementStatus;
  paymentReference?: string;
  qaStatus?: QAStatus;
  adjustmentBps: number;
}

export interface AuditEvent {
  id: string;
  tenantId: TenantId;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
  metadata: Record<string, string | number | boolean>;
}
