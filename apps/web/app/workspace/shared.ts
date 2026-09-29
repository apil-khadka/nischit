export type WorkspaceRole = "buyer" | "supplier" | "receiving" | "qa" | "finance" | "auditor";
export type PageId = "overview" | "purchase-orders" | "receiving" | "qa" | "inventory" | "settlement" | "audit" | "integrations" | "settings" | "public";

export type WorkRow = {
  id: string;
  reference: string;
  subject: string;
  state: string;
  detail: string;
  raw: Record<string, unknown>;
};

export type IntegrationReadiness = {
  status: "loading" | "ready" | "unavailable";
  ok?: boolean;
  checks?: Record<string, string>;
  checkedAt?: string;
  message?: string;
};

export type RoleSession = {
  role: WorkspaceRole;
  tenantId: string;
  userId: string;
  name: string;
  tenantName: string;
  kind?: "preview" | "verified";
  roles?: string[];
  email?: string;
};

export const pageMeta: Record<PageId, { label: string; title: string; description: string }> = {
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
