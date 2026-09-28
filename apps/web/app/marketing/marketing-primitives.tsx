import React from "react";

export function SectionIntro({
  id,
  eyebrow,
  title,
  children,
  badge,
}: {
  id?: string;
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="marketing-section-intro">
      <div className="eyebrow-container">
        <p className="marketing-eyebrow">{eyebrow}</p>
        {badge && <span className="intro-badge">{badge}</span>}
      </div>
      <h2 id={id}>{title}</h2>
      {children ? <p className="marketing-intro-body">{children}</p> : null}
    </div>
  );
}

export function CtaRow({
  primary = "Open the workspace",
  secondary = "See the workflow",
  secondaryHref = "/workflow",
}: {
  primary?: string;
  secondary?: string;
  secondaryHref?: string;
}) {
  return (
    <div className="marketing-actions">
      <a href="/sign-in" className="marketing-button marketing-button-primary">
        <span>{primary}</span>
        <span className="btn-arrow" aria-hidden="true">→</span>
      </a>
      <a href={secondaryHref} className="marketing-button marketing-button-secondary">
        <span>{secondary}</span>
      </a>
    </div>
  );
}
