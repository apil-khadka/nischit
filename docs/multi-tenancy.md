---
title: Multi-tenancy and customization
description: Learn how tenant data stays isolated and how scoped collaboration supports shared workflows.
docType: explanation
---

# Multi-tenancy and customization

## Yes: Nischit is multi-tenant

Each customer receives an isolated tenant. A tenant may represent a private laboratory group, distributor, hospital network, NGO, or future public-sector deployment. A user can belong to more than one tenant, but every request must carry one active tenant context and every business record must be authorized against it.

Authentication answers **who is this user?** Authorization answers **what may this user do?** Tenant isolation answers **which tenant's data can this request touch?** These are separate controls and all three are required.

AWS’s SaaS guidance explicitly distinguishes authentication/authorization from tenant isolation; being logged in does not by itself prevent access to another tenant’s data. PostgreSQL Row-Level Security provides a second database-level defense when policies and connection handling are implemented correctly.

References:

- [AWS multi-tenant authorization guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-api-access-authorization/introduction.html)
- [AWS tenant isolation strategies](https://docs.aws.amazon.com/whitepapers/latest/saas-tenant-isolation-strategies/the-isolation-mindset.html)
- [PostgreSQL row-security policies](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)

## Canonical model

```text
User
  └── Membership ──> Tenant
                       ├── Organization(s)
                       │     └── Site(s)
                       ├── Roles and permissions
                       ├── Products and policies
                       └── Purchase orders / inventory / evidence

Tenant A ── Collaboration Grant ── Tenant B
              (specific order, lot, document, or action)
```

The terms have precise meanings in [domain language](domain-language.md): tenant is the security workspace; organization is a legal/operating party; site is a physical location. One organization may operate more than one tenant in the future, and one user may have memberships in several tenants.

## Isolation strategy

The current implementation uses a shared PostgreSQL database and schema with these mandatory controls:

1. Every tenant-owned table has a non-null `tenant_id`.
2. Every unique constraint and index is reviewed for tenant scope.
3. The API resolves the active tenant from the authenticated membership and explicit request context; it never trusts an arbitrary body field alone.
4. Each database transaction sets transaction-local tenant context; PostgreSQL RLS policies restrict reads and writes. Never retain tenant context across pooled connections.
5. Runtime roles must neither own tables nor have superuser/BYPASSRLS privileges. Use FORCE ROW LEVEL SECURITY where appropriate and a separate migration role; test both read and write policies.
6. Repository methods require a tenant-scoped context; there is no unscoped `findById` for tenant-owned objects.
7. Object-storage keys begin with an opaque tenant identifier and are authorized before every download or signed URL.
8. Background jobs carry tenant, actor/intent, and resource references. Recheck applicable membership/grants and workflow authority at execution; a stale browser token is not job authorization.
9. Cross-tenant access is possible only through a collaboration grant or an explicitly public verification report.
10. Tenant isolation tests run against at least two tenants for every module that reads or writes business records.

RLS is defense in depth, not permission to skip API authorization. A database owner or role with `BYPASSRLS` can bypass policies, so production connections and migrations must be separated deliberately. Foreign keys for tenant-owned relationships should include tenant scope so valid IDs cannot create cross-tenant references. Valkey keys and cached responses must include tenant and relevant authorization scope, with invalidation on permission changes.

## Collaboration without breaking isolation

Suppliers and buyers must collaborate, but this is not a reason to put both into one tenant. Model a collaboration grant containing:

- granting tenant;
- receiving tenant;
- allowed resource type and resource ID;
- allowed domain-specific actions: view selected fields, submit evidence, acknowledge, or respond;
- expiry and revocation time;
- invitation/acceptance state;
- audit events.

For example, a buyer can expose one purchase order and its permitted shipment fields to a supplier. The supplier can submit a lot manifest and documents, but cannot query the buyer’s other inventory, prices, branches, or patient-adjacent data.

A grant does not confer buyer QA or finance approval on the supplier. Keep resource ownership explicit: the buyer owns the PO and acceptance decision, while supplier assertions retain supplier attribution. Expose a constrained shared projection through a dedicated authorized path; do not disable RLS or allow arbitrary tenant switching for collaboration.

## Customization model

Everything that varies by customer should be configuration, but not every behavior should be arbitrary code. Use a versioned configuration hierarchy:

```text
Platform defaults
  → Tenant configuration
    → Site configuration
      → Product/storage profile
        → Purchase-order policy snapshot
          → QA decision referencing the frozen snapshot
```

### Safe customization

Resolve and validate the configuration into a policy snapshot before supplier agreement/funding. Later template edits apply to future orders only. An exception decision records a reason and authority without rewriting the original rules. Safety, recall restrictions, and legal payment modes cannot be bypassed by tenant configuration.

- Logo, name, colors, locale, timezone, units, date format.
- Sites, warehouses, branches, and approval chains.
- Roles and permissions within a fixed permission vocabulary.
- Required documents and certificate types.
- Product storage ranges and shelf-life thresholds.
- Quantity and condition tolerances.
- Exception severity and escalation time.
- Consumption categories and reason codes.
- Notification recipients, channels, and quiet hours.
- Currency display and payment mode within platform-approved jurisdiction/provider capabilities; this does not imply foreign exchange or arbitrary token support.
- Integration mappings for CSV, LIMS, ERP, or supplier identifiers.
- Retention windows within an allowed platform range.

### Not tenant-configurable

- Tenant isolation enforcement.
- Audit event immutability semantics.
- Encryption and key-management baseline.
- Public-chain privacy rules.
- Permission to read patient data; Nischit should not process it.
- Whether a QA decision is required before settlement.
- Contract emergency controls.
- System administrator access logging.

## Roles

Start with a fixed role vocabulary and tenant-scoped permissions:

```text
Tenant Owner
Tenant Administrator
Procurement Manager
Supplier Manager
Receiving Operator
QA Officer
Finance Approver
Auditor / Read-only
```

Allow role sets and custom labels later, but keep the underlying permission keys stable. A tenant may call “QA Officer” “Quality Manager,” but the permission `qa:decisions:approve` should remain machine-stable.

## Tenant-aware test cases

- A user in Tenant A cannot read Tenant B’s purchase order by changing the URL ID.
- A supplier can see only the buyer records covered by an accepted collaboration grant.
- A revoked grant immediately blocks new reads and writes.
- A background settlement retry cannot use a stale tenant context.
- A signed object-storage URL cannot be reused for another tenant’s object.
- A user who belongs to two tenants cannot mix the active tenant in one browser tab with another tab’s request.
- A recall in one tenant cannot quarantine a same-named lot in another tenant.
- A public verification report reveals only intentionally public commitments and status.

Revocation blocks new API access and new download-URL issuance. An already issued presigned URL remains a bearer capability until expiry; short lifetimes bound that exposure. Where immediate download revocation is required, use an authenticated proxy or a separately tested revocation mechanism. Revocation cannot retract data already downloaded.

## Tenant migration and isolation upgrades

Start with shared schema. Preserve a `tenant_id` on every record so a later high-isolation tier can move a tenant to a dedicated schema or database without changing the domain identifiers. Never hard-code the shared-schema assumption into modules.
