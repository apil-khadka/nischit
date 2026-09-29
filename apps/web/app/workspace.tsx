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
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import { isAbortError } from "./api-client";
import { NischitMark } from "./brand";
import { LiveVerificationResults, type LiveVerificationPair } from "./live-verification-results";
import { apiBase, request } from "./workspace/client";
import { IntegrationReadinessPanel } from "./workspace/integration-readiness-panel";
import { WorkspaceSidebar } from "./workspace/sidebar";
import { RecordQueue, StateMark } from "./workspace/record-queue";
import { pageMeta, type IntegrationReadiness, type PageId, type RoleSession, type WorkRow, type WorkspaceRole } from "./workspace/shared";
import { initialSession, roleDefaults } from "./workspace/session-config";
import { RoleRulesPanel, WorkflowGuide } from "./workspace/workflow-panels";
import { asRecord, asString, displayId, getPreviewPayload, mapRows, previewCatalog, type Catalog } from "./workspace/data";

type PageState = {
  status: "idle" | "loading" | "ready" | "error";
  rows: WorkRow[];
  message?: string;
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
    void request<RoleSession>("/session")
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
        <WorkspaceSidebar
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
          <aside className="workspace-preview-note" role="note">
            <span>Preview</span>
            <p>Sample records and simulated actions. Payments and chain receipts are not verified.</p>
          </aside>
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
          <RoleRulesPanel />
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
                      <RecordQueue rows={pageState.rows} page={activePage} role={session.role} selectedId={selected.id} onSelect={setSelected} />
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
                    <RecordQueue rows={pageState.rows} page={activePage} role={session.role} onSelect={setSelected} />
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
