import type { PageId, WorkRow, WorkspaceRole } from "./shared";

export type Catalog = { products: Array<{ id: string; name: string; baseUnit: string }>; suppliers: Array<{ tenantId: string; name: string }> };

export const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const displayId = (value: unknown) => typeof value === "string" ? value.slice(0, 12) : "Unassigned";
export const asString = (value: unknown, fallback = "Unassigned") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;
const detailValue = (value: unknown): string | undefined => {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).trim();
  return text || undefined;
};
const detailLine = (...values: unknown[]) => values.map(detailValue).filter((value): value is string => Boolean(value)).join(" · ") || "No additional details";
const measuredValue = (value: unknown, unit: unknown): string | undefined => {
  const amount = detailValue(value);
  if (amount === undefined) return undefined;
  const unitLabel = detailValue(unit);
  return unitLabel ? `${amount} ${unitLabel}` : amount;
};
export const mapRows = (page: PageId, payload: unknown): WorkRow[] => {
  if (!Array.isArray(payload)) return [];
  return payload.map((item, index) => {
    const raw = asRecord(item);
    const id = asString(raw.purchaseOrderId ?? raw.shipmentId ?? raw.receiptId ?? raw.lotId ?? raw.id, `record-${index + 1}`);
    if (page === "receiving") return { id, reference: displayId(raw.shipmentId), subject: asString(raw.productName), state: "Awaiting receipt", detail: detailLine(measuredValue(raw.quantity, raw.unit), raw.manufacturerLotNumber ? `Lot ${raw.manufacturerLotNumber}` : undefined), raw };
    if (page === "qa") {
      const received = detailValue(raw.receivedQuantity);
      return { id, reference: displayId(raw.receiptId), subject: asString(raw.productName), state: asString(raw.conditionStatus, "pending_qa"), detail: detailLine(received === undefined ? undefined : `${received} received`, raw.siteId), raw };
    }
    if (page === "settlement") return { id, reference: displayId(raw.purchaseOrderId), subject: asString(raw.supplierTenantName), state: asString(raw.settlementStatus), detail: detailLine(raw.amountBaseUnits, raw.token, raw.qaStatus ? `QA ${raw.qaStatus}` : undefined), raw };
    if (page === "inventory") {
      const usable = detailValue(raw.usable);
      const onHand = detailValue(raw.onHand);
      return { id, reference: displayId(raw.lotId), subject: asString(raw.siteId), state: raw.quarantined ? "quarantined" : "usable", detail: detailLine(usable === undefined ? undefined : `${usable} usable`, onHand === undefined ? undefined : `${onHand} on hand`), raw };
    }
    if (page === "audit") return { id, reference: displayId(raw.id), subject: asString(raw.action), state: asString(raw.resourceType), detail: detailLine(raw.actorId, raw.createdAt), raw };
    if (page === "settings") return { id, reference: asString(raw.id ?? raw.code), subject: asString(raw.name ?? raw.label), state: raw.active === false ? "inactive" : "active", detail: detailLine(raw.kind ?? raw.timezone), raw };
    if (raw.productName) return { id, reference: displayId(raw.purchaseOrderId), subject: asString(raw.productName), state: asString(raw.status), detail: detailLine(measuredValue(raw.quantity, raw.unit), raw.buyerTenantName ?? raw.token), raw };
    return { id, reference: displayId(raw.id), subject: asString(raw.name ?? raw.productId), state: asString(raw.status), detail: detailLine(measuredValue(raw.quantity, raw.unit), raw.token), raw };
  });
};

export const previewCatalog: Catalog = {
  products: [
    { id: "prod_taq", name: "High-Fidelity Taq Polymerase 5U/µL", baseUnit: "vials" },
    { id: "prod_dntp", name: "Ultra-Pure Clinical dNTP Mix (10mM each)", baseUnit: "kits" },
    { id: "prod_buf", name: "Sterile Nuclease-Free Buffer 10X", baseUnit: "bottles" },
  ],
  suppliers: [
    { tenantId: "preview-supplier", name: "Apex BioReagents Inc." },
    { tenantId: "preview-supplier-2", name: "Biolytic Synthesis Labs" },
  ],
};

