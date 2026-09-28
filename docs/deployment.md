# Deployment and operations

Nischit includes Docker images and Compose definitions for local development and self-hosted operation. The production Compose file is a starting deployment topology; it does not provide high availability, managed secrets, security certification, or a guarantee that a particular environment is production-ready.

## Local development

Use Node.js 22 or later and pnpm 12.4.2:

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Start local infrastructure when needed:

```bash
docker compose --profile local-storage up -d postgres valkey rustfs
```

The default application configuration uses synthetic records and non-production identity and payment adapters. Never connect it to customer data or live payment credentials.

## Production topology

`compose.production.yaml` contains these services on a private application network:

- Caddy for HTTPS ingress and routing;
- Next.js web, NestJS/Fastify API, and the outbox worker;
- PostgreSQL and Valkey;
- a one-shot migration service;
- Rauthy for OIDC identity.

Evidence storage is configured against a private S3-compatible bucket. The API requires a private malware-scanning service. PostgreSQL, Valkey, Rauthy's internal port, the scanner, and the object-store console must not be exposed publicly. Publish only the reverse proxy and restrict host administration.

Before deployment, provision DNS and TLS for separate application and identity hostnames, an S3-compatible private bucket, a reachable malware scanner, durable database and identity volumes, an off-host encrypted backup target, and a supported host architecture. Use the sanitized [production environment example](../production.env.example) as a checklist. Replace every placeholder and supply secrets through a host secret manager or protected environment file that is excluded from Git.

## First deployment

1. Build and publish reviewed images through the `publish-images` workflow, or build them through an equivalent trusted pipeline. Pin all services to one immutable `sha-<commit>` image version.
2. Provision PostgreSQL owner and restricted runtime roles. `MIGRATION_DATABASE_URL` must use the schema owner; `DATABASE_URL` must use a non-owner role without superuser or `BYPASSRLS` privileges.
3. Configure private object storage, malware scanning, Valkey authentication, and the Rauthy issuer/client. Follow [authentication](authentication.md) for OIDC callback, audience, tenant claim, and one-time owner bootstrap.
4. Set a unique `AUTH_SESSION_SECRET` shared by web and API. Keep payment signing keys out of source, build arguments, image layers, and logs.
5. Review every production value, then start the stack with the protected environment file:

   ```bash
   docker compose --env-file .env -f compose.production.yaml up -d
   ```

6. Confirm that migrations complete, the API and web readiness checks pass, authenticated tenant membership works, private evidence upload and retrieval work, and worker retries remain idempotent.
7. Rehearse backup and restore against an isolated database before storing operational records.

The API exposes `GET /api/health` for liveness and `GET /api/health/ready` for readiness. A ready response does not prove that a payment or public-chain transaction was funded, confirmed, or reconciled.

## Storage and evidence

The application uses an `ObjectStore` interface backed by an S3-compatible client. RustFS is suitable for local development; Cloudflare R2 or another compatible service can be configured for hosted environments. Keep buckets private, use tenant-scoped object keys, verify hashes, configure exact CORS origins, and test upload, presigning, retrieval, retention, and deletion policies against the selected provider.

The API accepts a constrained set of evidence formats and requires a private malware scanner in production. Keep scanner ports private. A storage endpoint or successful upload alone does not establish evidence authenticity or product quality.

## Payments and public attestations

Mock payment and attestation adapters are for local development and automated verification. Production refuses mock rails. Do not enable a live adapter until the contract or service, signer custody, authorization rules, network, token, confirmation policy, privacy impact, and reconciliation process have been reviewed and exercised. Public-chain addresses and transaction metadata remain public; never publish patient, customer-confidential, or raw evidence data.

For Nepal deployments, use an approved payment arrangement and obtain appropriate legal review. The presence of an adapter does not establish regulatory approval or authorize custody of funds.

## Backups, migrations, and recovery

The repository provides guarded `pnpm db:backup` and `pnpm db:restore` commands. Restore requires an explicit backup path and confirmation value; rehearse it only against an isolated recovery database. Production operators must define backup encryption, off-host retention, evidence-object recovery, access control, retention, and recovery objectives.

Run migrations once per release with the privileged migration role after a backup and staging rehearsal. Prefer expand/contract migrations. Rolling back an image does not reverse an incompatible schema change. Persistent volumes are not backups; do not remove them as a deployment shortcut.

## Image publication

On pushes to the default branch, `.github/workflows/publish-images.yml` publishes affected service images to GitHub Container Registry using the repository-scoped `GITHUB_TOKEN`. It does not deploy to an operator's infrastructure. Pull requests run verification but do not publish images. Configure package visibility and access for the intended consumers, then deploy reviewed immutable image tags through the operator's own release process.

## Operational monitoring

Operators should monitor resource use, backup age, database health, outbox age, upload failures, identity errors, authorization denials, and settlement reconciliation lag. Logs must exclude tokens, document contents, patient data, and confidential commercial details. Production operation requires an assigned owner for patching, incident response, access reviews, backups, and dependency updates.
