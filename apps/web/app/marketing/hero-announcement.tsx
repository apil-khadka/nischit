import React from "react";

export function HeroAnnouncement({
  prefix = "Platform",
  message = (
    <>
      Synthetic examples · integrations require explicit configuration and verification.
    </>
  ),
  linkText = "Architecture →",
  linkHref = "/security",
}: {
  prefix?: string;
  message?: React.ReactNode;
  linkText?: string;
  linkHref?: string;
}) {
  return (
    <aside className="hero-announcement" aria-label="Product announcement">
      <div className="hero-announcement-content">
        <span className="announcement-prefix">{prefix}</span>
        <span className="announcement-sep" aria-hidden="true">·</span>
        <span className="announcement-text">{message}</span>
        {linkHref && (
          <a href={linkHref} className="announcement-link">
            {linkText}
          </a>
        )}
      </div>
    </aside>
  );
}
