import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";

export function RoleRulesPanel() {
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

export function WorkflowGuide() {
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
