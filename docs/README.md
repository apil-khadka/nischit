# Nischit documentation

This documentation describes the product boundary, architecture, implementation status, operational requirements, and safety invariants for contributors and deployment operators.

## Start here

- [Product specification](../projectSpecification.md) — intended behavior and domain scope.
- [Domain language](domain-language.md) — shared business terms.
- [Architecture](architecture.md) — modules, services, and adapter boundaries.
- [Implementation status](implementation-status.md) — implemented behavior and production readiness gates.
- [Roadmap](roadmap.md) — staged work toward a deployable system.
- [Workflow invariants](workflow-invariants.md) — rules that must remain true across receiving, inventory, QA, and settlement.
- [Security and privacy](security-privacy.md) — data classification and security boundaries.
- [Authentication](authentication.md) — OIDC and tenant membership behavior.
- [Deployment](deployment.md) — local and self-hosted operation.
- [Testing](testing.md) — automated checks and integration requirements.
- [Technology stack](tech-stack.md) and [design system](design-system.md) — framework and interface conventions.

## Decisions

Architecture decisions that are costly to reverse or surprising to maintainers are recorded in [`adr/`](adr/):

- [ADR 0001 — TypeScript modular monolith](adr/0001-typescript-modular-monolith.md)
- [ADR 0002 — PostgreSQL as operational source of truth](adr/0002-postgresql-source-of-truth.md)
- [ADR 0003 — Tenant isolation and collaboration grants](adr/0003-tenant-isolation.md)
- [ADR 0004 — Tempo and Solana adapters](adr/0004-chain-adapters.md)
- [ADR 0005 — External identity with application-owned authorization](adr/0005-identity-and-authorization.md)
- [ADR 0006 — No patient data in Nischit](adr/0006-no-patient-data.md)
- [ADR 0007 — Astryx Butter design system](adr/0007-astryx-design-system.md)
- [ADR 0008 — Object storage and disposable coordination](adr/0008-storage-and-deployment.md)

## Documentation rules

- Separate verified implementation behavior from assumptions and future plans.
- Update the relevant invariant, ADR, and operator guidance when behavior changes.
- Keep production configuration examples generic and free of credentials or personal infrastructure details.
- Never add credentials, patient information, customer records, or confidential supplier documents.

## Current system shape

Nischit is a TypeScript workspace with a Next.js web app, a NestJS/Fastify API, a worker, PostgreSQL persistence, private S3-compatible evidence storage, and optional payment and attestation adapters. Local and automated verification use synthetic records and deterministic adapters. Production deployment requires a verified identity provider, private evidence scanning and storage, restricted runtime roles, backup and recovery procedures, monitoring, and explicit validation of any payment or public-chain integration. These requirements are gates, not claims that a deployment is already production-ready.
