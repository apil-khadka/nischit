---
layout: home
title: Nischit documentation
description: Learn the workflow, set up a development environment, and find operational and architecture reference.
docType: overview
hero:
  name: Nischit
  text: Product and developer documentation
  tagline: A clear guide to the product, its workflow, and the work required to operate it.
  actions:
    - theme: brand
      text: Run Nischit locally
      link: /getting-started
    - theme: alt
      text: Read the workflow rules
      link: /workflow-invariants
features:
  - title: Learn the product
    details: Follow a short tutorial, then read how purchasing, receiving, QA, inventory, and settlement fit together.
    link: /architecture
  - title: Build and contribute
    details: Set up the workspace, run the checks, and follow the module and security conventions.
    link: /testing
  - title: Operate with care
    details: Review identity, private evidence, database, payment, backup, and deployment requirements.
    link: /deployment
---

## Documentation map

The sidebar follows four documentation types so each page has one clear job:

- **Tutorials** teach a complete first task, starting with a local run.
- **How-to guides** give steps for a specific setup or operation.
- **Reference** records behavior, terms, configuration, and current implementation status.
- **Explanations** describe architecture, security boundaries, and decisions.

The [plain-language behavior guide](/test-guide) is the editable statement of expected system behavior. Update it when the expected workflow changes, then keep the implementation, reference pages, and checks aligned.

The repository’s current priorities live in [TODO.md](https://github.com/apil-khadka/nischit/blob/main/TODO.md). Product scope and synthetic examples are described in the [product specification](https://github.com/apil-khadka/nischit/blob/main/projectSpecification.md).
