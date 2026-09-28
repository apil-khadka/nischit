import { MarketingShell } from "./marketing-shell";
import { CtaRow } from "./marketing-primitives";
import { HeroAnnouncement } from "./hero-announcement";
import { StandardsBanner } from "./standards-banner";
import { HeroSpecimenArtifact } from "./interactive-specimen";
import { HomeBentoGrid } from "./home-bento-grid";
import { InteractiveVerificationSandbox } from "./interactive-verification";
import { InteractiveWorkflowExplorer } from "./interactive-workflow";
import { ArchitectureBoundaries } from "./architecture-boundaries";
import { ComparisonTable } from "./comparison-table";
import { FlagshipCta } from "./flagship-cta";

export function HomePage() {
  return (
    <MarketingShell page="home">
      {/* Top Notification Banner */}
      <HeroAnnouncement />

      {/* Hero Section */}
      <section className="marketing-hero marketing-home-hero" aria-labelledby="home-hero-heading">
        <div className="marketing-hero-copy">
          <div className="hero-badge-wrap">
            <span className="hero-beacon" aria-hidden="true" />
            <span className="hero-eyebrow-text">DIAGNOSTIC LAB SUPPLY WORKFLOWS</span>
          </div>

          <h1 id="home-hero-heading" className="hero-main-title">
            Know what arrived. <br />
            Move with <em>shared evidence.</em>
          </h1>

          <p className="marketing-hero-lede">
            One shared record connects reagent purchase terms, delivery evidence, human QA decisions, and settlement status.
          </p>

          <CtaRow primary="Open the workspace" secondary="Explore the workflow" secondaryHref="/workflow" />

          <div className="hero-metrics-strip" aria-label="Product boundaries">
            <div className="metric-item">
              <strong>Human</strong>
              <span>QA authority</span>
            </div>
            <div className="metric-divider" aria-hidden="true" />
            <div className="metric-item">
              <strong>Private</strong>
              <span>evidence files</span>
            </div>
            <div className="metric-divider" aria-hidden="true" />
            <div className="metric-item">
              <strong>Explicit</strong>
              <span>settlement state</span>
            </div>
          </div>
        </div>

        {/* Right Hero Visual: Interactive Verifiable Specimen Artifact */}
        <div className="marketing-hero-interactive">
          <HeroSpecimenArtifact />
        </div>
      </section>

      {/* Trust & Standards Strip */}
      <StandardsBanner />

      {/* Bento Grid: Core Value System */}
      <HomeBentoGrid />

      {/* Interactive Verification Sandbox */}
      <InteractiveVerificationSandbox />

      {/* Interactive Workflow & Role Separation */}
      <InteractiveWorkflowExplorer />

      {/* System Architecture Boundary */}
      <ArchitectureBoundaries />

      {/* Comparison: Legacy vs Nischit */}
      <ComparisonTable />

      {/* Flagship Call To Action */}
      <FlagshipCta />
    </MarketingShell>
  );
}
