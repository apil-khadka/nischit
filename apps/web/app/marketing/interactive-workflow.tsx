"use client";

import { useState } from "react";

type RoleId = "procurement" | "receiving" | "qa" | "finance" | "auditor";

interface RoleDetail {
  id: RoleId;
  title: string;
  badge: string;
  canDo: string[];
  cannotDo: string[];
  description: string;
  sampleAction: string;
}

const roles: RoleDetail[] = [
  {
    id: "procurement",
    title: "Procurement Lead",
    badge: "Commercial Authority",
    canDo: [
      "Define purchase order terms and product specifications",
      "Explicitly grant supplier tenant access to specific order details",
      "Monitor commercial commitments and settlement states",
    ],
    cannotDo: [
      "Cannot sign off on QA inspection or override quality holds",
      "Cannot falsify physical receiving counts",
    ],
    description: "A proposed role for recording commercial terms.",
    sampleAction: "Synthetic example: purchase terms recorded.",
  },
  {
    id: "receiving",
    title: "Receiving Operator",
    badge: "Physical Custody",
    canDo: [
      "Record physical arrival, vial count, and destination site",
      "Log cold-chain logger status and physical tamper-seal condition",
      "Submit receipt details for QA review",
    ],
    cannotDo: [
      "Cannot approve or reject materials for laboratory use",
      "Cannot modify commercial pricing or release payment",
    ],
    description: "A proposed role for recording receipt details before QA review.",
    sampleAction: "Synthetic example: receipt details recorded.",
  },
  {
    id: "qa",
    title: "Quality Assurance Specialist",
    badge: "Clinical Authority",
    canDo: [
      "Review attached evidence and record an outcome",
      "Record binding decision: Accept, Accept with Adjustment, Hold, or Reject",
      "Require signed evidence attachments for every deviation",
    ],
    cannotDo: [
      "Cannot disburse escrow funds manually",
      "Cannot edit historical receiving counts or original purchase orders",
    ],
    description: "An authorized reviewer records a QA decision. The application records evidence but does not validate laboratory suitability.",
    sampleAction: "Synthetic example: QA decision recorded with a reason.",
  },
  {
    id: "finance",
    title: "Finance & Treasury",
    badge: "Settlement Control",
    canDo: [
      "Review recorded settlement terms and state",
      "Observe deterministic QA authorization states",
      "Review settlement actions separately from QA decisions",
    ],
    cannotDo: [
      "Cannot bypass QA failure to release funds early",
      "Cannot access confidential patient/specimen clinical data",
    ],
    description: "A proposed role for reviewing settlement state. No payment is executed by this interface.",
    sampleAction: "Synthetic example: settlement state reviewed.",
  },
  {
    id: "auditor",
    title: "Regulatory Auditor",
    badge: "Compliance Oversight",
    canDo: [
      "Review recorded workflow history",
      "Export capability is not represented in this role view",
      "No live public chain verification is shown",
    ],
    cannotDo: [
      "Cannot mutate, backdate, or delete any recorded state",
    ],
    description: "A read-only review role. The application is not a certified regulatory audit system.",
    sampleAction: "Synthetic example: workflow history reviewed.",
  },
];

export function InteractiveWorkflowExplorer() {
  const [selectedRole, setSelectedRole] = useState<RoleId>("qa");
  const defaultRole = roles[0] as RoleDetail;
  const activeRole: RoleDetail = roles.find((r) => r.id === selectedRole) ?? defaultRole;

  return (
    <section className="interactive-workflow-section" aria-labelledby="workflow-explorer-heading">
      <div className="workflow-explorer-intro">
        <span className="marketing-eyebrow">ROLE SEPARATION</span>
        <h2 id="workflow-explorer-heading">
          The record is shared. <em>Authority is never confused.</em>
        </h2>
        <p>
          These role examples are illustrative. Check the implementation status before relying on any workflow boundary operationally.
        </p>
      </div>

      <div className="role-tabs-container">
        <div className="role-selector-bar" role="tablist" aria-label="Select role to view authority">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              role="tab"
              aria-selected={selectedRole === role.id}
              className={`role-tab-btn ${selectedRole === role.id ? "active" : ""}`}
              onClick={() => setSelectedRole(role.id)}
            >
              <span className="role-btn-title">{role.title}</span>
              <span className="role-btn-badge">{role.badge}</span>
            </button>
          ))}
        </div>

        <div className="role-detail-card">
          <div className="role-card-header">
            <div>
              <span className="role-tag">{activeRole.badge}</span>
              <h3 className="role-headline">{activeRole.title}</h3>
              <p className="role-desc">{activeRole.description}</p>
            </div>
            <div className="role-action-snippet">
              <span className="snippet-label">Recent Verifiable Action</span>
              <p className="snippet-text">
                <span className="snippet-icon">✓</span>
                &ldquo;{activeRole.sampleAction}&rdquo;
              </p>
            </div>
          </div>

          <div className="role-authority-columns">
            <div className="auth-box can-do">
              <h4 className="auth-title">
                <span className="icon-check">✓</span> Explicit Role Authority
              </h4>
              <ul className="auth-list">
                {activeRole.canDo.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="auth-box cannot-do">
              <h4 className="auth-title">
                <span className="icon-cross">✕</span> Enforced Server Boundary
              </h4>
              <ul className="auth-list">
                {activeRole.cannotDo.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
