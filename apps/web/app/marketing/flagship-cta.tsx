import React from "react";

export interface FlagshipCtaProps {
  eyebrow?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  primaryText?: string;
  primaryHref?: string;
  secondaryText?: string;
  secondaryHref?: string;
  stampText?: string;
  showDeco?: boolean;
}

export function FlagshipCta({
  eyebrow = "LAB SUPPLY OPERATIONS",
  title = (
    <>
      Start with one workflow <em>that matters.</em>
    </>
  ),
  description = "Connect purchase terms, receiving evidence, accountable QA decisions, and settlement records in one tenant-scoped workflow.",
  primaryText = "Open the Workspace",
  primaryHref = "/sign-in",
  secondaryText = "Read the 5-Step Workflow",
  secondaryHref = "/workflow",
  stampText = "TENANT-SCOPED RECORDS",
  showDeco = true,
}: FlagshipCtaProps) {
  return (
    <section className="marketing-cta-section flagship-cta" aria-labelledby="flagship-cta-heading">
      <div className="flagship-cta-card">
        <div className="flagship-cta-content">
          <span className="marketing-eyebrow">{eyebrow}</span>
          <h2 id="flagship-cta-heading">{title}</h2>
          <p>{description}</p>
          <div className="cta-buttons-group">
            <a href={primaryHref} className="marketing-button marketing-button-primary">
              <span>{primaryText}</span>
              <span className="btn-arrow" aria-hidden="true">
                →
              </span>
            </a>
            {secondaryText && (
              <a href={secondaryHref} className="marketing-button marketing-button-secondary">
                <span>{secondaryText}</span>
              </a>
            )}
          </div>
        </div>
        {showDeco && (
          <div className="flagship-cta-deco" aria-hidden="true">
            <div className="deco-ring deco-ring-1" />
            <div className="deco-ring deco-ring-2" />
            <div className="deco-stamp">{stampText}</div>
          </div>
        )}
      </div>
    </section>
  );
}
