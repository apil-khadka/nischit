import { MarketingShell } from "./marketing-shell";
import { SectionIntro, CtaRow } from "./marketing-primitives";
import { FlagshipCta } from "./flagship-cta";

export function SecurityPage() {
  return (
    <MarketingShell page="security">
      <section className="marketing-page-hero" aria-labelledby="security-heading">
        <div className="hero-badge-wrap">
          <span className="hero-beacon" aria-hidden="true" />
          <span className="hero-eyebrow-text">SECURITY &amp; VERIFICATION</span>
        </div>
        <h1 id="security-heading" className="page-hero-title">
          Evidence has a boundary. <br />
          Decisions stay <em>human accountable.</em>
        </h1>
        <p className="page-hero-desc">
          The current implementation includes tenant-scoped persistence, private evidence references, audit events, and optional chain adapters.
          This website does not represent a live transaction or an independent security assessment.
        </p>
        <CtaRow primary="Open Workspace" secondary="Review Capabilities" secondaryHref="/product" />
      </section>

      {/* 4 Core Security Pillars */}
      <section className="marketing-section security-principles" aria-labelledby="security-principles-heading">
        <SectionIntro
          id="security-principles-heading"
          eyebrow="The Security Model"
          title={<>Trust is a system property, <em>never a decorative badge.</em></>}
        >
          These are design and implementation boundaries, not a compliance certification or independent security audit.
        </SectionIntro>

        <div className="security-pillars-grid">
          <article className="security-pillar-card">
            <div className="pillar-header">
              <span className="pillar-num">01</span>
              <h3>Tenant-Scoped Data Vault</h3>
            </div>
            <p>
              The API scopes organizations, sites, memberships, supplier grants, and audit events to tenant context.
              Production deployment requires the documented PostgreSQL role and row-level security setup.
            </p>
            <div className="pillar-tag">Tenant-Scoped Access Controls</div>
          </article>

          <article className="security-pillar-card">
            <div className="pillar-header">
              <span className="pillar-num">02</span>
              <h3>Private Evidence Storage</h3>
            </div>
            <p>
              Evidence uploads use opaque object references and SHA-256 checksums. Production use depends on private
              storage and malware scanning configured by the operator. Do not use patient data.
            </p>
            <div className="pillar-tag">SHA-256 Evidence Hashes</div>
          </article>

          <article className="security-pillar-card">
            <div className="pillar-header">
              <span className="pillar-num">03</span>
              <h3>Settlement and Receipt Adapters</h3>
            </div>
            <p>
              Tempo and Solana adapters are available for explicit configuration. This page does not claim that a
              transaction has been sent, confirmed, or independently verified on either network.
            </p>
            <div className="pillar-tag">Optional Network Integrations</div>
          </article>

          <article className="security-pillar-card">
            <div className="pillar-header">
              <span className="pillar-num">04</span>
              <h3>Human QA Authority</h3>
            </div>
            <p>
              An authorized person records the QA decision and rationale. Nischit does not replace inspection or
              certify that evidence is sufficient for a regulated use.
            </p>
            <div className="pillar-tag">Human-in-the-Loop Integrity</div>
          </article>
        </div>
      </section>

      {/* Public vs Private Matrix */}
      <section className="marketing-section security-plain-language" aria-labelledby="security-plain-language-heading">
        <SectionIntro
          id="security-plain-language-heading"
          eyebrow="The Privacy Boundary"
          title={<>What the public can verify, <em>and what stays private.</em></>}
        >
          The design keeps operational evidence private and shares only explicitly selected commitments. A live public
          receipt verifier is not enabled by default.
        </SectionIntro>

        <div className="privacy-matrix-grid">
          <div className="matrix-card matrix-public">
            <div className="matrix-head">
              <span className="matrix-indicator public-dot" />
          <h4>Potential shared fields</h4>
            </div>
            <ul className="matrix-list">
              <li>Order or commitment reference, if configured for sharing</li>
              <li>Selected workflow status and timestamps</li>
              <li>Transaction references only after real chain execution</li>
              <li>Evidence checksums, subject to a privacy review</li>
            </ul>
          </div>

          <div className="matrix-card matrix-private">
            <div className="matrix-head">
              <span className="matrix-indicator private-dot" />
          <h4>Private operational data</h4>
            </div>
            <ul className="matrix-list">
              <li>Patient identifiers and clinical diagnostic records</li>
              <li>High-resolution raw spectrometry and chromatography files</li>
              <li>Internal negotiated supplier pricing formulas and margins</li>
              <li>Tenant physical dock locations, badge IDs, and employee emails</li>
              <li>Internal organizational notes and private inventory reorders</li>
            </ul>
          </div>
        </div>
      </section>

      <FlagshipCta
        eyebrow="Security and operations"
        title={<>Review the implemented boundaries.</>}
        description="Read the architecture and deployment notes, including the setup required before any hosted deployment."
        primaryText="Open Workspace"
        secondaryText="Read the Workflow"
        secondaryHref="/workflow"
        showDeco={false}
      />
    </MarketingShell>
  );
}
