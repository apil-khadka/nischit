---
title: Technology stack
description: Find the languages, frameworks, infrastructure, and package boundaries used in this repository.
docType: reference
---

# Technology stack

This page records the stack currently used by the repository and the conditions for changing it. The package manifests and lockfile are the source of truth for exact dependency versions.

## Application stack

| Area | Current implementation | Production considerations |
|---|---|---|
| Language and runtime | TypeScript, Node.js 22+, pnpm workspaces | Keep strict typing enabled, do not use explicit `any`, and update the lockfile with reviewed dependency changes. |
| Web | Next.js App Router, React, Astryx components, StyleX | Review server rendering, browser-visible configuration, accessibility, and cache behavior for each release. |
| API | NestJS with Fastify | Validate authorization and tenant context at the API boundary for every operation. |
| Domain | TypeScript modules behind application-owned ports | Keep provider SDKs and persistence models out of the domain layer. |
| Database | PostgreSQL with explicit SQL migrations and normalized persistence | Use restricted runtime roles, forced RLS where required, and rehearsed migrations. |
| Background work | PostgreSQL transactional outbox and a separate worker | Handlers must be idempotent and retry-safe; unknown topics remain retryable. |
| Evidence storage | S3-compatible object-store adapter | Keep buckets private; validate malware scanning, access, retention, and recovery. |
| Identity | OIDC through Rauthy with application-owned membership and authorization | Configure session secrets, tenant provisioning, MFA, revocation, and recovery per deployment. |
| Payments and receipts | Optional Tempo and Solana adapters | Keep disabled until signer custody, privacy, authorization, and reconciliation are reviewed. |
| Tests | Vitest and PostgreSQL integration tests; Playwright harness | CI runs the repository verification workflow; production environments require additional provider contract checks. |
| Documentation | Markdown, VitePress, checked frontmatter and CI site build | Keep page types, internal links, and the sidebar aligned with the documentation index. |
| Deployment | Docker images and Compose files | Compose is a self-hosting option, not an availability or security certification. |

## Infrastructure boundaries

PostgreSQL is the source of truth for operational records and durable work. Valkey is limited to disposable cache, rate-limit, and coordination use. S3-compatible object storage holds private evidence files; it does not replace database backups. Each dependency must remain on a private network unless its protocol requires an explicitly protected ingress.

RustFS can provide local S3-compatible storage. A hosted operator may use Cloudflare R2 or another compatible provider after validating upload, presigning, retrieval, checksum, CORS, deletion, and retention behavior. The application interface does not guarantee identical provider semantics.

## Chain tooling

| Integration | Implementation | Boundary |
|---|---|---|
| Tempo | Solidity, Foundry, viem | Conditional settlement adapter; live use requires contract and custody review. |
| Solana | `@solana/kit`, memo program | Signed receipt/attestation adapter; a receipt records an assertion and does not verify physical quality. |
| Future network or program | Add only behind an explicit interface and decision record | Require a defined trust model, privacy review, and independent failure/reconciliation behavior. |

The domain layer consumes payment and attestation ports. It does not import chain SDK objects. A failed receipt publication must never repeat a confirmed payment.

## Provider selection

Add an external provider only when it is needed. Place it behind an application-owned interface, document its data and secret requirements, define timeout and retry behavior, and provide a contract test and replacement path. Keep a clear owner for keys and operations.
