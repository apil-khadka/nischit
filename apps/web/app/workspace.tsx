"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Table, proportional, type TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import { isAbortError, request as requestApi } from "./api-client";
import { isPreviewIdentityAllowed } from "./identity";
import { NischitMark } from "./brand";
import { LiveVerificationResults, type LiveVerificationPair } from "./live-verification-results";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";

type WorkspaceRole = "buyer" | "supplier" | "receiving" | "qa" | "finance" | "auditor";
type PageId = "overview" | "purchase-orders" | "receiving" | "qa" | "inventory" | "settlement" | "audit" | "integrations" | "settings" | "public";

type WorkRow = {
  id: string;
  reference: string;
  subject: string;
  state: string;
  detail: string;
  raw: Record<string, unknown>;
};

type PageState = {
  status: "idle" | "loading" | "ready" | "error";
  rows: WorkRow[];
  message?: string;
};

type IntegrationReadiness = {
  status: "loading" | "ready" | "unavailable";
  ok?: boolean;
  checks?: Record<string, string>;
  checkedAt?: string;
  message?: string;
};

type RoleSession = { role: WorkspaceRole; tenantId: string; userId: string; name: string; tenantName: string; kind?: "preview" | "verified"; roles?: string[]; email?: string };
type Catalog = { products: Array<{ id: string; name: string; baseUnit: string }>; suppliers: Array<{ tenantId: string; name: string }> };

const pageMeta: Record<PageId, { label: string; title: string; description: string }> = {
  overview: { label: "Overview", title: "Work that needs your attention", description: "Decisions are ordered by the next accountable step in the record." },
  "purchase-orders": { label: "Purchase orders", title: "Purchase orders", description: "Terms, grants, and commercial state across the current workspace." },
  receiving: { label: "Receiving", title: "Receiving queue", description: "Confirm what physically arrived before QA reviews it." },
  qa: { label: "QA review", title: "Quality review", description: "Review evidence and record an accountable acceptance decision." },
  inventory: { label: "Inventory", title: "Inventory and lots", description: "Trace usable, quarantined, and consumed stock by site." },
  settlement: { label: "Settlement", title: "Settlement queue", description: "Payment follows the recorded acceptance decision." },
  audit: { label: "Audit", title: "Audit trail", description: "Review tenant-scoped actions and the record behind each decision." },
  integrations: { label: "Integrations", title: "Connected systems", description: "Review server-reported integration configuration and readiness." },
  settings: { label: "Settings", title: "Workspace settings", description: "Configure sites and usage reasons for this tenant." },
  public: { label: "Public receipt", title: "Verify a receipt", description: "Read the public commitment without private evidence or tenant data." },
};

const roleDefaults: Record<WorkspaceRole, RoleSession> = {
  buyer: { role: "buyer", tenantId: "preview-buyer", userId: "preview-buyer-owner", name: "Procurement owner", tenantName: "Nischit Laboratory" },
  supplier: { role: "supplier", tenantId: "preview-supplier", userId: "preview-supplier-manager", name: "Supplier manager", tenantName: "Nischit Reagents" },
  receiving: { role: "receiving", tenantId: "preview-buyer", userId: "preview-receiver", name: "Receiving operator", tenantName: "Nischit Laboratory" },
  qa: { role: "qa", tenantId: "preview-buyer", userId: "preview-qa", name: "QA reviewer", tenantName: "Nischit Laboratory" },
  finance: { role: "finance", tenantId: "preview-buyer", userId: "preview-finance", name: "Finance operator", tenantName: "Nischit Laboratory" },
  auditor: { role: "auditor", tenantId: "preview-buyer", userId: "preview-buyer-owner", name: "Auditor", tenantName: "Nischit Laboratory" },
};

const configuredRole = process.env.NEXT_PUBLIC_NISCHIT_ROLE as WorkspaceRole | undefined;
const configuredSession = roleDefaults[configuredRole && configuredRole in roleDefaults ? configuredRole : "buyer"];
const initialSession: RoleSession | null = isPreviewIdentityAllowed() ? {
  ...configuredSession,
  kind: "preview",
  tenantId: process.env.NEXT_PUBLIC_NISCHIT_TENANT_ID ?? configuredSession.tenantId,
  userId: process.env.NEXT_PUBLIC_NISCHIT_USER_ID ?? configuredSession.userId,
  name: process.env.NEXT_PUBLIC_NISCHIT_USER_NAME ?? configuredSession.name,
  tenantName: process.env.NEXT_PUBLIC_NISCHIT_TENANT_NAME ?? configuredSession.tenantName,
} : null;

async function request<T>(path: string, session?: RoleSession, body?: Record<string, unknown>, idempotencyKey?: string, signal?: AbortSignal) {
  return requestApi<T>(apiBase, path, { session, body, idempotencyKey, signal });
}

const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const displayId = (value: unknown) => typeof value === "string" ? value.slice(0, 12) : "Unassigned";
const asString = (value: unknown, fallback = "Unassigned") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;
const statusVariant = (state: string): "neutral" | "info" | "success" | "warning" | "error" => {
  if (["accepted", "confirmed", "closed", "received", "funded"].includes(state)) return "success";
  if (["held", "exception", "pending_qa", "awaiting_qa", "in_transit", "draft"].includes(state)) return "warning";
  if (["rejected", "refunded", "unknown"].includes(state)) return "error";
  return "info";
};

const StateMark = ({ state }: { state: string }) => {
  const variant = statusVariant(state);
  const dotVariant = variant === "info" ? "accent" : variant;
  const label = state.replaceAll("_", " ");
  return <span className="state-mark"><StatusDot variant={dotVariant} label={label} /><span>{label}</span></span>;
};

const mapRows = (page: PageId, payload: unknown): WorkRow[] => {
  if (!Array.isArray(payload)) return [];
  return payload.map((item, index) => {
    const raw = asRecord(item);
    const id = asString(raw.purchaseOrderId ?? raw.shipmentId ?? raw.receiptId ?? raw.lotId ?? raw.id, `record-${index + 1}`);
    if (page === "receiving") return { id, reference: displayId(raw.shipmentId), subject: asString(raw.productName), state: "Awaiting receipt", detail: `${asString(raw.quantity)} ${asString(raw.unit)} · lot ${asString(raw.manufacturerLotNumber)}`, raw };
    if (page === "qa") return { id, reference: displayId(raw.receiptId), subject: asString(raw.productName), state: asString(raw.conditionStatus, "pending_qa"), detail: `${asString(raw.receivedQuantity)} received at ${asString(raw.siteId)}`, raw };
    if (page === "settlement") return { id, reference: displayId(raw.purchaseOrderId), subject: asString(raw.supplierTenantName), state: asString(raw.settlementStatus), detail: `${asString(raw.amountBaseUnits)} ${asString(raw.token)} · QA ${asString(raw.qaStatus, "pending")}`, raw };
    if (page === "inventory") return { id, reference: displayId(raw.lotId), subject: asString(raw.siteId), state: raw.quarantined ? "quarantined" : "usable", detail: `${asString(raw.usable)} usable · ${asString(raw.onHand)} on hand`, raw };
    if (page === "audit") return { id, reference: displayId(raw.id), subject: asString(raw.action), state: asString(raw.resourceType), detail: `${asString(raw.actorId)} · ${asString(raw.createdAt)}`, raw };
    if (page === "settings") return { id, reference: asString(raw.id ?? raw.code), subject: asString(raw.name ?? raw.label), state: raw.active === false ? "inactive" : "active", detail: asString(raw.kind ?? raw.timezone), raw };
    if (raw.productName) return { id, reference: displayId(raw.purchaseOrderId), subject: asString(raw.productName), state: asString(raw.status), detail: `${asString(raw.quantity)} ${asString(raw.unit)} · ${asString(raw.buyerTenantName, asString(raw.token))}`, raw };
    return { id, reference: displayId(raw.id), subject: asString(raw.name ?? raw.productId), state: asString(raw.status), detail: `${asString(raw.quantity)} ${asString(raw.unit)} · ${asString(raw.token)}`, raw };
  });
};

