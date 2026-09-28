# Nischit

Nischit is an open-source lab supply operations platform for purchase terms, lot and shipment evidence, receiving, human QA, inventory movement, recalls, and settlement records.

It is designed around production concerns: tenant isolation, private evidence storage, explicit human approval, durable audit events, idempotent payment workflows, and independently configurable infrastructure adapters. The current release is not ready for production use. Identity, evidence scanning, storage, payment and chain integrations, operations, and security need deployment-specific configuration and review. It is not a certified clinical, quality-management, or compliance system.

## Start here

- [Product specification](projectSpecification.md)
- [Architecture](docs/architecture.md)
- [Production readiness and implementation status](docs/implementation-status.md)
- [Contributor guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Documentation index](docs/README.md)

## Development setup

Requirements: Node.js 22 or later, pnpm 12.4.2, and Docker Compose.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The web app is served at `http://localhost:3000` and the API at `http://localhost:4000/api`. The default local configuration uses in-memory application state and synthetic records. Start PostgreSQL, Valkey, and RustFS when working on persistence, coordination, or evidence storage:

```bash
docker compose --profile local-storage up -d postgres valkey rustfs
```

Use only synthetic data in development. Never add credentials, patient information, customer records, or confidential supplier documents to the repository.

## Verification commands

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:integration  # requires TEST_DATABASE_URL
```

The CI workflow runs integration verification and the workspace checks on pull requests.

## Project boundaries

Nischit records operational evidence and decisions. A hash or public-chain transaction does not prove a sensor was accurate, goods were physically handled as recorded, or a QA decision was correct. Payment and attestation adapters are optional and must be configured explicitly. Production use requires a reviewed identity and authorization setup, private storage and malware scanning, backups and recovery procedures, monitoring, security review, and applicable legal and customer approvals.

The application must not collect patient identities, diagnoses, clinical histories, or patient-linked test results. See [security and privacy](docs/security-privacy.md) and [workflow invariants](docs/workflow-invariants.md).

## License

Nischit is licensed under the [Apache License 2.0](LICENSE).
