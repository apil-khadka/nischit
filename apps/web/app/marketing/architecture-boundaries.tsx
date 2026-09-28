import React from "react";
import { SectionIntro } from "./marketing-primitives";

export function ArchitectureBoundaries() {
  return (
    <section className="marketing-section architecture-boundary-section" aria-labelledby="boundary-heading">
      <SectionIntro
        id="boundary-heading"
        eyebrow="Architectural Boundaries"
        title={
          <>
            The product is <em>not a blockchain explorer.</em>
          </>
        }
      >
        Operational records remain private by default. Local evaluation uses synthetic data and deterministic adapters; external integrations require explicit deployment configuration.
      </SectionIntro>

      <div className="architecture-dual-grid">
        <div className="arch-card arch-private">
          <div className="arch-header">
            <span className="arch-type-badge">System of Record</span>
            <h3>Tenant-Scoped Operations</h3>
            <p>Application records are scoped to an organization and its authorized users.</p>
          </div>
          <ul className="arch-features-list">
            <li>
              <span className="arch-icon">✓</span>
              <div>
                <strong>PostgreSQL ACID State:</strong> Fast transactional storage for orders, lots, sites, and inventory.
              </div>
            </li>
            <li>
              <span className="arch-icon">✓</span>
              <div>
                <strong>Evidence Storage:</strong> Object storage interface for private evidence references; production settings are required.
              </div>
            </li>
            <li>
              <span className="arch-icon">✓</span>
              <div>
                <strong>OIDC Authentication:</strong> Configurable identity integration with role checks in the application.
              </div>
            </li>
            <li>
              <span className="arch-icon">✓</span>
              <div>
                <strong>Human QA Gate:</strong> A person records the quality decision; the system does not make the inspection.
              </div>
            </li>
          </ul>
        </div>

        <div className="arch-card arch-public">
          <div className="arch-header">
            <span className="arch-type-badge highlight">Proof Layer</span>
            <h3>Optional Chain Adapters</h3>
            <p>Integration points for settlement and public receipts; live network use is not verified.</p>
          </div>
          <ul className="arch-features-list">
            <li>
              <span className="arch-icon">✦</span>
              <div>
                <strong>Tempo:</strong> Settlement adapter code is present; no live escrow execution is claimed.
              </div>
            </li>
            <li>
              <span className="arch-icon">✦</span>
              <div>
                <strong>Solana:</strong> Receipt adapter code is present; no live receipt publication is claimed.
              </div>
            </li>
            <li>
              <span className="arch-icon">✦</span>
              <div>
                <strong>Data minimization:</strong> The product is designed for supply evidence, not patient records.
              </div>
            </li>
            <li>
              <span className="arch-icon">✦</span>
              <div>
                <strong>Configuration matters:</strong> Adapter and deployment behavior depends on environment setup.
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