const previewCatalog: Catalog = {
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

const getPreviewPayload = (page: PageId, role: WorkspaceRole): unknown => {
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

export default function Workspace() {
  const [session, setSession] = useState<RoleSession | null>(initialSession);
  const [authStatus, setAuthStatus] = useState<"loading" | "authenticated" | "signed-out" | "unavailable">(initialSession ? "authenticated" : "loading");
  const [activePage, setActivePage] = useState<PageId>("overview");
  const [overviewTab, setOverviewTab] = useState<"queue" | "workflow" | "rules">("queue");
  const [pageState, setPageState] = useState<PageState>({ status: "idle", rows: [] });
  const [integrationReadiness, setIntegrationReadiness] = useState<IntegrationReadiness>({ status: "loading" });
  const [selected, setSelected] = useState<WorkRow>();
  const [notice, setNotice] = useState<{ status: "info" | "success" | "warning" | "error"; title: string; description: string }>();
  const [receiveQuantity, setReceiveQuantity] = useState<number | null>(null);
  const [receiveSite, setReceiveSite] = useState("");
  const [qaStatus, setQaStatus] = useState("accepted");
  const [qaReason, setQaReason] = useState("");
  const [publicId, setPublicId] = useState("");
  const [catalog, setCatalog] = useState<Catalog>({ products: [], suppliers: [] });
  const [createPOOpen, setCreatePOOpen] = useState(false);
  const [poProductId, setPoProductId] = useState("");
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poQuantity, setPoQuantity] = useState<number | null>(null);
  const [poAmount, setPoAmount] = useState("");
  const [poToken, setPoToken] = useState("TEST_USD");
  const [poMaxTelemetryGapSeconds, setPoMaxTelemetryGapSeconds] = useState<number | null>(null);
  const [poAllowAdjustmentBps, setPoAllowAdjustmentBps] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<string>();
  const pageRequestRef = useRef<AbortController | null>(null);
  const commandKeysRef = useRef(new Map<string, string>());

  const refreshIntegrationReadiness = useCallback(async () => {
    setIntegrationReadiness({ status: "loading" });
    try {
      const response = await fetch(`${apiBase}/health/ready`, { cache: "no-store", credentials: "omit" });
      const payload = asRecord(await response.json());
      const checks = asRecord(payload.checks);
      setIntegrationReadiness({
        status: "ready",
        ok: payload.ok === true && response.ok,
        checks: Object.fromEntries(Object.entries(checks).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
        checkedAt: new Date().toISOString(),
        message: response.ok ? undefined : "The API is responding, but one or more required services are not ready.",
      });
    } catch {
      setIntegrationReadiness({ status: "unavailable", message: "The API readiness endpoint could not be reached." });
    }
  }, []);

  useEffect(() => {
    void refreshIntegrationReadiness();
  }, [refreshIntegrationReadiness]);

  useEffect(() => {
    if (initialSession) return;
    let cancelled = false;
    void requestApi<RoleSession>(apiBase, "/session")
      .then((authenticatedSession) => {
        if (cancelled) return;
        setSession({ ...authenticatedSession, kind: "verified" });
        setAuthStatus("authenticated");
      })
      .catch((error) => {
        if (cancelled) return;
        setAuthStatus(error instanceof Error && "status" in error && (error as { status?: unknown }).status === 401 ? "signed-out" : "unavailable");
      });
    return () => { cancelled = true; };
  }, []);

  const idempotencyKeyFor = (operation: string) => {
    const existing = commandKeysRef.current.get(operation);
    if (existing) return existing;
    const key = `web-${operation.replaceAll(/[^A-Za-z0-9._-]/g, "-")}`;
    commandKeysRef.current.set(operation, key);
    return key;
  };

  const loadPage = useCallback(async (page: PageId) => {
    if (!session) return;
    pageRequestRef.current?.abort();
    const controller = new AbortController();
    pageRequestRef.current = controller;
    setPageState((current) => ({ ...current, status: "loading", message: undefined }));
    setSelected(undefined);
    try {
      if (page === "public" || page === "integrations") {
        setPageState({ status: "ready", rows: [], message: page === "public" ? "Enter a purchase-order receipt ID to verify it." : undefined });
        return;
      }
      const endpoint = page === "overview"
        ? session.role === "supplier" ? "/supplier/inbox" : session.role === "receiving" ? "/receiving/queue" : session.role === "qa" ? "/qa/queue" : session.role === "finance" ? "/finance/queue" : session.role === "auditor" ? "/audit" : "/purchase-orders"
        : page === "purchase-orders" ? session.role === "supplier" ? "/supplier/inbox" : "/purchase-orders"
        : page === "receiving" ? "/receiving/queue"
        : page === "qa" ? "/qa/queue"
        : page === "inventory" ? "/holdings"
        : page === "settlement" ? "/finance/queue"
        : page === "audit" ? "/audit"
        : "/tenant/settings";
      const payload = await request<unknown>(endpoint, session, undefined, undefined, controller.signal);
      let normalizedPayload: unknown = payload;
      if (page === "purchase-orders" && session.role === "buyer") {
        const [products, suppliers] = await Promise.all([
          request<Array<{ id: string; name: string; baseUnit: string }>>("/products", session, undefined, undefined, controller.signal),
          request<Array<{ tenantId: string; name: string }>>("/suppliers", session, undefined, undefined, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setCatalog({ products, suppliers });
        if (Array.isArray(payload)) {
          const productNames = new Map(products.map((product) => [product.id, product.name]));
          normalizedPayload = payload.map((item) => {
            const record = asRecord(item);
            return { ...record, productName: productNames.get(asString(record.productId)) ?? asString(record.productId) };
          });
        }
      }
      const rows = mapRows(page, page === "settings" ? (asRecord(payload).sites ?? []) : normalizedPayload);
      if (controller.signal.aborted) return;
      setPageState({ status: "ready", rows, message: rows.length ? undefined : "No work is waiting in this area." });
    } catch (error) {
      if (isAbortError(error)) return;
      if (session.kind === "preview") {
        if (page === "purchase-orders" && session.role === "buyer") {
          setCatalog(previewCatalog);
        }
        const previewPayload = getPreviewPayload(page, session.role);
        const rows = mapRows(page, page === "settings" ? (asRecord(previewPayload).sites ?? []) : previewPayload);
        setPageState({
          status: "ready",
          rows,
          message: rows.length ? undefined : "No work is waiting in this area.",
        });
        return;
      }
      setPageState({ status: "error", rows: [], message: error instanceof Error ? error.message : "The work queue could not be loaded" });
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void loadPage(activePage);
    return () => pageRequestRef.current?.abort();
  }, [activePage, loadPage, session]);

  const selectPage = (page: PageId) => {
    setNotice(undefined);
    setActivePage(page);
    setOverviewTab("queue");
  };

  async function runCommand(path: string, body?: Record<string, unknown>) {
    if (!session || !selected || pendingCommand) return;
    setPendingCommand(path);
    try {
      await request(path, session, body, idempotencyKeyFor(path));
      setNotice({ status: "success", title: "Record updated", description: "The next accountable team can now see the new state." });
      await loadPage(activePage);
    } catch (error) {
      if (session.kind === "preview") {
        setNotice({ status: "success", title: "Record updated (Preview)", description: "The next accountable team can now see the simulated state." });
        return;
      }
      setNotice({ status: "error", title: "Action was not recorded", description: error instanceof Error ? error.message : "The server rejected this action" });
    } finally {
      setPendingCommand(undefined);
    }
  }

  async function createPurchaseOrder() {
    if (!session || pendingCommand || !poProductId || !poSupplierId || !poQuantity || !poAmount || !poToken || !poMaxTelemetryGapSeconds) return;
    setPendingCommand("purchase-order.create");
    try {
      await request("/purchase-orders", session, {
        productId: poProductId, supplierTenantId: poSupplierId, quantity: poQuantity,
        amountBaseUnits: poAmount, token: poToken,
        policy: {
          maxTelemetryGapSeconds: poMaxTelemetryGapSeconds,
          allowAdjustmentBps: poAllowAdjustmentBps,
        },
      }, idempotencyKeyFor("purchase-order.create"));
      setCreatePOOpen(false);
      setPoProductId(""); setPoSupplierId(""); setPoQuantity(null); setPoAmount(""); setPoMaxTelemetryGapSeconds(null); setPoAllowAdjustmentBps(false);
      setNotice({ status: "success", title: "Purchase order created", description: "Open the new record to grant the supplier access to its terms." });
      commandKeysRef.current.delete("purchase-order.create");
      await loadPage("purchase-orders");
    } catch (error) {
      if (session.kind === "preview") {
        setCreatePOOpen(false);
        setPoProductId(""); setPoSupplierId(""); setPoQuantity(null); setPoAmount(""); setPoMaxTelemetryGapSeconds(null); setPoAllowAdjustmentBps(false);
        setNotice({ status: "success", title: "Purchase order created (Preview)", description: "Simulated record created in preview. No payment has been sent." });
        return;
      }
      setNotice({ status: "error", title: "Purchase order was not created", description: error instanceof Error ? error.message : "The server rejected the order" });
    } finally {
      setPendingCommand(undefined);
    }
  }

  async function verifyPublicReceipt() {
    if (!publicId.trim()) return;
    pageRequestRef.current?.abort();
    const controller = new AbortController();
    pageRequestRef.current = controller;
    try {
      const payload = await request(`/public/purchase-orders/${encodeURIComponent(publicId.trim())}/verification`, undefined, undefined, undefined, controller.signal);
      if (controller.signal.aborted) return;
      setPageState({ status: "ready", rows: mapRows("public", [payload]), message: undefined });
      setSelected(mapRows("public", [payload])[0]);
    } catch (error) {
      if (isAbortError(error)) return;
      if (session?.kind === "preview") {
        setPageState({ status: "ready", rows: [], message: "Live receipt verification is unavailable in preview mode." });
        setNotice({ status: "warning", title: "No live receipt was verified", description: "Preview data cannot confirm a public Solana receipt or Tempo payment. Use a verified API session and a recorded receipt." });
        return;
      }
      setNotice({ status: "error", title: "Receipt could not be verified", description: error instanceof Error ? error.message : "No public receipt was found" });
    }
  }

  const columns = useMemo<TableColumn<WorkRow>[]>(() => [
    { key: "reference", header: "Reference", width: proportional(1), renderCell: (row: WorkRow) => <Text type="supporting" className="mono">{row.reference}</Text> },
    { key: "subject", header: "Record", width: proportional(2), renderCell: (row: WorkRow) => <Text weight="semibold">{row.subject}</Text> },
    { key: "state", header: "State", width: proportional(1), renderCell: (row: WorkRow) => <StateMark state={row.state} /> },
    { key: "detail", header: "Details", width: proportional(2), renderCell: (row: WorkRow) => <Text type="supporting">{row.detail}</Text> },
    {
      key: "open",
      header: "",
      width: proportional(1),
      align: "end",
      renderCell: (row: WorkRow) => {
        const isInspecting = selected?.id === row.id;
        return (
          <Button
            label={isInspecting ? "Inspecting" : "Inspect →"}
            variant={isInspecting ? "primary" : "ghost"}
            size="sm"
            onClick={() => setSelected(isInspecting ? undefined : row)}
          />
        );
      },
    },
  ], [selected?.id]);

  const queueCounts = useMemo<Record<PageId, number>>(() => ({
    overview: activePage === "overview" && pageState.status === "ready" ? pageState.rows.length : 0,
    "purchase-orders": activePage === "purchase-orders" && pageState.status === "ready" ? pageState.rows.length : 0,
    receiving: activePage === "receiving" && pageState.status === "ready" ? pageState.rows.length : 0,
    qa: activePage === "qa" && pageState.status === "ready" ? pageState.rows.length : 0,
    inventory: activePage === "inventory" && pageState.status === "ready" ? pageState.rows.length : 0,
    settlement: activePage === "settlement" && pageState.status === "ready" ? pageState.rows.length : 0,
    audit: activePage === "audit" && pageState.status === "ready" ? pageState.rows.length : 0,
    integrations: 0,
    settings: 0,
    public: 0,
  }), [activePage, pageState.rows.length, pageState.status]);

  const sites = selected?.raw.availableSites && Array.isArray(selected.raw.availableSites) ? selected.raw.availableSites.map(asRecord) : [];
  const selectedActions = Array.isArray(selected?.raw.availableActions) ? selected?.raw.availableActions.map(String) : [];

  if (!session && authStatus === "loading") return <SessionLoadingState />;
  if (!session) return <ProductionAccessGate status={authStatus === "signed-out" ? "signed-out" : "unavailable"} />;

  return (
    <AppShell
      height="auto"
      variant="elevated"
      contentPadding={4}
      topNav={
        <TopNav
          label="Nischit workspace"
          heading={<TopNavHeading logo={<NischitMark className="nischit-mark" />} heading="Nischit" subheading={session.tenantName} />}
          endContent={
            <div className="session-context">
              {session.kind === "preview" ? (
                <label className="workspace-role-picker-label">
                  <select
                    aria-label="Switch preview role"
                    value={session.role}
                    onChange={(e) => {
                      const newRole = e.target.value as WorkspaceRole;
                      if (roleDefaults[newRole]) {
                        setSession({ ...roleDefaults[newRole], kind: "preview" });
                      }
                    }}
                    className="workspace-role-select"
                  >
                    <option value="buyer">Role: Procurement</option>
                    <option value="supplier">Role: Supplier</option>
                    <option value="receiving">Role: Receiving</option>
                    <option value="qa">Role: QA Reviewer</option>
                    <option value="finance">Role: Finance</option>
                    <option value="auditor">Role: Auditor</option>
                  </select>
                </label>
              ) : null}
              <a href="/" className="workspace-exit-link">Public Site ↗</a>
              <Text type="supporting">{session.name}</Text>
              <span className="session-state">{session.kind === "verified" ? "Verified session" : "Preview identity"}</span>
            </div>
          }
        />
      }
      sideNav={
        <ModernWorkspaceSidebar
          activePage={activePage}
          selectPage={selectPage}
          session={session}
          queueCounts={queueCounts}
        />
      }
      >
      <div className="workspace">
        <header className="workspace-page-heading">
          <div>
            <Text type="supporting" className="workspace-page-eyebrow">{pageMeta[activePage].label} · {session.role}</Text>
            <Heading level={1}>{pageMeta[activePage].title}</Heading>
            <Text as="p" type="supporting">{pageMeta[activePage].description}</Text>
          </div>
        </header>

        {/* Top Workbench Action & Breadcrumb Toolbar */}
        <div className="workbench-toolbar">
          <div className="workbench-toolbar-left">
            <div className="workbench-breadcrumbs">
              <span className="crumb-root">Workspace</span>
              <span className="crumb-sep">/</span>
              <span className={`crumb-page ${!selected ? "crumb-active" : ""}`}>{pageMeta[activePage].label}</span>
              {selected ? (
                <>
                  <span className="crumb-sep">/</span>
                  <span className="crumb-active">{selected.reference}</span>
                </>
              ) : null}
            </div>

            {activePage === "integrations" || activePage === "public" ? null : activePage === "overview" ? (
              <div className="workbench-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={overviewTab === "queue"}
                  className={`workbench-tab-btn ${overviewTab === "queue" ? "active" : ""}`}
                  onClick={() => setOverviewTab("queue")}
                >
                  <span>Queue</span>
                  {pageState.rows.length ? <span className="workbench-tab-badge">{pageState.rows.length}</span> : null}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={overviewTab === "workflow"}
                  className={`workbench-tab-btn ${overviewTab === "workflow" ? "active" : ""}`}
                  onClick={() => setOverviewTab("workflow")}
                >
                  <span>Workflow</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={overviewTab === "rules"}
                  className={`workbench-tab-btn ${overviewTab === "rules" ? "active" : ""}`}
                  onClick={() => setOverviewTab("rules")}
                >
                  <span>Access rules</span>
                </button>
              </div>
            ) : (
              <div className="workbench-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={overviewTab !== "rules"}
                  className={`workbench-tab-btn ${overviewTab !== "rules" ? "active" : ""}`}
                  onClick={() => setOverviewTab("queue")}
                >
                  <span>Queue</span>
                  {pageState.rows.length ? <span className="workbench-tab-badge">{pageState.rows.length}</span> : null}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={overviewTab === "rules"}
                  className={`workbench-tab-btn ${overviewTab === "rules" ? "active" : ""}`}
                  onClick={() => setOverviewTab("rules")}
                >
                  <span>Access rules</span>
                </button>
              </div>
            )}
          </div>

          <div className="workbench-toolbar-right">
            <Text type="supporting" className="workspace-state" aria-live="polite">
              {activePage === "integrations"
                ? integrationReadiness.status === "loading" ? "Checking integrations" : integrationReadiness.status === "unavailable" ? "API unavailable" : integrationReadiness.ok ? "API ready" : "Needs attention"
                : pageState.status === "loading" ? "Loading records" : pageState.status === "error" ? "Needs attention" : pageState.status === "idle" ? "Waiting to load" : "Ready"}
            </Text>
            {activePage !== "integrations" && activePage !== "public" ? (
              <Button
                label="Refresh"
                variant="secondary"
                size="sm"
                onClick={() => void loadPage(activePage)}
                isLoading={pageState.status === "loading"}
              />
            ) : null}
          </div>
        </div>

        {session.kind === "preview" ? (
          <Banner status="info" title="Preview workspace" description="Sample data may be synthetic. Check each record and the integration status before relying on it; this session does not establish live chain verification." />
        ) : null}

        {notice ? <Banner status={notice.status} title={notice.title} description={notice.description} isDismissable onDismiss={() => setNotice(undefined)} /> : null}

        {activePage === "public" ? (
          <Card padding={4} className="public-lookup">
            <Heading level={2}>Receipt identifier</Heading>
            <Text as="p" type="supporting">Use the purchase-order identifier shared by the organization. The result contains commitments and settlement status, never private files.</Text>
            <div className="lookup-row">
              <input aria-label="Purchase order identifier" value={publicId} onChange={(event) => setPublicId(event.target.value)} placeholder="Paste purchase-order ID" />
              <Button label="Verify receipt" variant="primary" onClick={() => void verifyPublicReceipt()} />
            </div>
            {selected?.raw.liveVerification ? (
              <LiveVerificationResults results={selected.raw.liveVerification as LiveVerificationPair} />
            ) : null}
          </Card>
        ) : null}

        {activePage === "integrations" ? (
          <IntegrationReadinessPanel readiness={integrationReadiness} onRefresh={() => void refreshIntegrationReadiness()} />
        ) : overviewTab === "rules" ? (
          <RoleRulesWindow />
        ) : overviewTab === "workflow" ? (
          <WorkflowGuide />
        ) : (
          <>
            {pageState.status === "error" ? <Banner status="error" title="This work area is unavailable" description={pageState.message} /> : null}
            {pageState.status === "ready" && !pageState.rows.length && activePage !== "public" ? (
              <Card padding={4} className="empty-queue">
                <EmptyState title="Nothing is waiting here" description={pageState.message ?? "New work will appear when another team records the preceding step."} />
              </Card>
            ) : null}

            {activePage === "purchase-orders" && session.role === "buyer" && createPOOpen ? (
              <Card padding={4} className="create-panel">
                <div>
                  <Heading level={2}>New purchase order</Heading>
                  <Text type="supporting">Set the commercial terms first. Supplier access is a separate, explicit step.</Text>
                </div>
                <div className="form-grid">
                  <Selector label="Product" options={catalog.products.map((product) => ({ value: product.id, label: `${product.name} · ${product.baseUnit}` }))} value={poProductId} onChange={setPoProductId} placeholder="Choose product" />
                  <Selector label="Supplier" options={catalog.suppliers.map((supplier) => ({ value: supplier.tenantId, label: supplier.name }))} value={poSupplierId} onChange={setPoSupplierId} placeholder="Choose supplier" />
                  <NumberInput label="Quantity" value={poQuantity} onChange={setPoQuantity} min={1} isIntegerOnly />
                  <TextInput label="Amount" value={poAmount} onChange={setPoAmount} placeholder="100000" />
                  <TextInput label="Token" value={poToken} onChange={setPoToken} />
                  <NumberInput label="Maximum telemetry gap (seconds)" value={poMaxTelemetryGapSeconds} onChange={setPoMaxTelemetryGapSeconds} min={1} isIntegerOnly />
                  <Selector
                    label="Allow settlement adjustment"
                    options={[
                      { value: "no", label: "No" },
                      { value: "yes", label: "Yes" },
                    ]}
                    value={poAllowAdjustmentBps ? "yes" : "no"}
                    onChange={(value: string) => setPoAllowAdjustmentBps(value === "yes")}
                  />
                  <div className="form-actions">
                    <Button label="Cancel" variant="ghost" isDisabled={Boolean(pendingCommand)} onClick={() => setCreatePOOpen(false)} />
                    <Button label="Create purchase order" variant="primary" isDisabled={Boolean(pendingCommand) || !poProductId || !poSupplierId || !poQuantity || !poAmount || !poToken || !poMaxTelemetryGapSeconds} isLoading={pendingCommand === "purchase-order.create"} onClick={() => void createPurchaseOrder()} />
                  </div>
                </div>
              </Card>
            ) : null}

            {activePage === "purchase-orders" && session.role === "buyer" && !createPOOpen ? (
              <div className="page-action">
                <Button label="New purchase order" variant="primary" onClick={() => setCreatePOOpen(true)} />
              </div>
            ) : null}

            {selected ? (
              <div className="workbench-split-layout">
                <div className="workbench-master-pane">
                  {pageState.rows.length ? (
                    <Card padding={0} className="queue-card">
                      <div className="queue-heading">
                        <div>
                          <Heading level={2}>{activePage === "overview" ? "Next decisions" : pageMeta[activePage].title}</Heading>
                          <Text type="supporting">{pageState.rows.length} record{pageState.rows.length === 1 ? "" : "s"} visible to this workspace</Text>
                        </div>
                      </div>
                      <Table data={pageState.rows} columns={columns} density="compact" dividers="rows" hasHover textOverflow="wrap" />
                    </Card>
                  ) : null}
                </div>
                <div className="workbench-detail-pane">
                  <InspectorWindow
                    page={activePage}
                    selected={selected}
                    session={session}
                    selectedActions={selectedActions}
                    sites={sites}
                    receiveQuantity={receiveQuantity}
                    receiveSite={receiveSite}
                    qaStatus={qaStatus}
                    qaReason={qaReason}
                    setReceiveQuantity={setReceiveQuantity}
                    setReceiveSite={setReceiveSite}
                    setQaStatus={setQaStatus}
                    setQaReason={setQaReason}
                    onCommand={runCommand}
                    isActionPending={Boolean(pendingCommand)}
                    onClose={() => setSelected(undefined)}
                  />
                </div>
              </div>
            ) : (
              <>
                {pageState.rows.length ? (
                  <Card padding={0} className="queue-card">
                    <div className="queue-heading">
                      <div>
                        <Heading level={2}>{activePage === "overview" ? "Next decisions" : pageMeta[activePage].title}</Heading>
                        <Text type="supporting">{pageState.rows.length} record{pageState.rows.length === 1 ? "" : "s"} visible to this workspace</Text>
                      </div>
                    </div>
                    <Table data={pageState.rows} columns={columns} density="balanced" dividers="rows" hasHover textOverflow="wrap" />
                  </Card>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function SidebarIcon({ page }: { page: PageId }) {
  switch (page) {
    case "overview":
      return (
        <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "purchase-orders":
      return (
        <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "receiving":
      return (
        <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    case "qa":
      return (
        <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case "inventory":
      return (
        <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case "settlement":
      return (
        <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "audit":
      return (
        <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
        </svg>
      );
    case "integrations":
      return (
        <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V4m8 3V4M6 10h12M7 20h10a2 2 0 002-2v-7a3 3 0 00-3-3H8a3 3 0 00-3 3v7a2 2 0 002 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 14h2m2 0h2" />
        </svg>
      );
    case "settings":
      return (
        <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "public":
      return (
        <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      );
  }
}

function ModernWorkspaceSidebar({
  activePage,
  selectPage,
  session,
  queueCounts,
}: {
  activePage: PageId;
  selectPage: (page: PageId) => void;
  session: RoleSession;
  queueCounts: Record<PageId, number>;
}) {
  const tenantInitials = session.tenantName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "NL";

  const workItems: PageId[] = ["overview", "purchase-orders", "receiving", "qa", "inventory", "settlement"];
  const recordItems: PageId[] = ["audit", "integrations", "settings", "public"];

  return (
    <aside className="modern-sidebar" aria-label="Workspace navigation">
      <div className="modern-sidebar-tenant">
        <div className="tenant-avatar">{tenantInitials}</div>
        <div className="tenant-info">
          <span className="tenant-name">{session.tenantName}</span>
          <span className="tenant-role-pill">{session.role.toUpperCase()}</span>
        </div>
      </div>

      <div className="modern-sidebar-section">
        <span className="modern-sidebar-label">WORKBENCH</span>
        {workItems.map((page) => {
          const count = queueCounts[page];
          const isActive = activePage === page;
          return (
            <button
              key={page}
              type="button"
              className={`modern-sidebar-item ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => selectPage(page)}
            >
              <div className="sidebar-item-left">
                <SidebarIcon page={page} />
                <span className="sidebar-item-text">{pageMeta[page].label}</span>
              </div>
              {count > 0 ? <span className="sidebar-count-badge">{count}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="modern-sidebar-section">
        <span className="modern-sidebar-label">SYSTEM</span>
        {recordItems.map((page) => {
          const count = queueCounts[page];
          const isActive = activePage === page;
          return (
            <button
              key={page}
              type="button"
              className={`modern-sidebar-item ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => selectPage(page)}
            >
              <div className="sidebar-item-left">
                <SidebarIcon page={page} />
                <span className="sidebar-item-text">{pageMeta[page].label}</span>
              </div>
              {count > 0 ? <span className="sidebar-count-badge">{count}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="modern-sidebar-footer">
        <div className={`sidebar-status-beacon ${session.kind === "preview" ? "preview" : ""}`}>
          <span className="sidebar-status-dot" />
          <span>{session.kind === "preview" ? "Preview data" : "Verified session"}</span>
        </div>
        <span className="sidebar-compliance-note">Role permissions enforced by the API</span>
      </div>
    </aside>
  );
}

function IntegrationReadinessPanel({ readiness, onRefresh }: { readiness: IntegrationReadiness; onRefresh: () => void }) {
  const checks = readiness.checks ?? {};
  const selectedRail = (value: string | undefined, expected: string, label: string) => {
    if (readiness.status !== "ready") return { value: readiness.status === "loading" ? "Checking…" : "Unavailable", state: "neutral", detail: "Refresh to load the API-reported adapter state." };
    if (!value) return { value: "Unknown", state: "neutral", detail: "No adapter information returned by the API." };
    if (value === expected) return { value: "Adapter selected", state: "info", detail: `${label} is selected by the server. This endpoint does not probe network reachability or confirm a transaction.` };
    if (value === "mock") return { value: "Preview adapter", state: "warning", detail: "Synthetic operations only. No on-chain transaction is sent." };
    return { value: "Not configured", state: "neutral", detail: `The ${label} adapter is not selected.` };
  };

  const integrations = [
    {
      name: "Database",
      value: readiness.status !== "ready" ? readiness.status === "loading" ? "Checking…" : "Unavailable" : checks.persistence === "postgres" ? "PostgreSQL" : checks.persistence === "memory" ? "In-memory store" : checks.persistence ?? "Unknown",
      state: readiness.status !== "ready" ? "neutral" : checks.persistence === "postgres" ? "success" : checks.persistence === "memory" ? "warning" : "neutral",
      detail: readiness.status !== "ready" ? "Refresh to load the API-reported persistence state." : checks.persistence === "postgres" ? "The API initialized with PostgreSQL persistence." : checks.persistence === "memory" ? "Current records use process memory and may not survive a restart." : "Persistence state was not reported.",
    },
    {
      name: "Identity",
      value: readiness.status !== "ready" ? readiness.status === "loading" ? "Checking…" : "Unavailable" : checks.identity === "verified" ? "Verified provider" : checks.identity === "local" ? "Local / preview identity" : checks.identity ?? "Unknown",
      state: readiness.status !== "ready" ? "neutral" : checks.identity === "verified" ? "success" : checks.identity === "local" ? "warning" : "neutral",
      detail: readiness.status !== "ready" ? "Refresh to load the API-reported identity state." : checks.identity === "verified" ? "The API reports a verified identity adapter." : "Use a verified identity provider for production access.",
    },
    {
      name: "Private evidence storage",
      value: readiness.status !== "ready" ? readiness.status === "loading" ? "Checking…" : "Unavailable" : checks.objectStore === "configured" ? "Configured" : "Not configured",
      state: readiness.status !== "ready" ? "neutral" : checks.objectStore === "configured" ? "success" : "warning",
      detail: readiness.status !== "ready" ? "Refresh to load the API-reported storage state." : checks.objectStore === "configured" ? "An S3-compatible object store is configured." : "Evidence uploads require a configured private object store.",
    },
    {
      name: "Evidence scanning",
      value: readiness.status !== "ready" ? readiness.status === "loading" ? "Checking…" : "Unavailable" : checks.evidenceScanner === "configured" ? "Scanner configured" : checks.evidenceScanner === "development" ? "Development scanner" : "Not configured",
      state: readiness.status !== "ready" ? "neutral" : checks.evidenceScanner === "configured" ? "success" : checks.evidenceScanner === "development" ? "warning" : "neutral",
      detail: readiness.status !== "ready" ? "Refresh to load the API-reported scanner state." : checks.evidenceScanner === "configured" ? "The API reports a configured scanner." : "Uploaded evidence should not be accepted in production without a configured scanner.",
    },
    { name: "Tempo settlement", ...selectedRail(checks.payment, "tempo", "Tempo") },
    { name: "Solana receipts", ...selectedRail(checks.attestation, "solana", "Solana") },
  ];

  return (
    <section className="integration-readiness" aria-labelledby="integration-readiness-title">
      <header className="integration-readiness-heading">
        <div>
          <Text type="supporting" className="page-context">Workspace connections</Text>
          <Heading id="integration-readiness-title" level={2}>Integration readiness</Heading>
          <Text as="p" type="supporting">Configuration reported by the API for this deployment.</Text>
        </div>
        <Button label="Check again" variant="secondary" onClick={onRefresh} isLoading={readiness.status === "loading"} />
      </header>

      {readiness.status === "unavailable" ? (
        <Banner status="error" title="Could not reach the API" description={readiness.message} />
      ) : readiness.status === "ready" && !readiness.ok ? (
        <Banner status="warning" title="Some required services are not ready" description={readiness.message} />
      ) : null}

      <div className="integration-readiness-grid">
        {integrations.map((integration) => (
          <article className="integration-card" key={integration.name}>
            <div className="integration-card-topline">
              <h3>{integration.name}</h3>
              <span className={`integration-state integration-state-${integration.state}`}>{integration.value}</span>
            </div>
            <p>{integration.detail}</p>
          </article>
        ))}
      </div>

      <p className="integration-readiness-note">
        “Configured” means the server selected an adapter. It does not prove a live network connection, a confirmed transaction, or a completed end-to-end integration. Preview adapters never send chain transactions.
        {readiness.checkedAt ? <span> Checked {new Date(readiness.checkedAt).toLocaleTimeString()}.</span> : null}
      </p>
    </section>
  );
}

function RoleRulesWindow() {
  const rules = [
    { role: "Buyer (Procurement)", can: "Draft POs, Define terms, Grant supplier view access", cannot: "Receive physical shipments, Record QA decisions, Settle escrow" },
    { role: "Supplier", can: "Review terms, Acknowledge commercial contract", cannot: "Change terms, Self-inspect receiving, Release escrow funds" },
    { role: "Receiving Operator", can: "Inspect physical package, Record quantity & quarantine site", cannot: "Grant PO access, Authorize payment, Modify QA status" },
    { role: "QA Reviewer", can: "Review batch certificates, Record Accept / Hold / Reject", cannot: "Release payment, Alter received counts, Issue POs" },
    { role: "Finance Operator", can: "Fund escrow contract, Settle after QA acceptance", cannot: "Bypass QA hold, Override supplier terms" },
    { role: "Auditor", can: "Read tenant audit events and available receipt references", cannot: "Mutate operational state" },
  ];

  return (
    <Card padding={4} className="workbench-window-card">
      <div className="queue-heading" style={{ marginBottom: 16 }}>
        <div>
          <Heading level={2}>Role Partition & Segregation of Duties Matrix</Heading>
          <Text type="supporting">The API checks each workflow action against the active role. Operators must review role assignments and deployment settings before handling operational records.</Text>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rules.map((rule) => (
          <div key={rule.role} className="role-rule-row">
            <div className="role-rule-name">{rule.role}</div>
            <div>
              <span className="role-rule-label role-rule-label-allowed">Can do</span>
              <span className="role-rule-copy">{rule.can}</span>
            </div>
            <div>
              <span className="role-rule-label role-rule-label-denied">Not permitted by role</span>
              <span className="role-rule-copy">{rule.cannot}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WorkflowGuide() {
  return (
    <section className="workflow-guide" aria-labelledby="workflow-guide-heading">
      <div className="workflow-guide-heading">
        <div>
          <Heading level={2}>Every handoff leaves a record</Heading>
          <Text as="p" type="supporting">Nischit keeps purchasing, receiving, quality, and settlement in one accountable chain.</Text>
        </div>
        <Text type="supporting" className="workflow-guide-note">The next team only sees work after the previous handoff is recorded.</Text>
      </div>
      <ol className="workflow-guide-list">
        <li><div><strong>Create order</strong><span>Agree the product, quantity, supplier, and terms.</span></div></li>
        <li><div><strong>Receive lot</strong><span>Record what arrived, where it went, and its condition.</span></div></li>
        <li><div><strong>Review evidence</strong><span>Let QA accept, hold, or reject with a reason.</span></div></li>
        <li><div><strong>Release payment</strong><span>Settle only after the recorded decision authorizes it.</span></div></li>
      </ol>
    </section>
  );
}

function InspectorWindow({
  page,
  selected,
  session,
  selectedActions,
  sites,
  receiveQuantity,
  receiveSite,
  qaStatus,
  qaReason,
  setReceiveQuantity,
  setReceiveSite,
  setQaStatus,
  setQaReason,
  onCommand,
  isActionPending,
  onClose,
}: {
  page: PageId;
  selected: WorkRow;
  session: RoleSession;
  selectedActions: string[];
  sites: Record<string, unknown>[];
  receiveQuantity: number | null;
  receiveSite: string;
  qaStatus: string;
  qaReason: string;
  setReceiveQuantity: (value: number | null) => void;
  setReceiveSite: (value: string) => void;
  setQaStatus: (value: string) => void;
  setQaReason: (value: string) => void;
  onCommand: (path: string, body?: Record<string, unknown>) => Promise<void>;
  isActionPending: boolean;
  onClose: () => void;
}) {
  const [subTab, setSubTab] = useState<"action" | "lifecycle" | "ledger">("action");
  const [evidenceLinks, setEvidenceLinks] = useState<Record<string, string>>({});
  const [preparingEvidence, setPreparingEvidence] = useState<string>();
  const [evidenceError, setEvidenceError] = useState<string>();
  const raw = selected.raw;
  const poId = asString(raw.purchaseOrderId);
  const shipmentId = asString(raw.shipmentId);
  const receiptId = asString(raw.receiptId);
  const siteOptions = sites.map((site) => ({ value: asString(site.id), label: asString(site.name, asString(site.id)) }));
  const evidenceDocuments = Array.isArray(raw.evidenceDocuments)
    ? raw.evidenceDocuments.map(asRecord)
    : [];

  useEffect(() => {
    setEvidenceLinks({});
    setEvidenceError(undefined);
  }, [receiptId]);

  async function prepareEvidence(objectId: string) {
    setPreparingEvidence(objectId);
    setEvidenceError(undefined);
    try {
      const result = await request<{ url: string }>(
        `/purchase-orders/${encodeURIComponent(poId)}/evidence/${encodeURIComponent(objectId)}`,
        session,
      );
      setEvidenceLinks((current) => ({ ...current, [objectId]: result.url }));
    } catch (error) {
      setEvidenceError(error instanceof Error ? error.message : "The secure evidence link could not be prepared");
    } finally {
      setPreparingEvidence(undefined);
    }
  }

  return (
    <div className="inspector-window">
      <div className="inspector-window-header">
        <div className="inspector-title-group">
          <span className="inspector-eyebrow">Record Inspector</span>
          <h3 className="inspector-title">{selected.subject}</h3>
          <span className="inspector-meta-label">{selected.reference}</span>
        </div>
        <button
          type="button"
          className="inspector-close-btn"
          aria-label="Close inspector window"
          onClick={onClose}
          title="Close inspector"
        >
          ✕
        </button>
      </div>

      <div className="inspector-subtabs">
        <button
          type="button"
          className={`inspector-subtab-btn ${subTab === "action" ? "active" : ""}`}
          onClick={() => setSubTab("action")}
        >
          Action & Decision
        </button>
        <button
          type="button"
          className={`inspector-subtab-btn ${subTab === "lifecycle" ? "active" : ""}`}
          onClick={() => setSubTab("lifecycle")}
        >
          Lifecycle Stepper
        </button>
        <button
          type="button"
          className={`inspector-subtab-btn ${subTab === "ledger" ? "active" : ""}`}
          onClick={() => setSubTab("ledger")}
        >
          Receipt data
        </button>
      </div>

      <div className="inspector-body">
        {subTab === "action" ? (
          <>
            <div className="inspector-meta-row">
              <span className="inspector-meta-label">Current State:</span>
              <StateMark state={selected.state} />
            </div>

            <div className="inspector-meta-row">
              <span className="inspector-meta-label">Details:</span>
              <span className="inspector-meta-val">{selected.detail}</span>
            </div>

            <div className="inspector-meta-row">
              <span className="inspector-meta-label">Current user:</span>
              <span className="inspector-meta-val">{session.name} ({session.role})</span>
            </div>

            <div className="record-actions">
              {page === "purchase-orders" && session.role === "buyer" && raw.supplierTenantId ? (
                <Button
                  label="Grant supplier access"
                  variant="primary"
                  isDisabled={isActionPending}
                  isLoading={isActionPending}
                  onClick={() => void onCommand(`/purchase-orders/${poId}/grants`, { receivingTenantId: asString(raw.supplierTenantId) })}
                />
              ) : null}
              {page === "purchase-orders" && session.role === "supplier" && selectedActions.includes("acknowledge") ? (
                <Button
                  label="Acknowledge terms"
                  variant="primary"
                  isDisabled={isActionPending}
                  isLoading={isActionPending}
                  onClick={() => void onCommand(`/purchase-orders/${poId}/acknowledge`, {})}
                />
              ) : null}
              {page === "receiving" && session.role === "receiving" ? (
                <div className="action-form">
                  <NumberInput label="Received quantity" value={receiveQuantity} onChange={setReceiveQuantity} min={1} isIntegerOnly />
                  <Selector label="Destination site" options={siteOptions} value={receiveSite} onChange={setReceiveSite} placeholder="Choose site" />
                  <Button
                    label="Record receipt"
                    variant="primary"
                    isDisabled={isActionPending || !receiveQuantity || !receiveSite}
                    isLoading={isActionPending}
                    onClick={() => void onCommand(`/shipments/${shipmentId}/receive`, { receivedQuantity: receiveQuantity, siteId: receiveSite })}
                  />
                </div>
              ) : null}
              {page === "qa" && session.role === "qa" ? (
                <div className="action-form">
                  {evidenceDocuments.length ? (
                    <div className="action-form">
                      <strong>Supplier evidence</strong>
                      {evidenceDocuments.map((document, index) => {
                        const name = asString(document.name, `Evidence ${index + 1}`);
                        const objectId = asString(document.objectId, "");
                        const url = objectId ? evidenceLinks[objectId] : undefined;
                        return (
                          <div className="inspector-meta-row" key={`${objectId || name}-${index}`}>
                            <span className="inspector-meta-val">{name}</span>
                            {url ? (
                              <a href={url} target="_blank" rel="noopener noreferrer">Open file</a>
                            ) : objectId && session.kind !== "preview" ? (
                              <Button
                                label="Prepare secure link"
                                variant="secondary"
                                size="sm"
                                isDisabled={Boolean(preparingEvidence)}
                                isLoading={preparingEvidence === objectId}
                                onClick={() => void prepareEvidence(objectId)}
                              />
                            ) : (
                              <Text type="supporting">No private file is attached.</Text>
                            )}
                          </div>
                        );
                      })}
                      {evidenceError ? <Text type="supporting">{evidenceError}</Text> : null}
                    </div>
                  ) : null}
                  <Selector
                    label="Decision"
                    options={[
                      { value: "accepted", label: "Accept" },
                      { value: "accepted_with_adjustment", label: "Accept with adjustment" },
                      { value: "held", label: "Hold" },
                      { value: "rejected", label: "Reject" },
                    ]}
                    value={qaStatus}
                    onChange={setQaStatus}
                  />
                  <label className="native-field">
                    <span>Decision reason</span>
                    <textarea
                      value={qaReason}
                      onChange={(event) => setQaReason(event.target.value)}
                      rows={3}
                      placeholder="Explain the physical evidence, COA check, and acceptance decision"
                    />
                  </label>
                  <Button
                    label="Record QA decision"
                    variant="primary"
                    isDisabled={isActionPending || !qaReason.trim()}
                    isLoading={isActionPending}
                    onClick={() => void onCommand(`/receipts/${receiptId}/qa`, { status: qaStatus, reason: qaReason, siteId: asString(raw.siteId) })}
                  />
                </div>
              ) : null}
              {page === "settlement" && session.role === "finance" ? (
                <div className="action-form">
                  {asString(raw.settlementStatus) === "draft" ? (
                    <Button
                      label="Fund purchase order"
                      variant="primary"
                      isDisabled={isActionPending}
                      isLoading={isActionPending}
                      onClick={() => void onCommand(`/purchase-orders/${poId}/fund`, {})}
                    />
                  ) : null}
                  {["unknown", "submitted"].includes(asString(raw.settlementStatus)) ? (
                    <Button
                      label="Reconcile payment"
                      variant="primary"
                      isDisabled={isActionPending}
                      isLoading={isActionPending}
                      onClick={() => void onCommand(`/purchase-orders/${poId}/reconcile-payment`, {})}
                    />
                  ) : null}
                  {["awaiting_qa", "authorized"].includes(asString(raw.settlementStatus)) ? (
                    <Button
                      label="Settle purchase order"
                      variant="primary"
                      isDisabled={isActionPending}
                      isLoading={isActionPending}
                      onClick={() => void onCommand(`/purchase-orders/${poId}/settle`, {})}
                    />
                  ) : null}
                </div>
              ) : null}
              {page === "public" ? (
                <Text type="supporting">Public receipt data is read-only. Private physical evidence and internal audit events are excluded.</Text>
              ) : null}
              {page === "inventory" || page === "audit" || page === "settings" ? (
                <Text type="supporting">No action is available for this record in the current view.</Text>
              ) : null}
            </div>
          </>
        ) : null}

        {subTab === "lifecycle" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Stepper
              activeStep={Math.max(0, ["draft", "acknowledged", "funded", "in_transit", "received", "closed"].indexOf(asString(raw.status, asString(raw.purchaseOrderStatus))))}
              label="Lifecycle progression"
              density="compact"
            >
              <Step step={0} label="Terms" />
              <Step step={1} label="Acknowledged" />
              <Step step={2} label="Funded" />
              <Step step={3} label="In transit" />
              <Step step={4} label="Received" />
              <Step step={5} label="Closed" />
            </Stepper>
            <div className="inspector-meta-row">
              <span className="inspector-meta-label">Protocol Status:</span>
              <span className="inspector-meta-val" style={{ fontFamily: "var(--font-code-family)" }}>{asString(raw.status, asString(raw.conditionStatus, selected.state))}</span>
            </div>
            <div className="inspector-meta-row">
              <span className="inspector-meta-label">Next Accountable:</span>
              <span className="inspector-meta-val">{asString(raw.nextRole, "Not provided")}</span>
            </div>
          </div>
        ) : null}

        {subTab === "ledger" ? (
          <div className="inspector-hashes-box">
            <p className="receipt-data-note">
              {session.kind === "preview"
                ? "Preview records do not contain verified chain receipts."
                : "Values below come from the API response for this record. Missing values have not been reported."}
            </p>
            <ReceiptReference label="Terms commitment" value={raw.termsHash} />
            <ReceiptReference label="Condition evidence hash" value={raw.conditionReportHash ?? raw.readingsHash} />
            <ReceiptReference label="QA decision hash" value={raw.qaDecisionHash} />
            <ReceiptReference label="Tempo transaction reference" value={raw.paymentReference} />
            <ReceiptReference label="Solana receipt signature" value={raw.solanaReceiptSignature} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReceiptReference({ label, value }: { label: string; value: unknown }) {
  const reference = typeof value === "string" && value.trim() ? value : "Not reported";
  return (
    <div className="inspector-hash-item">
      <span className="hash-label">{label}</span>
      <span className="hash-value">{reference}</span>
    </div>
  );
}

function SessionLoadingState() {
  return (
    <main className="access-gate">
      <section className="access-gate-panel" aria-labelledby="session-loading-heading">
        <NischitMark className="access-gate-mark" />
        <Text type="supporting" className="page-context">Nischit workspace</Text>
        <Heading id="session-loading-heading" level={1}>Checking your organization session</Heading>
        <Text as="p" type="body" color="secondary">Nischit is verifying your identity before opening tenant-scoped work.</Text>
      </section>
    </main>
  );
}

function ProductionAccessGate({ status }: { status: "signed-out" | "unavailable" }) {
  const signedOut = status === "signed-out";
  return (
    <main className="access-gate">
      <section className="access-gate-panel" aria-labelledby="access-gate-heading">
        <NischitMark className="access-gate-mark" />
        <Text type="supporting" className="page-context">Nischit workspace</Text>
        <Heading id="access-gate-heading" level={1}>{signedOut ? "Sign-in is required to open this workspace" : "Workspace service is unavailable"}</Heading>
        <Text as="p" type="body" color="secondary">{signedOut ? "Your organization session is missing or has expired. Return to sign in and authenticate with the configured identity provider." : "Nischit could not verify the organization session or reach the API. Try again after the deployment health check recovers."}</Text>
        <Banner status={signedOut ? "warning" : "error"} title={signedOut ? "Authentication required" : "Verification failed"} description={signedOut ? "Continue to the identity provider, then reopen the workspace." : "The workspace remains closed rather than loading unverified tenant data."} />
        {signedOut ? <a className="marketing-button marketing-button-primary access-gate-link" href="/auth/login?returnTo=%2Fdashboard">Continue to sign in</a> : null}
      </section>
    </main>
  );
}
