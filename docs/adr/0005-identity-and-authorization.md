# Use external authentication with application-owned authorization

**Status: accepted.** Nischit uses an OIDC identity provider behind an `IdentityProvider` interface. Nischit owns canonical membership, tenant context, collaboration grants, role-to-permission mapping, workflow authorization, and audit rules because those decisions are domain-specific and must not be hidden inside an identity vendor. The identity provider supplies authentication, MFA, and OIDC user claims; Nischit maps a verified session to its own tenant membership.
