---
title: Run Nischit locally
description: Start the web app and API with synthetic development data.
docType: tutorial
---

This tutorial starts the Nischit web app and API using the repository’s local development defaults. It uses synthetic records and does not connect to a live payment rail.

## What you need

- Node.js 22 or later
- pnpm 12.4.2
- Git

Docker Compose is only needed when you want to work with PostgreSQL, Valkey, or RustFS. The default local application can run with in-memory state.

## Start the workspace

From the repository root, install the dependencies and create your local environment file:

```sh
pnpm install
cp .env.example .env
```

Start the web app and API:

```sh
pnpm dev
```

Open `http://localhost:3000` for the web app. The API is available at `http://localhost:4000/api`.

## Open the workspace

Use the local preview identity shown by the development configuration. Select a role from the workspace menu to see the role-specific queues. Preview data is synthetic; it does not establish that a real order, shipment, QA review, payment, or public-chain receipt exists.

## Check the expected behavior

Read the [plain-language behavior guide](test-guide.md) before changing a workflow. It states what users should observe in ordinary language. Keep that guide and the implementation aligned when behavior changes.

The [verification guide](testing.md) lists the automated checks. Run the no-`any` policy check with `pnpm check:no-any`. PostgreSQL integration checks require a disposable database configured through `TEST_DATABASE_URL`.

## Continue learning

- [Architecture](architecture.md) explains the application modules and adapter seams.
- [Workflow invariants](workflow-invariants.md) records rules that must hold across receiving, QA, inventory, and settlement.
- [Deployment and local services](deployment.md) covers PostgreSQL, Valkey, RustFS, and deployment configuration.
- [Contributing](https://github.com/apil-khadka/nischit/blob/main/CONTRIBUTING.md) describes pull requests and contribution expectations.
