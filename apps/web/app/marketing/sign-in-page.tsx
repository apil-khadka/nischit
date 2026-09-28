import { NischitBrand } from "../brand";
import { MarketingShell } from "./marketing-shell";

export function SignInPage() {
  return (
    <MarketingShell page="sign-in">
      <section className="sign-in-page">
        <section className="sign-in-panel" aria-labelledby="sign-in-heading">
          <div className="sign-in-header">
            <NischitBrand />
            <span className="sign-in-badge">
              <span className="status-live-dot" />
              <span>OIDC · PKCE</span>
            </span>
          </div>

          <div className="eyebrow-container">
            <p className="marketing-eyebrow">Secure Workspace Access</p>
          </div>
          <h1 id="sign-in-heading">
            Sign in to your <em>laboratory tenant.</em>
          </h1>
          <p className="sign-in-lead">
            Nischit verifies your organization session before opening tenant-scoped work. Your verified membership and
            assigned role determine your accountable actions.
          </p>

          <div className="sign-in-auth-box">
            <a className="marketing-button marketing-button-primary sign-in-btn-large" href="/auth/login?returnTo=%2Fdashboard">
              <span>Continue with Rauthy OIDC</span>
              <span className="btn-arrow" aria-hidden="true">→</span>
            </a>

            <div className="sign-in-assurance">
              <div className="assurance-item">
                <span className="assurance-icon">🔒</span>
                <span>Fails closed if verified claims are absent</span>
              </div>
              <div className="assurance-item">
                <span className="assurance-icon">🛡</span>
                <span>Tenant-scoped data model; deployment setup required</span>
              </div>
            </div>
          </div>

          <p className="sign-in-note">
            Authentication requires a configured identity provider. Each operator must review deployment security, access controls, and recovery procedures.
          </p>
        </section>
      </section>
    </MarketingShell>
  );
}
