# Contributing to Nischit

Nischit welcomes bug reports, documentation improvements, and code contributions. Contributions are reviewed for correctness, security, tenant isolation, operational safety, and consistency with the documented product boundaries.

## Before you start

- Read the [README](README.md), [architecture](docs/architecture.md), [workflow invariants](docs/workflow-invariants.md), and [security and privacy guidance](docs/security-privacy.md).
- For a substantial feature or design change, open an issue first so maintainers and contributors can agree on scope and behavior.
- Check the current [implementation status](docs/implementation-status.md) and [roadmap](docs/roadmap.md) before starting work.
- Use synthetic data only. Do not submit patient information, customer records, credentials, private keys, or confidential supplier documents.

## Development

Use Node.js 22 or later and pnpm 12.4.2.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The local web app is available at `http://localhost:3000`; the API is at `http://localhost:4000/api`. See [deployment and local services](docs/deployment.md) for PostgreSQL, Valkey, RustFS, and production configuration.

Before opening a pull request, run the checks relevant to your change:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Database integration tests require `TEST_DATABASE_URL` and a disposable PostgreSQL database:

```bash
pnpm test:integration
```

Do not commit generated output, local environment files, or unrelated formatting changes.

## Pull requests

- Keep each pull request focused and explain the user or operational problem it solves.
- Describe behavior changes, security or data-model implications, and any migration or configuration steps.
- Update relevant documentation and tests when behavior or an invariant changes.
- Include screenshots for material web-interface changes.
- Call out checks you ran and checks that need an environment this repository does not provide.
- Use conventional commit prefixes when practical: `feat`, `fix`, `docs`, `refactor`, `test`, `build`, or `chore`.

By submitting a contribution, you agree that it is provided under the [Apache License 2.0](LICENSE). You retain copyright in your contribution.
