---
title: Documentation index
description: Find Nischit tutorials, task guides, product references, and architecture explanations.
docType: overview
---

# Nischit documentation

This documentation is the maintained guide to Nischit's product behavior, contributor workflow, implementation, and operation. It is also the source for the VitePress documentation site.

## Learning paths

### Tutorials

- [Run Nischit locally](getting-started.md) — install dependencies, start the app, and explore synthetic data.

### How-to guides

- [Deployment and operations](deployment.md) — configure local services and understand deployment requirements.
- [Authentication and tenant authorization](authentication.md) — configure OIDC and application-owned access.
- [Testing and verification](testing.md) — choose lightweight, unit, integration, and deployment checks.

### Reference

- [Product specification](https://github.com/apil-khadka/nischit/blob/main/projectSpecification.md) — intended behavior and domain scope.
- [Plain-language test guide](test-guide.md) — editable statements of expected behavior that should guide implementation and tests.
- [Implementation status](implementation-status.md) — implemented behavior and current readiness gates.
- [Roadmap](roadmap.md) — staged work toward a deployable system.
- [Workflow invariants](workflow-invariants.md) — rules that must remain true across receiving, inventory, QA, and settlement.
- [Domain language](domain-language.md) — shared business terms.
- [Technology stack](tech-stack.md), [design system](design-system.md), and [public site](public-site.md) — framework and interface conventions.
- [Brand and naming](brand-naming.md) — product wording.

### Explanations

- [Architecture](architecture.md) — modules, services, and adapter boundaries.
- [Security and privacy](security-privacy.md) — data classifications, restrictions, and security boundaries.
- [Multi-tenancy](multi-tenancy.md) — tenant isolation and controlled collaboration.
- [Workflow UI research](ui-workflow-research.md) — design rationale for the operator workflows.
- [Architecture decision records](adr/) — durable decisions that affect system structure or safety.

## Keep documentation current

When expected product behavior changes, edit the [plain-language test guide](test-guide.md) first. Then align the implementation, automated checks, invariants, and operator guidance. Update [implementation status](implementation-status.md) only for behavior that exists and has been checked; keep future work in the root [TODO](https://github.com/apil-khadka/nischit/blob/main/TODO.md) and [roadmap](roadmap.md).

Each page has YAML frontmatter for the documentation site. Use one of the page types above and add the page to the matching group in `docs/.vitepress/config.mts`. Run `pnpm check:docs` for metadata validation and `pnpm docs:build` to check the site.

The GitHub Pages workflow builds and publishes only `docs/.vitepress/dist` when documentation changes reach `main`. Enable GitHub Pages with GitHub Actions as its source before the first deployment; this is tracked in the root [TODO](https://github.com/apil-khadka/nischit/blob/main/TODO.md).

Do not include credentials, patient information, customer records, or confidential supplier documents in examples or documentation.
