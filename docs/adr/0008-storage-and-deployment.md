---
title: Storage and deployment topology
description: Record the roles of PostgreSQL, Valkey, object storage, and the Compose deployment processes.
docType: explanation
---

# Storage, job state, and deployment topology

**Status: accepted.** This records the current deployment architecture while keeping provider-specific services behind application interfaces.

Run the web, API, worker, PostgreSQL, and Valkey with Docker Compose on a supported host. Evidence files use a private S3-compatible object store; local development may use RustFS through the same application interface. Docker images and separate local/production Compose configuration are included.

PostgreSQL owns operational records and durable outbox/job state. Valkey holds disposable caches, rate limits, and coordination only. Neither Valkey nor object storage replaces the database.

Consequences: a single host is a single failure domain; capacity, off-host backups, restoration, secret protection, and host patching need explicit ownership. S3-compatible provider behavior must be tested rather than assuming full API compatibility. A managed database or larger platform remains an evidence-based deployment choice.

See the [deployment contract](../deployment.md) for isolation and release gates.
