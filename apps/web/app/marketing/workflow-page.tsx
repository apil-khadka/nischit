import { MarketingShell } from "./marketing-shell";
import { SectionIntro, CtaRow } from "./marketing-primitives";
import { FlagshipCta } from "./flagship-cta";

const steps = [
  {
    num: "01",
    role: "Procurement",
    title: "Record commercial terms",
    description: "Procurement records product, quantity, supplier, and intended settlement terms.",
    deliverable: "Purchase order and terms recorded",
  },
  {
    num: "02",
    role: "Procurement",
    title: "Grant supplier tenant access",
    description: "The supplier receives only the purchase order that the buyer explicitly shares. Internal pricing formulas and other supplier contracts remain hidden.",
    deliverable: "Scoped supplier access granted",
  },
  {
    num: "03",
    role: "Receiving",
    title: "Record the received lot",
    description: "A receiving operator records lot details, quantity, and any available condition evidence for review.",
    deliverable: "Receiving record created",
  },
  {
    num: "04",
    role: "Quality Assurance",
    title: "Review evidence and record a decision",
    description: "A human reviewer records an accept, hold, adjust, or reject decision with rationale.",
    deliverable: "QA decision and rationale recorded",
  },
  {
    num: "05",
    role: "Finance & Treasury",
    title: "Review settlement state",
    description: "Finance reviews the recorded QA and settlement state and reconciles any separately authorized payment action.",
    deliverable: "Settlement state available for review",
  },
] as const;

export function WorkflowPage() {
  return (
    <MarketingShell page="workflow">
      <section className="marketing-page-hero" aria-labelledby="workflow-heading">
        <div className="hero-badge-wrap">
          <span className="hero-beacon" aria-hidden="true" />
          <span className="hero-eyebrow-text">OPERATING LIFECYCLE</span>
        </div>
        <h1 id="workflow-heading" className="page-hero-title">
          Make the next action <em>clear and accountable.</em>
        </h1>
        <p className="page-hero-desc">
          Nischit records operational handoffs so authorized users can review what happened and what action is allowed next.
        </p>
        <CtaRow primary="Open Workspace" secondary="Security Architecture" secondaryHref="/security" />
      </section>

      {/* 5-Step Pipeline */}
      <section className="marketing-section workflow-sequence" aria-labelledby="workflow-sequence-heading">
        <SectionIntro
          id="workflow-sequence-heading"
          eyebrow="The Operating Model"
          title={<>From purchase agreement to <em>QA decision.</em></>}
        >
          Five accountable handoffs connect purchase terms to QA and settlement review. Evaluation records are synthetic and do not submit payments.
        </SectionIntro>

        <div className="workflow-timeline-wrapper">
          <ol className="workflow-timeline-list">
            {steps.map((step) => (
              <li key={step.title} className="workflow-step-card">
                <div className="step-card-meta">
                  <span className="step-index-badge">{step.num}</span>
                  <span className="step-role-tag">{step.role}</span>
                </div>
                <div className="step-card-main">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <div className="step-deliverable">
                    <span className="deliv-icon" aria-hidden="true">✓</span>
                    <span>{step.deliverable}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Role Authority Table */}
      <section className="marketing-section workflow-roles" aria-labelledby="workflow-roles-heading">
        <SectionIntro
          id="workflow-roles-heading"
          eyebrow="Role Clarity"
          title={<>The record is shared. <em>The authority is strictly partitioned.</em></>}
        >
          The role model separates supplier, receiving, QA, and finance actions. Operators must validate role assignments and deployment settings before operational use.
        </SectionIntro>

        <div className="roles-matrix-table-wrap">
          <table className="roles-matrix-table">
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Accountability</th>
                <th scope="col">Boundary Constraint</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="role-col">
                  <strong>Procurement</strong>
                </td>
                <td>Records terms, requests supplier access, and initiates authorized funding actions.</td>
                <td><span className="boundary-tag"><span aria-hidden="true">✕</span> Cannot approve QA decisions</span></td>
              </tr>
              <tr>
                <td className="role-col">
                  <strong>Supplier</strong>
                </td>
                <td>Acknowledges terms and confirms dispatch details.</td>
                <td><span className="boundary-tag"><span aria-hidden="true">✕</span> Cannot modify pricing unilaterally</span></td>
              </tr>
              <tr>
                <td className="role-col">
                  <strong>Receiving</strong>
                </td>
                <td>Records received quantity, destination site, and available condition evidence.</td>
                <td><span className="boundary-tag"><span aria-hidden="true">✕</span> Cannot release inventory to lab use</span></td>
              </tr>
              <tr>
                <td className="role-col">
                  <strong>Quality Assurance</strong>
                </td>
                <td>Reviews available evidence and records a decision with rationale.</td>
                <td><span className="boundary-tag"><span aria-hidden="true">✕</span> Cannot disburse settlement funds</span></td>
              </tr>
              <tr>
                <td className="role-col">
                  <strong>Finance</strong>
                </td>
                <td>Reviews authorized settlement state and reconciles payment actions.</td>
                <td><span className="boundary-tag"><span aria-hidden="true">✕</span> Cannot bypass QA rejection</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <FlagshipCta
        eyebrow="Workflow records"
        title={<>Review the workflow and its boundaries.</>}
        description="Evaluation records are synthetic. Production operation requires identity, storage, evidence-scanning, and payment configuration appropriate to the deployment."
        primaryText="Open Workspace"
        secondaryText="View Security Architecture"
        secondaryHref="/security"
        showDeco={false}
      />
    </MarketingShell>
  );
}
