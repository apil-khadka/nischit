---
title: Production readiness roadmap
description: Track the stages and evidence required before Nischit can support production operations.
docType: reference
---

# Production readiness roadmap

This roadmap is a prioritization guide, not a delivery commitment. Issues and pull requests should turn each item into a scoped change with an owner, acceptance criteria, and operational impact.

## 1. Close the operational workflow

Complete and validate one tenant-scoped path across the existing modules:

1. Buyer and supplier agree versioned purchase terms before a purchase order proceeds.
2. Suppliers record lots, expiry, shipment details, and private condition evidence.
3. Receiving records delivered quantities and exceptions; stock remains unavailable until an authorized QA decision.
4. Inventory events track receiving, site transfers, opening, consumption, waste, quarantine, and corrections with consistent units and quantity conservation.
5. QA records an attributable decision and reason. Evidence evaluation can inform the decision but cannot replace human authority.
6. Finance reviews settlement state and reconciles external actions. Timeouts and retries must not create duplicate payments.
7. Authorized users can trace the verification record and recall impact without exposing private evidence.

The current implementation boundary and remaining gaps are listed in [implementation status](implementation-status.md). Medical thresholds and sample records are illustrative and must not be used as clinical or product-stability guidance.

## 2. Strengthen production controls

- Exercise the production identity flow with tenant membership provisioning, revocation, and multi-tenant users.
- Complete database migration, runtime-role, tenant-isolation, and concurrent command checks against disposable PostgreSQL instances.
- Verify evidence type detection, malware scanning, private object storage, presigned access, retention, and deletion behavior.
- Add rate limits, bounded resource use, operational metrics, actionable logs, and alerting for API and worker failures.
- Validate backup encryption, off-host storage, restore procedures, schema upgrades, and recovery objectives.
- Review payment and attestation adapters for signer custody, authorization, confirmation, reconciliation, and failure recovery.
- Establish a security review and dependency update process before onboarding production data.

## 3. Validate with operators

Run alongside existing procurement and laboratory systems before taking operational authority. Validate terminology, user roles, evidence requirements, inventory units, exception handling, and reconciliation with the people who perform the work. Record only consented, non-sensitive findings; do not put patient, customer, or supplier-confidential records in this repository.

Measure whether the workflow improves lot/evidence completeness, time to QA, settlement reconciliation time, stock variance, waste/expiry, and recall investigation time. Report measured outcomes separately from goals.

## 4. Expand after evidence

Consider multiple PO lines and receipts, customer system integrations, richer approval policies, notifications, tenant administration, regional deployment, and additional signing or storage options only when operator needs and security reviews support them.

## Explicit boundaries

- Do not collect patient identities, diagnoses, clinical histories, or patient-linked test results.
- Do not treat a sensor signature, hash, or public-chain transaction as proof of physical quality.
- Do not enable real-money payment rails by default.
- Do not represent this repository as a certified clinical, quality-management, or regulatory-compliance system.
- Preserve tenant isolation, human QA authority, inventory conservation, and payment idempotency when adding features.
