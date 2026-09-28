# Authentication and tenant authorization

The web application uses OIDC Authorization Code with S256 PKCE through Rauthy. The API verifies the application session and resolves permissions from Nischit's own tenant membership records. The identity provider authenticates a person; it does not grant access to a tenant or operational action by itself.

The application-side callback and signed session support are implemented. A deployment still needs a persistent identity provider, TLS, a registered client, secure session secrets, initial membership provisioning, and end-to-end verification before it can accept operational users.

## Request flow

```text
Browser
  │ GET /auth/login
  ▼
Nischit web ── OIDC Authorization Code + S256 PKCE ──> Rauthy
  ▲                                                   │
  │ /auth/callback                                    │ authenticated user
  │                                                   ▼
  └─ HttpOnly nischit_session cookie <── code/token/userinfo
                         │
                         ▼
                  Nischit API /api/session
                         │
               signature + expiry + audience
                         │
                 tenant + membership + roles
```

The browser never receives an access token in JavaScript and never chooses its own tenant or role. The API ignores preview headers when verified identity is active; tenant membership remains the authorization boundary.

## Identity provider configuration

Run the identity provider as a separately maintained service. Terminate TLS at the trusted reverse proxy, keep its internal HTTP port private, use a persistent data volume, and restrict trusted proxies to the actual ingress network. Follow the provider's current production guidance for key rotation, MFA, recovery, and backup.

Register a confidential OIDC client for the Nischit web application:

```text
Client ID:       nischit-web
Redirect URI:    https://nischit.example.com/auth/callback
Allowed flow:    authorization_code, refresh_token
Scopes:          openid profile email
PKCE:            S256
```

Replace `nischit.example.com` with the operator's application hostname. Use an identity hostname such as `identity.example.com` for the issuer. Store the client secret only in the deployment secret manager. A public client is also supported when the client-secret field is empty; PKCE must remain enabled.

## Application environment

The web and API services must share the issuer, client ID, session issuer, cookie name, audience, tenant claim, and session secret:

```text
IDENTITY_MODE=rauthy-session
RAUTHY_ISSUER=https://identity.example.com/auth/v1
RAUTHY_CLIENT_ID=nischit-web
RAUTHY_CLIENT_SECRET=<confidential-client-secret>
NISCHIT_OIDC_REDIRECT_URI=https://nischit.example.com/auth/callback
AUTH_SESSION_ISSUER=nischit-session
AUTH_SESSION_COOKIE=nischit_session
AUTH_SESSION_SECRET=<at-least-32-random-characters>
IDENTITY_AUDIENCE=nischit-api
IDENTITY_TENANT_CLAIM=tenant_id
IDENTITY_USER_CLAIM=sub
```

Generate `AUTH_SESSION_SECRET` for the deployment; do not reuse the example or commit the value. The web and API need the same value. Refresh credentials remain in a separate HttpOnly cookie and are exchanged server-side.

## Initial tenant provisioning

For the first organization only, configure these one-time API values:

```text
IDENTITY_BOOTSTRAP_EMAIL=<verified-identity-email>
IDENTITY_BOOTSTRAP_TENANT_ID=<tenant-id>
IDENTITY_BOOTSTRAP_TENANT_NAME=<organization-name>
IDENTITY_BOOTSTRAP_ROLES=owner,admin
```

On the first verified `/api/session` request, Nischit creates the configured tenant and owner membership. Remove the bootstrap values after successful provisioning and redeploy. Additional users must be added through an authorized tenant-administration path or controlled migration; authentication alone must never grant membership.

For multiple tenants, configure a verified tenant claim or implement an explicit tenant-selection flow. A default tenant is intended only for initial single-tenant provisioning.

## Security invariants

- Disable preview identity in production.
- Fail closed when verified identity or the session secret is missing.
- Derive role permissions from tenant membership, not browser fields or identity-provider roles alone.
- Validate OIDC state, S256 PKCE, issuer, signature, audience, expiry, nonce, subject, and verified user information.
- Use `HttpOnly`, `Secure` production cookies with `SameSite=Lax` and a narrow path.
- Clear application and refresh cookies on logout and use the provider's advertised end-session endpoint when available.
