import { NischitBrand } from "../brand";

export type MarketingPage = "home" | "product" | "workflow" | "security" | "pricing" | "sign-in";

const navItems = [
  ["Product", "/product", "product"],
  ["Workflow", "/workflow", "workflow"],
  ["Security", "/security", "security"],
  ["Pricing", "/pricing", "pricing"],
] as const;

export function MarketingShell({ page, children }: { page: MarketingPage; children: React.ReactNode }) {
  return (
    <div className="marketing-wrapper">
      <header className="marketing-nav-wrapper">
        <div className="marketing-nav">
          <a href="/" className="nav-brand-link" aria-label="Nischit home">
            <NischitBrand />
          </a>

          <div className="nav-center-block">
            <nav className="marketing-nav-links" aria-label="Main navigation">
              {navItems.map(([label, href, id]) => (
                <a
                  key={id}
                  href={href}
                  className={`nav-link ${page === id ? "active" : ""}`}
                  aria-current={page === id ? "page" : undefined}
                >
                  {label}
                  {page === id && <span className="nav-active-dot" aria-hidden="true" />}
                </a>
              ))}
            </nav>
          </div>

          <div className="marketing-nav-actions">
            <span className="nav-status-indicator">
              <span>Open source</span>
            </span>
            <a href="/sign-in" className="nav-signin-btn">
              <span>Open Workspace</span>
              <span className="btn-arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </header>

      <main className="marketing-page">{children}</main>

      <footer className="marketing-footer-wrapper">
        <div className="marketing-footer-container">
          <div className="footer-top-grid">
            <div className="footer-brand-col">
              <a href="/" className="footer-brand-link" aria-label="Nischit home">
                <NischitBrand />
              </a>
              <p className="footer-mission">
                A shared record connects reagent procurement, receiving evidence, human QA review, and recorded
                settlement states.
              </p>
              <div className="footer-compliance-rule">
                <span>Human QA review</span>
                <span className="divider-dot" aria-hidden="true">·</span>
                <span>Scoped roles</span>
                <span className="divider-dot" aria-hidden="true">·</span>
                <span>Private evidence references</span>
                <span className="divider-dot" aria-hidden="true">·</span>
                <span>No patient records</span>
              </div>
            </div>

            <div className="footer-links-col">
              <h4>Platform</h4>
              <ul>
                <li><a href="/product">Product Overview</a></li>
                <li><a href="/workflow">Operating Workflow</a></li>
                <li><a href="/security">Security &amp; Privacy</a></li>
                <li><a href="/pricing">Deployment</a></li>
              </ul>
            </div>

            <div className="footer-links-col">
              <h4>Solutions</h4>
              <ul>
                <li><a href="/product#cold-chain">Cold-Chain Reagents</a></li>
                <li><a href="/product#qa-gating">Quality Control Gating</a></li>
                <li><a href="/security#zk-boundary">Public commitment boundary</a></li>
                <li><a href="/pricing#pricing-options-heading">Deployment readiness</a></li>
              </ul>
            </div>

            <div className="footer-links-col">
              <h4>Verification</h4>
              <ul>
                <li><a href="/#verify-sandbox-heading">Verify Public Receipt</a></li>
                <li><a href="/security#tempo">Tempo adapter status</a></li>
                <li><a href="/security#solana">Solana receipt adapter status</a></li>
                <li><a href="/sign-in">Rauthy Workspace Sign-In</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom-bar">
            <div className="footer-copyright">
              <span>© {new Date().getFullYear()} Nischit contributors · Apache-2.0</span>
            </div>
            <div className="footer-security-note">
              <span>Operator-configured integrations · use synthetic data outside approved deployments</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
