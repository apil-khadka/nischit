import { Pool } from "pg";
import type {
  AuditEvent,
  CollaborationGrant,
  ConditionReport,
  EngineSnapshot,
  GoodsReceipt,
  Holding,
  InventoryEvent,
  Lot,
  Membership,
  Product,
  PurchaseOrder,
  QADecision,
  Recall,
  Settlement,
  Shipment,
  Tenant,
  TenantSettings,
} from "@nischit/domain";

const BIGINT_PREFIX = "__nischit_bigint__:";
const BIGINT_VALUE_PREFIX = `${BIGINT_PREFIX}value:`;
const STRING_VALUE_PREFIX = `${BIGINT_PREFIX}string:`;

type DbRow<T extends object> = T & Record<string, unknown>;
type DbTimestamp = Date | string;
type DbNumeric = number | string;
type TenantDbRow = DbRow<{ id: string; name: string; created_at: DbTimestamp }>;
type MembershipDbRow = DbRow<{ tenant_id: string; user_id: string; display_name: string | null; roles: Membership["roles"] }>;
type SettingsDbRow = DbRow<{ tenant_id: string; timezone: string; sites: unknown; usage_reason_codes: unknown }>;
type GrantDbRow = DbRow<{
  id: string; granting_tenant_id: string; receiving_tenant_id: string;
  resource_type: CollaborationGrant["resourceType"]; resource_id: string;
  actions: CollaborationGrant["actions"]; status: CollaborationGrant["status"]; created_at: DbTimestamp;
}>;
type ProductDbRow = DbRow<{
  id: string; tenant_id: string; name: string; manufacturer: string; base_unit: Product["baseUnit"];
  storage_min_celsius: DbNumeric; storage_max_celsius: DbNumeric; minimum_shelf_life_days: number;
  required_documents: Product["requiredDocuments"];
}>;
type PurchaseOrderDbRow = DbRow<{
  id: string; tenant_id: string; supplier_tenant_id: string; product_id: string; quantity: number;
  unit: PurchaseOrder["unit"]; amount_base_units: DbNumeric; token: string; settlement_reference: string;
  policy: PurchaseOrder["policy"]; terms_hash: string; terms_nonce: string; status: PurchaseOrder["status"];
  created_at: DbTimestamp; acknowledged_at: DbTimestamp | null;
}>;
type LotDbRow = DbRow<{
  id: string; tenant_id: string; product_id: string; manufacturer_lot_number: string;
  expiry_date: DbTimestamp; quantity: number; unit: Lot["unit"];
}>;
type ShipmentDbRow = DbRow<{
  id: string; tenant_id: string; supplier_tenant_id: string; purchase_order_id: string;
  lot_id: string; quantity: number; dispatched_at: DbTimestamp; status: Shipment["status"];
}>;
type ConditionReportDbRow = DbRow<{
  id: string; shipment_id: string; status: ConditionReport["status"]; reading_count: number;
  first_reading_at: DbTimestamp | null; last_reading_at: DbTimestamp | null;
  minimum_temperature_celsius: DbNumeric | null; maximum_temperature_celsius: DbNumeric | null;
  average_temperature_celsius: DbNumeric | null; excursion_count: number; longest_excursion_seconds: DbNumeric;
  missing_sequence_count: number; maximum_observed_gap_seconds: DbNumeric | null; coverage_complete: boolean;
  evidence_integrity_valid: boolean; signature_coverage: DbNumeric; hash_chain_valid: boolean;
  documents: unknown; readings_hash: string; telemetry_merkle_root: string; created_at: DbTimestamp;
}>;
type ReceiptDbRow = DbRow<{
  id: string; tenant_id: string; purchase_order_id: string; shipment_id: string; site_id: string;
  received_quantity: number; accepted_quantity: number | null; rejected_quantity: number | null;
  status: GoodsReceipt["status"]; received_at: DbTimestamp; received_by: string;
}>;
type InventoryEventDbRow = DbRow<{
  id: string; tenant_id: string; lot_id: string; site_id: string; kind: InventoryEvent["kind"];
  quantity: number; unit: InventoryEvent["unit"]; source_id: string; reason: string | null;
  reason_code: string | null; created_at: DbTimestamp; created_by: string;
}>;
type HoldingDbRow = DbRow<{
  tenant_id: string; lot_id: string; site_id: string; unit: Holding["unit"];
  on_hand: number; quarantined: number; usable: number;
}>;
type QADecisionDbRow = DbRow<{
  id: string; receipt_id: string; status: QADecision["status"]; reason: string;
  adjustment_bps: number; evidence_hash: string; decided_by: string; decided_at: DbTimestamp;
}>;
type SettlementDbRow = DbRow<{
  id: string; purchase_order_id: string; amount_base_units: DbNumeric; adjustment_bps: number;
  supplier_amount_base_units: DbNumeric | null; buyer_credit_base_units: DbNumeric | null;
  status: Settlement["status"]; payment_reference: string | null;
  pending_action: Settlement["pendingAction"] | null;
  payment_action_previous_status: Settlement["paymentActionPreviousStatus"] | null;
  confirmed_at: DbTimestamp | null;
}>;
type RecallDbRow = DbRow<{
  id: string; tenant_id: string; lot_id: string; reason: string; status: Recall["status"];
  created_at: DbTimestamp; created_by: string;
}>;
type IdempotencyDbRow = DbRow<{ idempotency_key: string; result: unknown }>;
type AuditDbRow = DbRow<{
  id: string; tenant_id: string; actor_id: string; action: string; resource_type: string;
  resource_id: string; metadata: unknown; created_at: DbTimestamp;
}>;
type SignatureDbRow = DbRow<{ purchase_order_id: string; signature: string }>;

