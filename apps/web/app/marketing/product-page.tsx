import { MarketingShell } from "./marketing-shell";
import { SectionIntro, CtaRow } from "./marketing-primitives";
import { ArchitectureBoundaries } from "./architecture-boundaries";
import { FlagshipCta } from "./flagship-cta";

export function ProductPage() {
  return (
    <MarketingShell page="product">
      {/* Product Page Hero */}
      <section className="marketing-page-hero" aria-labelledby="product-heading">
        <div className="hero-badge-wrap">
          <span className="hero-beacon" aria-hidden="true" />
          <span className="hero-eyebrow-text">PLATFORM CAPABILITIES</span>
        </div>
        <h1 id="product-heading" className="page-hero-title">
          The record follows <em>the physical material.</em>
        </h1>
        <p className="page-hero-desc">
          Nischit connects laboratory supply terms, lot evidence, receiving, human QA decisions, inventory events, and settlement records.
          Evaluation records are synthetic. Production use requires deployment-specific security and operational review.
        </p>
        <CtaRow primary="Open Workspace" secondary="Explore Workflow" secondaryHref="/workflow" />
      </section>

      {/* 4 Core Sequential Capabilities */}
      <section className="marketing-section product-sequence" aria-labelledby="product-sequence-heading">
        <SectionIntro
          id="product-sequence-heading"
          eyebrow="One Operational Record"
          title={<>A clear path through <em>complex laboratory operations.</em></>}
        >
          The current implementation links procurement, receiving, evidence review, inventory, and settlement state.
        </SectionIntro>

        <div className="product-deep-grid">
          {/* Module 1: PO & Terms */}
          <article className="product-module-card">
            <div className="module-card-header">
              <span className="module-step-tag">01 / PROCUREMENT</span>
              <h3>What did we commercially agree?</h3>
            </div>
            <p className="module-card-body">
              Record exact product SKU, batch requirements, quantity, supplier identity, and commercial escrow terms.
              Supplier access is an explicit, grant-based handshake — not an open portal.
            </p>
            <div className="module-feature-list">
              <div className="module-feature-item">
                <span className="feature-dot" />
                <span>Explicit supplier tenant access grants</span>
              </div>
              <div className="module-feature-item">
                <span className="feature-dot" />
                <span>Settlement terms recorded; network execution requires separate configuration</span>
              </div>
              <div className="module-feature-item">
                <span className="feature-dot" />
                <span>Commercial terms recorded with the order</span>
              </div>
            </div>
          </article>

          {/* Module 2: Receiving & Cold Chain */}
          <article className="product-module-card" id="cold-chain">
            <div className="module-card-header">
              <span className="module-step-tag">02 / RECEIVING</span>
              <h3>What actually arrived on the dock?</h3>
            </div>
            <p className="module-card-body">
              Record package count, manufacturer lot number, expiry date, destination site, and available condition
              evidence before material moves to quality review.
            </p>
            <div className="module-feature-list">
              <div className="module-feature-item">
                <span className="feature-dot" />
                <span>Recorded package-count checks</span>
              </div>
              <div className="module-feature-item">
                <span className="feature-dot" />
                <span>Condition evidence can be recorded for review</span>
              </div>
              <div className="module-feature-item">
                <span className="feature-dot" />
                <span>Human QA review remains a required decision</span>
              </div>
            </div>
          </article>

          {/* Module 3: QA Review */}
          <article className="product-module-card" id="qa-gating">
            <div className="module-card-header">
              <span className="module-step-tag">03 / QUALITY ASSURANCE</span>
              <h3>What does the evidence support?</h3>
            </div>
            <p className="module-card-body">
              Attach private Certificate of Analysis (COA) documents, spectrometry curves, and record an authorized
              human QA decision: Accept, Accept with Adjustment, Hold, or Reject with reasons.
            </p>
            <div className="module-feature-list">
              <div className="module-feature-item">
                <span className="feature-dot" />
                <span>Enforced decision rationale (no silent approvals)</span>
              </div>
              <div className="module-feature-item">
                <span className="feature-dot" />
                <span>Private document checksums (SHA-256)</span>
              </div>
              <div className="module-feature-item">
                <span className="feature-dot" />
                <span>Accountable human QA decision</span>
              </div>
            </div>
          </article>

          {/* Module 4: Settlement */}
          <article className="product-module-card">
            <div className="module-card-header">
              <span className="module-step-tag">04 / SETTLEMENT &amp; RELEASE</span>
              <h3>What is authorized right now?</h3>
            </div>
            <p className="module-card-body">
              Finance can review the recorded QA and settlement state. Any payment action depends on a separately configured and authorized rail.
            </p>
            <div className="module-feature-list">
              <div className="module-feature-item">
                <span className="feature-dot" />
                <span>Tempo adapter requires deployment configuration and transaction verification</span>
              </div>
              <div className="module-feature-item">
                <span className="feature-dot" />
                <span>Solana receipt adapter requires deployment configuration and publication verification</span>
              </div>
              <div className="module-feature-item">
                <span className="feature-dot" />
                <span>Settlement decisions remain subject to configured workflow rules</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* Architectural Boundaries */}
      <ArchitectureBoundaries />


      {/* Product CTA */}
      <FlagshipCta
        eyebrow="Implementation status"
        title={
          <>
            Start with one workflow <em>that matters.</em>
          </>
        }
        description="Evaluate the purchase-to-QA workflow alongside existing operations, then review the controls required for a production deployment."
        primaryText="Review deployment scope"
        secondaryText="Read the workflow"
        secondaryHref="/workflow"
        showDeco={false}
      />
    </MarketingShell>
  );
}
