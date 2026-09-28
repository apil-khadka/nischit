import { MarketingShell } from "./marketing-shell";
import { SectionIntro, CtaRow } from "./marketing-primitives";
import { FlagshipCta } from "./flagship-cta";

export function PricingPage() {
  return (
    <MarketingShell page="pricing">
      <section className="marketing-page-hero" aria-labelledby="pricing-heading">
        <div className="hero-badge-wrap">
          <span className="hero-beacon" aria-hidden="true" />
          <span className="hero-eyebrow-text">AVAILABILITY &amp; DEPLOYMENT</span>
        </div>
        <h1 id="pricing-heading" className="page-hero-title">
          Define operational scope. <em>Validate the controls.</em>
        </h1>
        <p className="page-hero-desc">
          Nischit is open source under Apache-2.0. There is no hosted production service, published price, or service-level agreement. Operators must scope deployment, support, and integrations for their environment.
        </p>
        <CtaRow primary="Open the workspace" secondary="Explore the workflow" secondaryHref="/workflow" />
      </section>

      {/* Pricing / Rollout Models */}
      <section className="marketing-section pricing-options" aria-labelledby="pricing-options-heading">
        <SectionIntro
          id="pricing-options-heading"
          eyebrow="Deployment Readiness"
          title={<>Choose the operational boundary <em>before you choose the plan.</em></>}
        >
          No delivery timeline, certification, or service level is being offered here.
        </SectionIntro>

        <div className="pricing-cards-grid">
          {/* Card 1: Controlled Evaluation */}
          <article className="pricing-card">
            <div className="pricing-card-header">
              <span className="pricing-stage-tag">CONTROLLED EVALUATION</span>
              <h3>Validate one workflow</h3>
              <p>Start with one supply workflow using synthetic data or data approved for the evaluation.</p>
            </div>
            <div className="pricing-feature-checklist">
              <div className="checklist-item">
                <span className="check-icon">✓</span>
                <span>Single organization with up to 3 operational sites</span>
              </div>
              <div className="checklist-item">
                <span className="check-icon">✓</span>
                <span>Purchase, receiving, evidence, and QA workflow</span>
              </div>
              <div className="checklist-item">
                <span className="check-icon">✓</span>
                <span>Supplier tenant invitation and grant management</span>
              </div>
              <div className="checklist-item">
                <span className="check-icon">✓</span>
                <span>Chain adapters require separate configuration and test evidence</span>
              </div>
              <div className="checklist-item">
                <span className="check-icon">✓</span>
                <span>No regulatory compliance certification is claimed</span>
              </div>
            </div>
            <div className="pricing-action-wrap">
              <a className="marketing-button marketing-button-primary" href="/product">
                <span>Review current scope</span>
                <span className="btn-arrow" aria-hidden="true">→</span>
              </a>
              <span className="pricing-subtext">Availability and delivery terms are not established.</span>
            </div>
          </article>

          {/* Card 2: Operations Rollout */}
          <article className="pricing-card featured">
            <div className="pricing-card-header">
              <span className="featured-flag">Future scope</span>
              <span className="pricing-stage-tag">DEPLOYMENT QUESTIONS</span>
              <h3>What production would require</h3>
              <p>Operational, security, regulatory, and integration validation remains future work.</p>
            </div>
            <div className="pricing-feature-checklist">
              <div className="checklist-item">
                <span className="check-icon">✓</span>
                <span>Tenant and site scale validation</span>
              </div>
              <div className="checklist-item">
                <span className="check-icon">✓</span>
                <span>Hardware and condition-data integrations</span>
              </div>
              <div className="checklist-item">
                <span className="check-icon">✓</span>
                <span>ERP and LIMS integration design</span>
              </div>
              <div className="checklist-item">
                <span className="check-icon">✓</span>
                <span>Identity-provider and key-management operations</span>
              </div>
              <div className="checklist-item">
                <span className="check-icon">✓</span>
                <span>Chain configuration, transaction monitoring, and recovery</span>
              </div>
            </div>
            <div className="pricing-action-wrap">
              <a className="marketing-button marketing-button-primary" href="/security">
                <span>Review deployment requirements</span>
                <span className="btn-arrow" aria-hidden="true">→</span>
              </a>
              <span className="pricing-subtext">No production service or SLA is currently offered.</span>
            </div>
          </article>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="marketing-section pricing-faq-section" aria-labelledby="faq-heading">
        <SectionIntro
          id="faq-heading"
          eyebrow="Frequently Asked Questions"
          title={<>Questions about <em>scoping and deployment.</em></>}
        />

        <div className="faq-grid">
          <div className="faq-item">
            <h4>Does Nischit require our suppliers to adopt complex crypto wallets?</h4>
            <p>
              Supplier access uses explicit grants and tenant membership. Operators must validate their identity-provider configuration and provisioning process.
            </p>
          </div>
          <div className="faq-item">
            <h4>How does Nischit prevent private clinical data from leaking to the public chain?</h4>
            <p>
              Do not use patient data. The intended design keeps evidence in private storage and shares only selected metadata; any chain payload needs a deployment-specific privacy review.
            </p>
          </div>
          <div className="faq-item">
            <h4>Can we integrate Nischit with our existing ERP or LIMS?</h4>
            <p>
              Integration options need to be evaluated. No SAP, LabWare, or SampleManager connector is claimed.
            </p>
          </div>
          <div className="faq-item">
            <h4>What happens if our internet connection drops on the receiving dock?</h4>
            <p>
              Offline receiving and synchronization have not been validated as product capabilities.
            </p>
          </div>
        </div>
      </section>

      <FlagshipCta
        eyebrow="Implementation status"
        title={<>Review the current implementation.</>}
        description="See the documented capability boundary and setup requirements before considering an operational evaluation."
        primaryText="Open the workspace"
        secondaryText="Explore Product Features"
        secondaryHref="/product"
        showDeco={false}
      />
    </MarketingShell>
  );
}