const encodeJson = (value: unknown) => JSON.stringify(value, (_key, nested) =>
  typeof nested === "bigint"
    ? BIGINT_VALUE_PREFIX + nested.toString()
    : typeof nested === "string" && nested.startsWith(BIGINT_PREFIX)
      ? STRING_VALUE_PREFIX + Buffer.from(nested).toString("base64url")
      : nested,
);

const decodeJson = <T = unknown>(value: unknown): T => JSON.parse(
  typeof value === "string" ? value : JSON.stringify(value),
  (_key, nested) => {
    if (typeof nested !== "string") return nested;
    if (nested.startsWith(STRING_VALUE_PREFIX)) {
      const encoded = nested.slice(STRING_VALUE_PREFIX.length);
      try {
        const decoded = Buffer.from(encoded, "base64url").toString("utf8");
        if (Buffer.from(decoded).toString("base64url") === encoded) return decoded;
      } catch {
        // Keep malformed or legacy marker-shaped strings as strings.
      }
      return nested;
    }
    if (nested.startsWith(BIGINT_VALUE_PREFIX)) {
      try {
        return BigInt(nested.slice(BIGINT_VALUE_PREFIX.length));
      } catch {
        return nested;
      }
    }
    // Read the original bigint marker format without crashing on ordinary strings.
    if (nested.startsWith(BIGINT_PREFIX)) {
      const legacyValue = nested.slice(BIGINT_PREFIX.length);
      try {
        return BigInt(legacyValue);
      } catch {
        return nested;
      }
    }
    return nested;
  },
) as T;

export function encodeSnapshot(snapshot: EngineSnapshot): string {
  return encodeJson(snapshot);
}

export function decodeSnapshot(serialized: string): EngineSnapshot {
  return decodeJson<EngineSnapshot>(serialized);
}

export interface OutboxInsert {
  id: string;
  tenantId: string;
  topic: string;
  payload: AuditEvent;
}

export function auditEventsToOutbox(audit: readonly AuditEvent[], previousCount: number): OutboxInsert[] {
  return audit.slice(previousCount).map((event) => ({
    id: event.id,
    tenantId: event.tenantId,
    topic: "audit.recorded",
    payload: event,
  }));
}

const iso = (value: unknown) => value instanceof Date ? value.toISOString() : String(value);
const optionalNumber = (value: unknown) => value === null || value === undefined ? undefined : Number(value);
const bigintOrUndefined = (value: unknown) => value === null || value === undefined ? undefined : BigInt(String(value));

