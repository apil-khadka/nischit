# Nischit TODO

This is the active work list. The [roadmap](docs/roadmap.md) explains the production-readiness sequence, and [implementation status](docs/implementation-status.md) records what currently exists. Keep this file limited to actionable work; update it when scope changes or an item is completed.

## Completed foundation

- [x] Extract condition-evidence evaluation behind a focused domain module.
- [x] Split workspace data, session setup, navigation, and workflow panels into focused modules.
- [x] Add an AST-based check that rejects explicit TypeScript `any` types.
- [x] Add VitePress source docs, organized navigation, required page metadata, and CI site-build validation.
- [x] Publish only the generated documentation site to GitHub Pages from `main`.
- [x] Add Playwright coverage for public navigation, preview workspace records, and phone-width navigation.

## Documentation and contributor workflow

- [ ] Keep page metadata, links, and sidebar navigation aligned when pages change.
- [ ] Make behavior-guide changes easy to propose and trace through the matching implementation and automated checks.

## Production readiness

- [ ] Validate pooled PostgreSQL connections and tenant isolation against the production RLS policies.
- [ ] Define distributed command concurrency before running more than one API process.
- [ ] Complete durable outbox handlers for payment reconciliation, chain confirmation, and notifications.
- [ ] Add provider contract checks for private evidence upload, malware scanning, presigning, retention, deletion, and checksum verification.
- [ ] Configure external JWKS rotation and rehearse tenant membership provisioning, revocation, and recovery.
- [ ] Review the Tempo contract, signer custody, and both chain adapters against isolated test networks.
- [ ] Rehearse encrypted off-host backups, restore, migration, and evidence-object reconciliation.
- [ ] Add operational metrics, alerts, and resource limits for the API, worker, database, and evidence path.

## Product validation

- [ ] Validate workflow language, roles, units, evidence requirements, and exception handling with operators using non-sensitive records.
- [ ] Add verified-session browser coverage after an isolated identity-provider test user and deterministic tenant fixture are available.
- [ ] Record measured workflow outcomes separately from product goals.

## Maintenance rule

Review this list when [implementation status](docs/implementation-status.md) or the [production-readiness roadmap](docs/roadmap.md) changes. Remove completed entries after implementation and documentation agree.