export const getPreviewPayload = (page: PageId, role: WorkspaceRole): unknown => {
  if (page === "purchase-orders" || (page === "overview" && (role === "buyer" || role === "auditor"))) {
    return [
      {
        purchaseOrderId: "po_4f82a1b9e02c",
        productId: "prod_taq",
        productName: "High-Fidelity Taq Polymerase 5U/µL",
        status: "funded",
        quantity: 50,
        unit: "vials",
        token: "TEST_USD",
        buyerTenantName: "Nischit Laboratory",
        supplierTenantId: "preview-supplier",
        availableActions: ["grant_access"],
      },
      {
        purchaseOrderId: "po_9b17e42d718a",
        productId: "prod_dntp",
        productName: "Ultra-Pure Clinical dNTP Mix",
        status: "acknowledged",
        quantity: 120,
        unit: "kits",
        token: "TEST_USD",
        buyerTenantName: "Nischit Laboratory",
        supplierTenantId: "preview-supplier",
        availableActions: [],
      },
    ];
  }
  if (page === "receiving" || (page === "overview" && role === "receiving")) {
    return [
      {
        shipmentId: "shp_81a2f309b4d1",
        purchaseOrderId: "po_4f82a1b9e02c",
        productName: "High-Fidelity Taq Polymerase 5U/µL",
        quantity: 50,
        unit: "vials",
        manufacturerLotNumber: "LOT-2026-0819",
        status: "in_transit",
        availableSites: [
          { id: "site_cold_a", name: "Cold Storage Bay A (2-8°C)" },
          { id: "site_dock_q", name: "Dock Quarantine Bay 1" },
        ],
      },
    ];
  }
  if (page === "qa" || (page === "overview" && role === "qa")) {
    return [
      {
        receiptId: "rcpt_6c29d107a3f8",
        purchaseOrderId: "po_9b17e42d718a",
        productName: "Ultra-Pure Clinical dNTP Mix",
        conditionStatus: "pending_qa",
        receivedQuantity: 120,
        siteId: "Dock Quarantine Bay 1",
        status: "received",
        availableSites: [
          { id: "site_cold_a", name: "Cold Storage Bay A (2-8°C)" },
        ],
      },
    ];
  }
  if (page === "settlement" || (page === "overview" && role === "finance")) {
    return [
      {
        purchaseOrderId: "po_4f82a1b9e02c",
        supplierTenantName: "Apex BioReagents Inc.",
        settlementStatus: "authorized",
        amountBaseUnits: "12500",
        token: "TEST_USD",
        qaStatus: "accepted",
        status: "received",
      },
    ];
  }
  if (page === "inventory") {
    return [
      {
        lotId: "lot_992a104b2c15",
        siteId: "Central Biologics Vault",
        quarantined: false,
        usable: "450",
        onHand: "450",
      },
      {
        lotId: "lot_883b246a09de",
        siteId: "Dock Quarantine Bay 1",
        quarantined: true,
        usable: "0",
        onHand: "50",
      },
    ];
  }
  if (page === "audit") {
    return [
      {
        id: "evt_331f82b4",
        action: "qa.decision_committed",
        resourceType: "receipt",
        actorId: "preview-qa@nischit.app",
        createdAt: "2026-09-23 10:14:02 UTC",
      },
      {
        id: "evt_330e91a0",
        action: "escrow.settlement_authorized",
        resourceType: "settlement",
        actorId: "preview-finance@nischit.app",
        createdAt: "2026-09-23 09:48:15 UTC",
      },
      {
        id: "evt_329d77f2",
        action: "shipment.received",
        resourceType: "shipment",
        actorId: "preview-receiver@nischit.app",
        createdAt: "2026-09-23 08:30:44 UTC",
      },
    ];
  }
  if (page === "settings") {
    return {
      sites: [
        { id: "site_cold_a", name: "Cold Storage Bay A (2-8°C)", active: true, kind: "refrigerated" },
        { id: "site_dock_q", name: "Dock Quarantine Bay 1", active: true, kind: "quarantine" },
        { id: "site_vault", name: "Central Biologics Vault", active: true, kind: "storage" },
      ],
    };
  }
  if (role === "supplier") {
    return [
      {
        purchaseOrderId: "po_4f82a1b9e02c",
        productName: "High-Fidelity Taq Polymerase 5U/µL",
        status: "funded",
        quantity: 50,
        unit: "vials",
        token: "TEST_USD",
        buyerTenantName: "Nischit Laboratory",
        availableActions: ["acknowledge"],
      },
    ];
  }
  return [];
};