export class PostgresStateStore {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 4 });
  }

  private async assertRuntimeRole() {
    if (process.env.NODE_ENV !== "production") return;
    const result = await this.pool.query<{ rolsuper: boolean; rolbypassrls: boolean; owns_tables: boolean }>(
      "SELECT rolsuper, rolbypassrls, EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user) AS owns_tables FROM pg_roles WHERE rolname = current_user",
    );
    const role = result.rows[0];
    if (!role || role.rolsuper || role.rolbypassrls || role.owns_tables) {
      throw new Error("Production DATABASE_URL must use a non-owner role without SUPERUSER or BYPASSRLS");
    }
  }

  async load(): Promise<EngineSnapshot | undefined> {
    await this.assertRuntimeRole();
    const meta = await this.pool.query<{ schema_version: number }>(
      "SELECT schema_version FROM nischit_persistence_meta WHERE id = 'normalized-v1'",
    );
    if (meta.rowCount) return this.loadNormalized();
    const legacy = await this.pool.query<DbRow<{ state: unknown }>>(
      "SELECT state FROM nischit_engine_state WHERE id = 'singleton'",
    );
    if (legacy.rowCount === 0) return undefined;
    return decodeSnapshot(JSON.stringify(legacy.rows[0]!.state));
  }

  private async loadNormalized(): Promise<EngineSnapshot | undefined> {
    const tenantRows = await this.pool.query<TenantDbRow>("SELECT * FROM tenants ORDER BY created_at, id");
    if (tenantRows.rowCount === 0) return undefined;
    const membershipRows: MembershipDbRow[] = [];
    const settingsRows: SettingsDbRow[] = [];
    const grantRows: GrantDbRow[] = [];
    const productRows: ProductDbRow[] = [];
    const poRows: PurchaseOrderDbRow[] = [];
    const lotRows: LotDbRow[] = [];
    const shipmentRows: ShipmentDbRow[] = [];
    const reportRows: ConditionReportDbRow[] = [];
    const receiptRows: ReceiptDbRow[] = [];
    const inventoryRows: InventoryEventDbRow[] = [];
    const holdingRows: HoldingDbRow[] = [];
    const qaRows: QADecisionDbRow[] = [];
    const settlementRows: SettlementDbRow[] = [];
    const recallRows: RecallDbRow[] = [];
    const idempotencyRows: IdempotencyDbRow[] = [];
    const auditRows: AuditDbRow[] = [];
    const signatureRows: SignatureDbRow[] = [];

    for (const tenant of tenantRows.rows) {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenant.id]);
        const [memberships, settings, grants, products, purchaseOrders, lots, shipments, reports, receipts,
          inventory, holdings, decisions, settlements, recalls, idempotency, audit, signatures] = await Promise.all([
          client.query<MembershipDbRow>("SELECT * FROM memberships ORDER BY tenant_id, user_id"),
          client.query<SettingsDbRow>("SELECT * FROM tenant_settings ORDER BY tenant_id"),
          client.query<GrantDbRow>("SELECT * FROM collaboration_grants ORDER BY created_at, id"),
          client.query<ProductDbRow>("SELECT * FROM products ORDER BY created_at, id"),
          client.query<PurchaseOrderDbRow>("SELECT * FROM purchase_orders ORDER BY created_at, id"),
          client.query<LotDbRow>("SELECT * FROM lots ORDER BY id"),
          client.query<ShipmentDbRow>("SELECT * FROM shipments ORDER BY dispatched_at, id"),
          client.query<ConditionReportDbRow>("SELECT * FROM condition_reports ORDER BY created_at, id"),
          client.query<ReceiptDbRow>("SELECT * FROM goods_receipts ORDER BY received_at, id"),
          client.query<InventoryEventDbRow>("SELECT * FROM inventory_events ORDER BY created_at, id"),
          client.query<HoldingDbRow>("SELECT * FROM inventory_holdings ORDER BY tenant_id, lot_id, site_id, unit"),
          client.query<QADecisionDbRow>("SELECT * FROM qa_decisions ORDER BY decided_at, id"),
          client.query<SettlementDbRow>("SELECT * FROM settlements ORDER BY id"),
          client.query<RecallDbRow>("SELECT * FROM recalls ORDER BY created_at, id"),
          client.query<IdempotencyDbRow>("SELECT * FROM nischit_idempotency ORDER BY idempotency_key"),
          client.query<AuditDbRow>("SELECT * FROM audit_events ORDER BY created_at, id"),
          client.query<SignatureDbRow>("SELECT * FROM verification_signatures ORDER BY purchase_order_id"),
        ]);
        membershipRows.push(...memberships.rows);
        settingsRows.push(...settings.rows);
        grantRows.push(...grants.rows);
        productRows.push(...products.rows);
        poRows.push(...purchaseOrders.rows);
        lotRows.push(...lots.rows);
        shipmentRows.push(...shipments.rows);
        reportRows.push(...reports.rows);
        receiptRows.push(...receipts.rows);
        inventoryRows.push(...inventory.rows);
        holdingRows.push(...holdings.rows);
        qaRows.push(...decisions.rows);
        settlementRows.push(...settlements.rows);
        recallRows.push(...recalls.rows);
        idempotencyRows.push(...idempotency.rows);
        auditRows.push(...audit.rows);
        signatureRows.push(...signatures.rows);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
    const tenants: Tenant[] = tenantRows.rows.map((row) => ({ id: row.id, name: row.name, createdAt: iso(row.created_at) }));
    const memberships: Membership[] = membershipRows.map((row) => ({
      tenantId: row.tenant_id, userId: row.user_id, displayName: row.display_name ?? row.user_id, roles: row.roles,
    }));
    const tenantSettings: TenantSettings[] = settingsRows.map((row) => ({
      tenantId: row.tenant_id,
      timezone: row.timezone,
      sites: decodeJson<TenantSettings["sites"]>(row.sites),
      usageReasonCodes: decodeJson<TenantSettings["usageReasonCodes"]>(row.usage_reason_codes),
    }));
    const grants: CollaborationGrant[] = grantRows.map((row) => ({
      id: row.id, grantingTenantId: row.granting_tenant_id, receivingTenantId: row.receiving_tenant_id,
      resourceType: row.resource_type, resourceId: row.resource_id, actions: row.actions, status: row.status,
      createdAt: iso(row.created_at),
    }));
    const products: Product[] = productRows.map((row) => ({
      id: row.id, tenantId: row.tenant_id, name: row.name, manufacturer: row.manufacturer,
      baseUnit: row.base_unit, storageMinCelsius: Number(row.storage_min_celsius), storageMaxCelsius: Number(row.storage_max_celsius),
      minimumShelfLifeDays: row.minimum_shelf_life_days, requiredDocuments: row.required_documents,
    }));
    const purchaseOrders: PurchaseOrder[] = poRows.map((row) => ({
      id: row.id, tenantId: row.tenant_id, supplierTenantId: row.supplier_tenant_id, productId: row.product_id,
      quantity: row.quantity, unit: row.unit, amountBaseUnits: BigInt(String(row.amount_base_units)), token: row.token,
      settlementReference: row.settlement_reference, policy: decodeJson<PurchaseOrder["policy"]>(row.policy), termsHash: row.terms_hash,
      termsNonce: row.terms_nonce, status: row.status, createdAt: iso(row.created_at),
      ...(row.acknowledged_at ? { acknowledgedAt: iso(row.acknowledged_at) } : {}),
    }));
    const lots: Lot[] = lotRows.map((row) => ({
      id: row.id, tenantId: row.tenant_id, productId: row.product_id, manufacturerLotNumber: row.manufacturer_lot_number,
      expiryDate: row.expiry_date instanceof Date ? row.expiry_date.toISOString().slice(0, 10) : String(row.expiry_date),
      quantity: row.quantity, unit: row.unit,
    }));
    const shipments: Shipment[] = shipmentRows.map((row) => ({
      id: row.id, tenantId: row.tenant_id, supplierTenantId: row.supplier_tenant_id, purchaseOrderId: row.purchase_order_id,
      lotId: row.lot_id, quantity: row.quantity, dispatchedAt: iso(row.dispatched_at), status: row.status,
    }));
    const conditionReports: ConditionReport[] = reportRows.map((row) => ({
      id: row.id, shipmentId: row.shipment_id, status: row.status, readingCount: row.reading_count,
      ...(row.first_reading_at ? { firstReadingAt: iso(row.first_reading_at) } : {}),
      ...(row.last_reading_at ? { lastReadingAt: iso(row.last_reading_at) } : {}),
      ...(row.minimum_temperature_celsius !== null ? { minimumTemperatureCelsius: optionalNumber(row.minimum_temperature_celsius) } : {}),
      ...(row.maximum_temperature_celsius !== null ? { maximumTemperatureCelsius: optionalNumber(row.maximum_temperature_celsius) } : {}),
      ...(row.average_temperature_celsius !== null ? { averageTemperatureCelsius: optionalNumber(row.average_temperature_celsius) } : {}),
      excursionCount: row.excursion_count, longestExcursionSeconds: Number(row.longest_excursion_seconds),
      missingSequenceCount: row.missing_sequence_count,
      ...(row.maximum_observed_gap_seconds !== null ? { maximumObservedGapSeconds: Number(row.maximum_observed_gap_seconds) } : {}),
      coverageComplete: row.coverage_complete ?? false,
      evidenceIntegrityValid: row.evidence_integrity_valid ?? false,
      signatureCoverage: Number(row.signature_coverage),
      hashChainValid: row.hash_chain_valid, documents: decodeJson<ConditionReport["documents"]>(row.documents), readingsHash: row.readings_hash,
      telemetryMerkleRoot: row.telemetry_merkle_root, createdAt: iso(row.created_at),
    }));
    const receipts: GoodsReceipt[] = receiptRows.map((row) => ({
      id: row.id, tenantId: row.tenant_id, purchaseOrderId: row.purchase_order_id, shipmentId: row.shipment_id,
      siteId: row.site_id, receivedQuantity: row.received_quantity,
      ...(row.accepted_quantity !== null ? { acceptedQuantity: row.accepted_quantity } : {}),
      ...(row.rejected_quantity !== null ? { rejectedQuantity: row.rejected_quantity } : {}),
      status: row.status, receivedAt: iso(row.received_at), receivedBy: row.received_by,
    }));
    const inventoryEvents: InventoryEvent[] = inventoryRows.map((row) => ({
      id: row.id, tenantId: row.tenant_id, lotId: row.lot_id, siteId: row.site_id, kind: row.kind,
      quantity: row.quantity, unit: row.unit, sourceId: row.source_id,
      ...(row.reason ? { reason: row.reason } : {}), ...(row.reason_code ? { reasonCode: row.reason_code } : {}),
      createdAt: iso(row.created_at), createdBy: row.created_by,
    }));
    const holdings = holdingRows.map((row) => ({
      tenantId: row.tenant_id, lotId: row.lot_id, siteId: row.site_id, unit: row.unit,
      onHand: row.on_hand, quarantined: row.quarantined, usable: row.usable,
    }));
    const qaDecisions: QADecision[] = qaRows.map((row) => ({
      id: row.id, receiptId: row.receipt_id, status: row.status, reason: row.reason, adjustmentBps: row.adjustment_bps,
      evidenceHash: row.evidence_hash, decidedBy: row.decided_by, decidedAt: iso(row.decided_at),
    }));
    const settlements: Settlement[] = settlementRows.map((row) => ({
      id: row.id, purchaseOrderId: row.purchase_order_id, amountBaseUnits: BigInt(String(row.amount_base_units)),
      adjustmentBps: row.adjustment_bps, supplierAmountBaseUnits: bigintOrUndefined(row.supplier_amount_base_units),
      buyerCreditBaseUnits: bigintOrUndefined(row.buyer_credit_base_units), status: row.status,
      ...(row.payment_reference ? { paymentReference: row.payment_reference } : {}),
      ...(row.pending_action ? { pendingAction: row.pending_action } : {}),
      ...(row.payment_action_previous_status ? { paymentActionPreviousStatus: row.payment_action_previous_status } : {}),
      ...(row.confirmed_at ? { confirmedAt: iso(row.confirmed_at) } : {}),
    }));
    const recalls: Recall[] = recallRows.map((row) => ({
      id: row.id, tenantId: row.tenant_id, lotId: row.lot_id, reason: row.reason, status: row.status,
      createdAt: iso(row.created_at), createdBy: row.created_by,
    }));
    const idempotency: Record<string, unknown> = Object.fromEntries(
      idempotencyRows.map((row) => [row.idempotency_key, decodeJson<unknown>(row.result)]),
    );
    const audit: AuditEvent[] = auditRows.map((row) => ({
      id: row.id, tenantId: row.tenant_id, actorId: row.actor_id, action: row.action, resourceType: row.resource_type,
      resourceId: row.resource_id, metadata: decodeJson<AuditEvent["metadata"]>(row.metadata), createdAt: iso(row.created_at),
    }));
    const verificationSignatures = Object.fromEntries(signatureRows.map((row) => [row.purchase_order_id, row.signature]));
    return { tenants, memberships, grants, products, purchaseOrders, lots, shipments, conditionReports, receipts,
      tenantSettings, inventoryEvents, holdings, qaDecisions, settlements, recalls, audit, idempotency, verificationSignatures };
  }

  async save(snapshot: EngineSnapshot, events: readonly OutboxInsert[] = []): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const setTenant = (tenantId: string) =>
        client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      await client.query(
        "INSERT INTO nischit_persistence_meta (id, schema_version, updated_at) VALUES ('normalized-v1', 1, now()) ON CONFLICT (id) DO UPDATE SET schema_version = EXCLUDED.schema_version, updated_at = EXCLUDED.updated_at",
      );
      for (const tenant of snapshot.tenants) {
        await client.query(
          "INSERT INTO tenants (id, name, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name",
          [tenant.id, tenant.name, tenant.createdAt],
        );
      }
      for (const membership of snapshot.memberships) {
        await setTenant(membership.tenantId);
        await client.query(
          "INSERT INTO memberships (tenant_id, user_id, display_name, roles) VALUES ($1, $2, $3, $4) ON CONFLICT (tenant_id, user_id) DO UPDATE SET display_name = EXCLUDED.display_name, roles = EXCLUDED.roles",
          [membership.tenantId, membership.userId, membership.displayName, membership.roles],
        );
      }
      for (const settings of snapshot.tenantSettings ?? []) {
        await setTenant(settings.tenantId);
        await client.query(
          "INSERT INTO tenant_settings (tenant_id, timezone, sites, usage_reason_codes, updated_at) VALUES ($1, $2, $3::jsonb, $4::jsonb, now()) ON CONFLICT (tenant_id) DO UPDATE SET timezone = EXCLUDED.timezone, sites = EXCLUDED.sites, usage_reason_codes = EXCLUDED.usage_reason_codes, updated_at = EXCLUDED.updated_at",
          [settings.tenantId, settings.timezone, encodeJson(settings.sites), encodeJson(settings.usageReasonCodes)],
        );
      }
      for (const grant of snapshot.grants) {
        await setTenant(grant.grantingTenantId);
        await client.query(
          "INSERT INTO collaboration_grants (id, tenant_id, granting_tenant_id, receiving_tenant_id, resource_type, resource_id, actions, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET actions = EXCLUDED.actions, status = EXCLUDED.status",
          [grant.id, grant.grantingTenantId, grant.grantingTenantId, grant.receivingTenantId, grant.resourceType, grant.resourceId, grant.actions, grant.status, grant.createdAt],
        );
      }
      for (const product of snapshot.products) {
        await setTenant(product.tenantId);
        await client.query(
          "INSERT INTO products (id, tenant_id, name, manufacturer, base_unit, storage_min_celsius, storage_max_celsius, minimum_shelf_life_days, required_documents) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, manufacturer = EXCLUDED.manufacturer, storage_min_celsius = EXCLUDED.storage_min_celsius, storage_max_celsius = EXCLUDED.storage_max_celsius, minimum_shelf_life_days = EXCLUDED.minimum_shelf_life_days, required_documents = EXCLUDED.required_documents",
          [product.id, product.tenantId, product.name, product.manufacturer, product.baseUnit, product.storageMinCelsius, product.storageMaxCelsius, product.minimumShelfLifeDays, product.requiredDocuments],
        );
      }
      for (const po of snapshot.purchaseOrders) {
        await setTenant(po.tenantId);
        await client.query(
          "INSERT INTO purchase_orders (id, tenant_id, supplier_tenant_id, product_id, quantity, unit, amount_base_units, token, settlement_reference, policy, terms_hash, terms_nonce, status, created_at, acknowledged_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, policy = EXCLUDED.policy, acknowledged_at = EXCLUDED.acknowledged_at",
          [po.id, po.tenantId, po.supplierTenantId, po.productId, po.quantity, po.unit, po.amountBaseUnits.toString(), po.token, po.settlementReference, encodeJson(po.policy), po.termsHash, po.termsNonce, po.status, po.createdAt, po.acknowledgedAt ?? null],
        );
      }
      for (const lot of snapshot.lots) {
        await setTenant(lot.tenantId);
        await client.query(
          "INSERT INTO lots (id, tenant_id, product_id, manufacturer_lot_number, expiry_date, quantity, unit) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET expiry_date = EXCLUDED.expiry_date, quantity = EXCLUDED.quantity",
          [lot.id, lot.tenantId, lot.productId, lot.manufacturerLotNumber, lot.expiryDate, lot.quantity, lot.unit],
        );
      }
      for (const shipment of snapshot.shipments) {
        await setTenant(shipment.tenantId);
        await client.query(
          "INSERT INTO shipments (id, tenant_id, supplier_tenant_id, purchase_order_id, lot_id, quantity, dispatched_at, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status",
          [shipment.id, shipment.tenantId, shipment.supplierTenantId, shipment.purchaseOrderId, shipment.lotId, shipment.quantity, shipment.dispatchedAt, shipment.status],
        );
      }
      for (const report of snapshot.conditionReports) {
        const shipment = snapshot.shipments.find((candidate) => candidate.id === report.shipmentId);
        if (!shipment) throw new Error(`Condition report ${report.id} references a missing shipment`);
        await setTenant(shipment.tenantId);
        await client.query(
          "INSERT INTO condition_reports (id, tenant_id, shipment_id, status, reading_count, first_reading_at, last_reading_at, minimum_temperature_celsius, maximum_temperature_celsius, average_temperature_celsius, excursion_count, longest_excursion_seconds, missing_sequence_count, maximum_observed_gap_seconds, coverage_complete, evidence_integrity_valid, signature_coverage, hash_chain_valid, documents, readings_hash, telemetry_merkle_root, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb, $20, $21, $22) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, maximum_observed_gap_seconds = EXCLUDED.maximum_observed_gap_seconds, coverage_complete = EXCLUDED.coverage_complete, evidence_integrity_valid = EXCLUDED.evidence_integrity_valid, documents = EXCLUDED.documents, hash_chain_valid = EXCLUDED.hash_chain_valid",
          [report.id, shipment.tenantId, report.shipmentId, report.status, report.readingCount, report.firstReadingAt ?? null, report.lastReadingAt ?? null, report.minimumTemperatureCelsius ?? null, report.maximumTemperatureCelsius ?? null, report.averageTemperatureCelsius ?? null, report.excursionCount, report.longestExcursionSeconds, report.missingSequenceCount, report.maximumObservedGapSeconds ?? null, report.coverageComplete, report.evidenceIntegrityValid, report.signatureCoverage, report.hashChainValid, encodeJson(report.documents), report.readingsHash, report.telemetryMerkleRoot, report.createdAt],
        );
      }
      for (const receipt of snapshot.receipts) {
        await setTenant(receipt.tenantId);
        await client.query(
          "INSERT INTO goods_receipts (id, tenant_id, purchase_order_id, shipment_id, site_id, received_quantity, accepted_quantity, rejected_quantity, status, received_at, received_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO UPDATE SET site_id = EXCLUDED.site_id, accepted_quantity = EXCLUDED.accepted_quantity, rejected_quantity = EXCLUDED.rejected_quantity, status = EXCLUDED.status",
          [receipt.id, receipt.tenantId, receipt.purchaseOrderId, receipt.shipmentId, receipt.siteId, receipt.receivedQuantity, receipt.acceptedQuantity ?? null, receipt.rejectedQuantity ?? null, receipt.status, receipt.receivedAt, receipt.receivedBy],
        );
      }
      for (const event of snapshot.inventoryEvents) {
        await setTenant(event.tenantId);
        await client.query(
          "INSERT INTO inventory_events (id, tenant_id, lot_id, site_id, kind, quantity, unit, source_id, reason, reason_code, created_at, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO UPDATE SET reason = EXCLUDED.reason, reason_code = EXCLUDED.reason_code",
          [event.id, event.tenantId, event.lotId, event.siteId, event.kind, event.quantity, event.unit, event.sourceId, event.reason ?? null, event.reasonCode ?? null, event.createdAt, event.createdBy],
        );
      }
      for (const holding of snapshot.holdings) {
        await setTenant(holding.tenantId);
        await client.query(
          "INSERT INTO inventory_holdings (tenant_id, lot_id, site_id, unit, on_hand, quarantined, usable) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (tenant_id, lot_id, site_id, unit) DO UPDATE SET on_hand = EXCLUDED.on_hand, quarantined = EXCLUDED.quarantined, usable = EXCLUDED.usable",
          [holding.tenantId, holding.lotId, holding.siteId, holding.unit, holding.onHand, holding.quarantined, holding.usable],
        );
      }
      for (const decision of snapshot.qaDecisions) {
        const receipt = snapshot.receipts.find((candidate) => candidate.id === decision.receiptId);
        if (!receipt) throw new Error(`QA decision ${decision.id} references a missing receipt`);
        await setTenant(receipt.tenantId);
        await client.query(
          "INSERT INTO qa_decisions (id, tenant_id, receipt_id, status, reason, adjustment_bps, evidence_hash, decided_by, decided_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, reason = EXCLUDED.reason, adjustment_bps = EXCLUDED.adjustment_bps",
          [decision.id, receipt.tenantId, decision.receiptId, decision.status, decision.reason, decision.adjustmentBps, decision.evidenceHash, decision.decidedBy, decision.decidedAt],
        );
      }
      for (const settlement of snapshot.settlements) {
        const po = snapshot.purchaseOrders.find((candidate) => candidate.id === settlement.purchaseOrderId);
        if (!po) throw new Error(`Settlement ${settlement.id} references a missing purchase order`);
        await setTenant(po.tenantId);
        await client.query(
          "INSERT INTO settlements (id, tenant_id, purchase_order_id, amount_base_units, adjustment_bps, supplier_amount_base_units, buyer_credit_base_units, status, payment_reference, pending_action, payment_action_previous_status, confirmed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO UPDATE SET adjustment_bps = EXCLUDED.adjustment_bps, supplier_amount_base_units = EXCLUDED.supplier_amount_base_units, buyer_credit_base_units = EXCLUDED.buyer_credit_base_units, status = EXCLUDED.status, payment_reference = EXCLUDED.payment_reference, pending_action = EXCLUDED.pending_action, payment_action_previous_status = EXCLUDED.payment_action_previous_status, confirmed_at = EXCLUDED.confirmed_at",
          [settlement.id, po.tenantId, settlement.purchaseOrderId, settlement.amountBaseUnits.toString(), settlement.adjustmentBps, settlement.supplierAmountBaseUnits?.toString() ?? null, settlement.buyerCreditBaseUnits?.toString() ?? null, settlement.status, settlement.paymentReference ?? null, settlement.pendingAction ?? null, settlement.paymentActionPreviousStatus ?? null, settlement.confirmedAt ?? null],
        );
      }
      for (const recall of snapshot.recalls) {
        await setTenant(recall.tenantId);
        await client.query(
          "INSERT INTO recalls (id, tenant_id, lot_id, reason, status, created_at, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET reason = EXCLUDED.reason, status = EXCLUDED.status",
          [recall.id, recall.tenantId, recall.lotId, recall.reason, recall.status, recall.createdAt, recall.createdBy],
        );
      }
      for (const [key, result] of Object.entries(snapshot.idempotency)) {
        const tenantId = snapshot.tenants
          .map((tenant) => tenant.id)
          .filter((candidate) => key.startsWith(`${candidate}:`))
          .sort((left, right) => right.length - left.length)[0];
        if (!tenantId) throw new Error(`Idempotency key ${key} is not scoped to a known tenant`);
        await setTenant(tenantId);
        await client.query(
          "INSERT INTO nischit_idempotency (idempotency_key, tenant_id, result) VALUES ($1, $2, $3::jsonb) ON CONFLICT (idempotency_key) DO UPDATE SET result = EXCLUDED.result",
          [key, tenantId, encodeJson(result)],
        );
      }
      for (const [purchaseOrderId, signature] of Object.entries(snapshot.verificationSignatures)) {
        const purchaseOrder = snapshot.purchaseOrders.find((candidate) => candidate.id === purchaseOrderId);
        if (!purchaseOrder) throw new Error(`Verification signature ${purchaseOrderId} references a missing purchase order`);
        await setTenant(purchaseOrder.tenantId);
        await client.query(
          "INSERT INTO verification_signatures (purchase_order_id, tenant_id, signature) VALUES ($1, $2, $3) ON CONFLICT (purchase_order_id) DO UPDATE SET signature = EXCLUDED.signature",
          [purchaseOrderId, purchaseOrder.tenantId, signature],
        );
      }
      for (const event of snapshot.audit) {
        await setTenant(event.tenantId);
        await client.query(
          "INSERT INTO audit_events (id, tenant_id, actor_id, action, resource_type, resource_id, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) ON CONFLICT (id) DO NOTHING",
          [event.id, event.tenantId, event.actorId, event.action, event.resourceType, event.resourceId, encodeJson(event.metadata), event.createdAt],
        );
      }
      for (const event of events) {
        await setTenant(event.tenantId);
        await client.query(
          "INSERT INTO outbox_events (id, tenant_id, topic, payload) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (id) DO NOTHING",
          [event.id, event.tenantId, event.topic, encodeJson(event.payload)],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}
