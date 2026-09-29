import type { PageId, WorkRow, WorkspaceRole } from "./shared";

const statusVariant = (state: string): "neutral" | "info" | "success" | "warning" | "error" => {
  if (["accepted", "confirmed", "closed", "received", "funded"].includes(state)) return "success";
  if (["held", "exception", "pending_qa", "awaiting_qa", "in_transit", "draft"].includes(state)) return "warning";
  if (["rejected", "refunded", "unknown"].includes(state)) return "error";
  return "info";
};

function formatStateLabel(state: string): string {
  return state.split("_").map((word) => word.toLowerCase() === "qa" ? "QA" : `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`).join(" ");
}

export function StateMark({ state }: { state: string }) {
  const label = formatStateLabel(state);
  return (
    <span className={`record-status record-status-${statusVariant(state)}`}>
      <span className="record-status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

function nextStep(page: PageId, role: WorkspaceRole, row: WorkRow): string {
  const actions = Array.isArray(row.raw.availableActions) ? row.raw.availableActions.map(String) : [];
  if (role === "buyer" && actions.includes("grant_access")) return "Grant supplier access";
  if (role === "supplier" && actions.includes("acknowledge")) return "Confirm order terms";

  if (page === "overview") {
    return {
      buyer: "Review purchase terms",
      supplier: "Review the order",
      receiving: "Record the delivery",
      qa: "Review shipment evidence",
      finance: "Review settlement state",
      auditor: "Trace the record history",
    }[role];
  }

  return {
    overview: "Review record",
    "purchase-orders": role === "supplier" ? "Confirm order terms" : "Review terms and access",
    receiving: "Confirm quantity and destination",
    qa: "Review evidence and record a decision",
    inventory: "Check lot availability",
    settlement: "Review payment state",
    audit: "Inspect recorded activity",
    integrations: "Review connection status",
    settings: "Review workspace settings",
    public: "Review receipt commitments",
  }[page];
}

export function RecordQueue({
  rows,
  page,
  role,
  selectedId,
  onSelect,
}: {
  rows: WorkRow[];
  page: PageId;
  role: WorkspaceRole;
  selectedId?: string;
  onSelect: (row: WorkRow) => void;
}) {
  return (
    <ul className="record-queue" aria-label="Work records">
      {rows.map((row) => {
        const selected = selectedId === row.id;
        return (
          <li className="record-queue-entry" key={row.id}>
            <button
              type="button"
              className={`record-queue-item ${selected ? "selected" : ""}`}
              aria-label={`Review ${row.subject}, ${formatStateLabel(row.state)}`}
              onClick={() => onSelect(row)}
            >
              <span className="record-queue-copy">
                <span className="record-reference">{row.reference}</span>
                <span className="record-subject">{row.subject}</span>
                <span className="record-detail">{row.detail}</span>
              </span>
              <span className="record-queue-next">
                <StateMark state={row.state} />
                <span className="record-next-step">
                  <span>Next step</span>
                  <strong>{nextStep(page, role, row)}</strong>
                </span>
              </span>
              <span className="record-queue-action" aria-hidden="true">{selected ? "Selected" : "Review"}<span>→</span></span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
