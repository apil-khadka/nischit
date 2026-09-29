---
title: Testing and verification
description: Choose the checks that fit a code change, from static policy checks to database integration tests.
docType: how-to
---

# Testing and verification

The test suite follows the domain seams in [workflow invariants](workflow-invariants.md). Tests assert behavior through public commands and HTTP endpoints; they do not reach into private engine state or mock implementation details.

## Commands

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm check:no-any
pnpm check:docs
pnpm docs:build
pnpm verify
pnpm test:integration
pnpm test:e2e
docker compose config
bash -n scripts/backup-postgres.sh scripts/restore-postgres.sh
```

`pnpm verify` runs the explicit-`any` policy check, documentation metadata check, type checking, unit/API tests, and application production builds. CI also runs `pnpm docs:build` to validate the VitePress site and its internal links. `pnpm test:integration` runs the API and worker PostgreSQL suites when `TEST_DATABASE_URL` is configured. `pnpm test:e2e` builds the API prerequisites and runs the Playwright browser checks against the local synthetic preview identity. CI installs Chromium before running this command. `docker compose config` catches malformed service, network, volume, and environment declarations without starting containers.

The web API-client suite covers non-JSON proxy failures, bounded actionable error messages, tenant headers, JSON command payloads, and idempotency headers. The API seam covers liveness/readiness and repeated collaboration grants. Keep these checks aligned with the deployment contract and operational failure modes.

## Current test seams

### Domain seam

`packages/domain/src/engine.test.ts` covers supplier acknowledgement before funding, grant-scoped supplier inbox visibility, role-specific receiving/QA/finance queues, opaque settlement references, missing evidence, shipment-window telemetry coverage, non-finite temperatures, malformed/unverified claimed telemetry chains, human QA reasons, Hold/Reject settlement state, adjustment-policy authority, receipt-site authority, accepted/rejected quantity projections, integer adjustment conservation, tenant and collaboration boundaries, lot visibility after buyer receipt, inventory conservation, site transfers, expiry/recall-blocked usage, authorized quarantine release, insufficient stock, unknown-payment reconciliation before retry, idempotent funding/settlement retries, and independent Solana publication state.

### HTTP seam

`apps/api/src/app.controller.test.ts` covers health, local preview configuration, tenant-scoped purchase-order reads, tenant-scoped evidence presigning, buyer QA access to only evidence attached to a PO, recall impact reads, and the documented PO-to-verification HTTP path through Fastify injection. Future endpoint tests should use the same seam and synthetic headers until the identity provider adapter is configured.

`apps/api/src/identity.test.ts` covers the application-owned identity seam, verifies that the local preview adapter rejects incomplete tenant context, exercises RS256 bearer validation for service integrations, and verifies the HMAC session cookie consumed after the Rauthy callback.

### Storage seam

`packages/storage/src/s3-store.test.ts` covers tenant-scoped object keys, path-segment validation, upload checksum verification, and stored metadata verification without requiring a live bucket. RustFS and R2 contract tests remain deployment gates.

### Browser seam

The Playwright browser seam currently covers public-page navigation, the buyer overview's role-scoped status summary and “Up next” record shortcut, preview role-specific queues and record inspection, and mobile workspace navigation without horizontal overflow. These checks intentionally run only against synthetic preview data. They do not cover Rauthy authentication, verified tenant membership, live integrations, payment execution, or tenant-switch isolation. Add those cases when a deterministic identity-provider test user and isolated service fixtures are available.

### Worker seam

`apps/worker/src/main.test.ts` verifies ready-event selection and the acknowledgment boundary: `audit.recorded` is processed, while unknown topics remain retryable with an incremented attempt count. `worker.integration.test.ts` verifies the same behavior through a real PostgreSQL transaction and row lock.

### PostgreSQL seam

`apps/api/src/persistence.integration.test.ts` runs against `TEST_DATABASE_URL` when configured. It applies the checked-in migrations and verifies normalized tenant settings, procurement, condition metrics and coverage, private evidence references, receipts, QA quantities, site holdings, settlement splits, audit, and outbox persistence in one transaction; it also asserts that the legacy singleton is not written. CI provides PostgreSQL 17; local runs skip this seam when no test database is configured.

### Chain seam

`packages/chains` contains explicit Tempo escrow and Solana memo adapters. The domain only consumes its payment and attestation ports. Unit tests cover adapter configuration parsing; `contracts/test/NischitEscrow.t.sol` covers the escrow split/refund invariants when the local Foundry toolchain is available. Testnet RPC and signer execution are deployment gates and must never be enabled by an implicit fallback.

The local Compose smoke check additionally builds all Docker targets, starts PostgreSQL/Valkey/RustFS, starts the API and worker images, checks `/api/health` and the non-production `/api/preview` preview route, and verifies that a first PostgreSQL-backed purchase-order command persists audit/outbox rows.

The live local storage check starts Compose with `--profile local-storage`, uploads evidence through `POST /api/evidence`, obtains a tenant-scoped presigned URL, and fetches the object from the API container network. This is the RustFS contract rehearsal; the equivalent R2 rehearsal remains a production deployment gate.

### Build seam

Next.js production compilation is a verification gate for Astryx CSS/theme loading, server rendering, standalone output, and TypeScript validity. Docker Compose configuration is validated separately.

## Required next verification gates

Before production deployment or any real payment:

- PostgreSQL integration tests with real RLS policies and pooled-connection tenant context.
- Additional transactional outbox tests under duplicate delivery, worker restart, and real PostgreSQL locking.
- Object-store contract tests against RustFS and R2 for upload, download, presigning, checksums, CORS, and private access.
- Contract tests against the selected Tempo testnet contract and Solana devnet receipt path.
- Playwright coverage for verified sessions, mobile receiving actions, failure states, and tenant-switch isolation.
- Dependency, image, secret, and migration scans.
- Restore test and evidence-object reconciliation.
- Testnet chain adapter execution with a deployed contract, duplicate/timeout reconciliation, and Solana memo lookup.

These are explicit gates, not claims made by the current in-memory development mode.
