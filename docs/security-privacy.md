# Security and privacy requirements

## Security position

Nischit handles commercially sensitive procurement and quality evidence. It should not handle patient identities, patient test reports, diagnoses, or clinical histories. Product Certificates of Analysis and reagent-quality documents are allowed only without patient data. The public chain is for commitments, selected state, and settlement references—not private records.

This document describes engineering controls. It is not legal advice or a certification claim.

## Data classification

| Class | Examples | Storage rule |
|---|---|---|
| Public | Product explanation, public verification status, contract address | May be published deliberately. |
| Tenant-confidential | PO prices, supplier terms, branch stock, QA comments, invoices | Encrypted database/object storage; never raw on public chain. |
| Restricted | Device private keys, payment credentials, admin tokens, signing keys | Secret manager or restricted mounts; reviewed external custody/key management for real funds; never logs or repository. |
| Prohibited | Patient identity, clinical results, diagnosis, health history | Do not collect or store in Nischit. |

Nepal’s Privacy Act treats personal information and health/test information as private. The application should keep the product outside the clinical record system and integrate only with non-PHI inventory or test-count data where necessary.

References:

- [Nepal Privacy Act 2075](https://lawcommission.gov.np/en/?p=1937)
- [Nepal Electronic Transactions Act](https://lawcommission.gov.np/en/?p=1677)
- [WHO quality management: procurement and inventory](https://www.who.int/tools/quality-management-system-for-non-laboratory-settings/pillar-3--procurement-supply-chain-and-inventory-management)

## Threats and controls

### Cross-tenant access

Controls: explicit tenant context, API policy, repository scoping, Postgres RLS, object-key scoping, background-job context, and automated two-tenant tests.

### Forged or replayed condition evidence

Controls: sequence and predecessor checks, shipment binding, timestamp-window coverage, idempotency keys, calibration/provenance metadata, and a visible distinction between manual, uploaded, and claimed device evidence. Device public-key verification is not configured yet, so any submitted signature claim is treated as unverified and cannot produce PASS.

The API retains an RS256 bearer-token adapter for service integrations, while the browser production path uses the Rauthy OIDC callback and a signed, short-lived session cookie. The default local mode uses synthetic preview headers. Production requires `IDENTITY_MODE=rauthy-session` and never accepts preview credentials.

Once device-key verification is configured, cryptographic signatures can protect the data path. They do not prove that a sensor was calibrated, correctly placed, or physically honest. QA remains a human-controlled decision.

### Modified terms or documents

Controls: versioned policy snapshots, document hashes, append-only audit events, explicit supersession events, and a terms commitment before shipment.

### Replay or duplicate settlement

Controls: one settlement aggregate per purchase order within the current single-receipt workflow, separately tracked authorization/submission/confirmation, idempotent command keys, nonce/signature tracking, contract-level uniqueness, and reconciliation. See [workflow invariants](workflow-invariants.md); timeout is not proof of failure.

### Compromised application signer

Controls: keep operational application keys separate from admin keys; use a managed KMS/HSM or chain-specific key-management adapter for production; use contract pause/emergency controls; require manual approval for high-value or unusual settlements.

### Public-chain leakage

Controls: publish only reviewed opaque IDs, commitments, status, and settlement references. Do not publish raw temperature series, invoices, staff names, branch quantities, or patient-related data. Public token transfers and escrow necessarily expose amounts, addresses, timing, and relationships; do not promise confidential payments.

Use versioned canonical manifests and nonce-protected commitments for low-entropy private fields. Raw hashes are not anonymization. Keep private verification bundles behind authorization and clearly distinguish integrity verification from a claim of physical quality.

### Malicious document uploads

Controls: file-type validation, size limits, antivirus scanning, safe filename normalization, private object storage, no inline execution, short-lived signed downloads, and audit logging. Keep uploads unavailable for ordinary viewing/use as accepted evidence until scanning completes. Never trust a browser Content-Type header alone.

## Authentication and authorization

Use Rauthy as the external identity provider for authentication and the initial identity primitives. The server-side OIDC callback keeps tokens out of browser JavaScript and creates a signed, short-lived HttpOnly Nischit session. Keep application authorization in Nischit because the domain permissions are more specific than an identity provider’s generic roles. See [authentication and Rauthy deployment](authentication.md).

The API must check:

1. user identity is valid;
2. active tenant membership exists;
3. requested action is allowed for the role;
4. the target record belongs to the tenant or is covered by a collaboration grant;
5. the workflow state allows the transition;
6. the action is recorded in the audit timeline.

Use short-lived signed application sessions, secure cookies for the browser, CSRF protection where cookie-based mutations are used, rate limits, and MFA for tenant administrators and QA/finance approvers. Rauthy’s PKCE and refresh-token flow is server-side; the API still checks the session signature, expiry, audience, and tenant membership on every request.

## Audit requirements

Audit events should include:

```text
event_id
tenant_id
actor_id / actor_type
action
resource_type / resource_id
before_hash / after_hash where relevant
request_id
created_at
reason or decision note
```

Audit records are append-only from the product perspective. Corrections create a new event and point to the superseded event; they do not erase history. Administrative reads of sensitive records should also be auditable.

Append-only application permissions do not make a database administrator unable to alter data. External commitments can expose later changes to committed content, but cannot prove omitted events existed. Document retention, export access, backup deletion, legal holds, and the irreversibility of public commitments before customer deployment.

## Nepal deployment considerations

Do not enable real-money digital-asset settlement by default. Before a Nepal deployment, obtain current legal review of the complete payment flow, custody model, contracts, data transfers, and any public-chain publication. A payment provider's license does not automatically authorize every custody or escrow model. Use synthetic data and test-network assets with no monetary value for integration verification.

## Security release gate

Do not approve a production release until the system passes:

- automated tenant-crossing tests;
- authorization tests for every command;
- upload scanning and signed URL tests;
- key rotation and revoked-device tests;
- idempotent retry tests for settlement and webhooks;
- backup restore test;
- audit export review;
- dependency and container scan;
- manual review proving no PHI is in logs, chain payloads, fixtures, or screenshots.
