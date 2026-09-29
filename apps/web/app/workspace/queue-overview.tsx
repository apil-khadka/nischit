import type { WorkRow, WorkspaceRole } from "./shared";
import { nextStep, StateMark } from "./record-queue";

export function QueueOverviewPanel({
  rows,
  role,
  onSelect,
}: {
  rows: WorkRow[];
  role: WorkspaceRole;
  onSelect: (row: WorkRow) => void;
}) {
  const statusCounts = rows.reduce<Map<string, number>>((counts, row) => {
    counts.set(row.state, (counts.get(row.state) ?? 0) + 1);
    return counts;
  }, new Map());
  const nextRecord = rows[0];

  return (
    <aside className="queue-overview" aria-label="Queue overview">
      <section className="queue-overview-card queue-overview-summary">
        <h2>Queue summary</h2>
        <div className="queue-overview-total">
          <strong>{rows.length}</strong>
          <span>Pending decision{rows.length === 1 ? "" : "s"}</span>
        </div>
        <ul className="queue-status-counts" aria-label="Decisions by status">
          {[...statusCounts].map(([state, count]) => (
            <li key={state}>
              <StateMark state={state} />
              <span className="queue-status-count">{count}</span>
            </li>
          ))}
        </ul>
      </section>

      {nextRecord ? (
        <section className="queue-overview-card queue-overview-next">
          <div className="queue-overview-kicker">UP NEXT</div>
          <h2>{nextRecord.subject}</h2>
          <span className="queue-overview-reference">{nextRecord.reference}</span>
          <div className="queue-overview-next-step">
            <span>Next action</span>
            <strong>{nextStep("overview", role, nextRecord)}</strong>
          </div>
          <button
            type="button"
            className="queue-overview-review"
            onClick={() => onSelect(nextRecord)}
            aria-label={`Review ${nextRecord.subject}`}
          >
            Review this record <span aria-hidden="true">→</span>
          </button>
        </section>
      ) : null}
    </aside>
  );
}
