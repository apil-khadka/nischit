---
title: Public web application
description: Reference the public routes, sign-in path, and workspace boundary in the web application.
docType: reference
---

# Public web application

The public web application explains Nischit's product boundary and provides entry points for the authenticated workspace. Route structure and copy should remain accurate about which services, integrations, and operational controls are configured in a given deployment.

## Route map

| Route | Purpose |
| --- | --- |
| `/` | Explain the product and its operating boundary |
| `/product` | Describe records and system responsibilities |
| `/workflow` | Explain the accountable operational handoffs |
| `/security` | Describe tenancy, evidence privacy, and verification limits |
| `/pricing` | Explain that no published pricing or production offer is available |
| `/sign-in` | Start authentication when an identity provider is configured |
| `/dashboard` | Authenticated, tenant-scoped operational workspace |

The URL structure is intentionally simple. The workspace is a separate product surface and does not use the public marketing layout.

## Interface and content

`apps/web/public/brand/nischit-mark.png` is the current Nischit mark. The public pages use the Astryx Butter design system and Nischit's semantic colors. Keep status meanings accessible and distinguish live server state from synthetic or cached values.

Marketing copy must not claim regulatory certification, product stability, clinical validation, live payment execution, or customer results without evidence. A public-chain receipt records an assertion and does not establish the truth of physical handling.

## Authentication boundary

`/sign-in` starts the configured identity-provider flow. The production build must fail closed when a verified session is absent and must not load local preview identity. See [authentication](authentication.md) for the OIDC and tenant-membership contract.

## Verification

Public route and navigation checks live with the web tests. Deployment operators must verify the built application, TLS, identity callback, and protected workspace against their own configured environment before serving operational users.
