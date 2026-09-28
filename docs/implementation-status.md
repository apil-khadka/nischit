# Implementation status

Updated 24 September 2026.

This repository contains an evolving implementation of the lab-supply workflow, including API, persistence, identity, storage, and chain-adapter code. Local verification uses synthetic records and deterministic adapters. A passing local check does not prove production deployment, regulatory compliance, customer validation, or live payment execution. Current production readiness gates are listed below; product boundaries and interface behavior are documented in [UI workflow research](ui-workflow-research.md) and [workflow invariants](workflow-invariants.md).

## Implemented

- pnpm TypeScript workspace with a domain package, NestJS/Fastify API, and Next.js/Astryx web app.
- Pure domain engine for tenant memberships, collaboration grants, products, versioned PO policy, supplier acknowledgement, funding, lot/shipment declaration, condition evidence, receiving, QA decisions, usage, quarantine/recall, mock settlement, and public verification receipts.
- Append-only inventory transfers between sites, expiry- and recall-blocked usage/settlement, and authorized quarantine release with conservation tests.
- Goods receipts retain their receiving site plus accepted/rejected quantity projections; QA cannot decide against a different site.
- Authorized recall users can list recalls and inspect tenant-scoped recorded remaining, usable, quarantined, consumed, and wasted quantities by site.
- Condition reports retain first/last timestamps, average/min/max temperature, excursion count/duration, a telemetry Merkle root, signature coverage, and hash-chain validity; malformed claimed chains cannot pass.
- QA adjustments retain integer supplier-credit and buyer-credit base-unit amounts whose sum equals the escrowed amount.
- Settlement rail errors leave the aggregate in `unknown` and allow an explicit idempotent retry; a timeout never becomes a confirmed payment.
- Role checks, active-tenant checks, scoped supplier grants, opaque settlement references, idempotency keys, inventory conservation checks, and separate payment/publication adapters.
- Domain behavior tests and API seam tests.
- Astryx Butter global CSS, Nischit design tokens, responsive dashboard shell, keyboard focus, status text, and reduced-motion handling.
- Docker multi-target build, Compose services for PostgreSQL, Valkey, optional local RustFS, API, and web.
- Initial PostgreSQL migration foundation for tenants, memberships, audit events, outbox events, and RLS policies.
- Worker process that polls the durable outbox table, acknowledges the implemented audit-event handler, and leaves unknown topics retryable.
- PostgreSQL-backed normalized aggregate persistence with bigint-safe amounts, a legacy singleton read fallback, and a single-process command queue for the Compose path. The normalized round-trip covers procurement, condition metrics, receipts, QA, inventory, settings, settlement, audit, and outbox rows.
- Tenant settings for IANA timezone, active sites, and usage reason codes, plus append-only opening and correction inventory events and an authorized verification-report projection.
- Role-specific read models for supplier inbox, buyer product/supplier selection, receiving queue, QA queue, and finance settlement queue; each read model is derived from the tenant-scoped aggregate and filtered by active membership/grants.
- S3-compatible evidence-store adapter with tenant-scoped keys and SHA-256 validation; it is configurable for Cloudflare R2 or RustFS and is covered by adapter tests.
- API evidence upload and presign endpoints that resolve the active tenant from request context, return only opaque object references/checksums, and carry private object identifiers into shipment condition reports.
- Application-owned identity seam with a fail-closed Rauthy OIDC callback, S256 PKCE, signed HttpOnly session, refresh path, and tenant membership resolution; RS256 bearer validation remains available for service integrations and preview headers remain local-only.
- PostgreSQL integration test and CI service covering the migration, normalized procurement/condition/receipt/QA/inventory/settlement round-trip, tenant settings, tenant/membership/audit upserts, legacy compatibility path, and outbox foreign-key path.
- Configurable Tempo escrow and Solana memo adapters with explicit environment selection; deterministic mocks remain the default for local development and automated verification. A minimal review-required Tempo escrow contract and Foundry tests are included.
- Public purchase-order verification now queries the configured Tempo and Solana RPCs independently. Tempo checks the configured chain, escrow target, receipt status, matching order event, amounts, and confirmation count; Solana checks transaction status and the exact Nischit memo commitment. RPC or missing-transaction results remain explicit (`pending`, `unavailable`, or `unverifiable`) and do not imply proof. Tempo reports only the transaction reference currently stored on the settlement.
- Live multi-user API audit covered buyer owner, finance, receiver, QA, supplier, forged-user, and wrong-tenant identities. Role and tenant boundaries passed; the supplier inbox and stronger evidence object checks are now covered by domain/API tests.
- PostgreSQL outbox worker integration test covering transactional locking, known-event acknowledgement, and retryable unknown topics.
- Docker API/worker/web images have been built and a local Compose smoke test has run against PostgreSQL, Valkey, and RustFS; the containerized API bootstrapped a fresh database and the worker started successfully.
- Guarded PostgreSQL custom-format backup and explicitly confirmed destructive restore scripts are included; an isolated PostgreSQL container dump/restore rehearsal passed, while VPS/off-host encrypted backup rehearsal remains an operational gate.
- The web production bundle now starts Rauthy login from `/auth/login`, creates a verified session through `/auth/callback`, and renders a clear sign-in gate when that session is missing; it never hydrates the local preview tenant in production. The Astryx light-mode workspace and test-mode browser workflow are covered separately, including a production-bundle HTTP smoke check.
- The API client handles non-JSON upstream failures; queue loading is abortable; mutation controls use stable idempotency keys and pending-action guards; collaboration grants are idempotent; health endpoints and Compose checks expose service state; and the worker poll loop does not overlap runs.

## Production-readiness limitations

- The API seeds synthetic records only in non-production environments and persists the aggregate through the normalized PostgreSQL repository when `PERSISTENCE_MODE=postgres`. Production refuses mock rails and does not seed preview tenants. The in-process command queue is single-process; horizontal command processing requires a distributed concurrency design. Evidence objects link to condition reports through opaque identifiers. Audit events enter the outbox transactionally; external chain and notification handlers remain open. Unknown topics are intentionally retried rather than acknowledged.
- Local and synthetic deployments use deterministic payment/publication mocks. The real adapters are testnet-capable but require an explicitly configured escrow address, token/supplier address map, signer key, and RPC endpoints; no real token, mainnet, wallet, custody key, or Nepal production payment is used by default.
- The web application uses Astryx Theme/AppShell/TopNav/SideNav/Table/Stepper/Banner/EmptyState primitives for the role-aware workspace and a light, restrained marketing surface for the public entry pages. The public flow is `/` through `/sign-in` to `/auth/login` and the protected `/dashboard` workspace; the browser resolves a preview identity only in local/test mode from `NEXT_PUBLIC_NISCHIT_*` settings. Hosted identity-provider operations and full tenant switching remain production-readiness gates.

## Production-readiness gates

Before production use, verify PostgreSQL and tenant isolation, configure external JWKS rotation, review and exercise the contract/receipt adapters on isolated networks, complete worker and reconciliation handlers, perform object-store contract tests and an off-host encrypted backup/restore rehearsal, and close the browser/security gates described in [testing](testing.md). Do not represent synthetic records as live operational data or claim clinical validation.
