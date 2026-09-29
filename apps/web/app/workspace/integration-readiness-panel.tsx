import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import type { IntegrationReadiness } from "./shared";

export function IntegrationReadinessPanel({ readiness, onRefresh }: { readiness: IntegrationReadiness; onRefresh: () => void }) {
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
