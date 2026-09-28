# Nischit workflow UI research

Updated 18 September 2026.

This document records the product UI decision after reviewing the current Nischit implementation, the Astryx component library, the existing domain state machine, and the laboratory receiving/quality workflow described in the product research.

## Decision

Nischit is an operational application, not a presentation dashboard. The primary interface is a role-aware work queue inside a tenant/site application shell. A user should be able to answer three questions immediately:

1. What requires my decision?
2. What evidence or quantity do I need to review?
3. What state will change when I complete this action?

The UI must not lead with scripted outcomes, invented dashboard metrics, or a generic blockchain visualization. Test fixtures may use prepared synthetic records, but the product surface must behave like an operational workspace and distinguish recorded state from live integrations.

## Astryx findings

Astryx currently presents itself as an open, customizable React 19+ design system built on StyleX. Its component catalogue includes the exact structural primitives Nischit needs: App Shell, Top Nav, Side Nav, Table, Stepper, Banner, Card, Badge, Empty State, Form Layout, Field, Selector, Number Input, File Input, Dialog, Metadata List, and Code.

Nischit will use those primitives before adding product-specific markup:

| Need | Astryx composition | Nischit rule |
| --- | --- | --- |
| Workspace frame | `AppShell` + `TopNav` + `SideNav` | Navigation is persistent and names work areas in the operator's language. |
| Queue | `Table` + `StatusDot` + `EmptyState` | One row represents one actionable record; status is a dot plus explicit text, never a pill. |
| Shipment acceptance | `Stepper` + `Banner` + `MetadataList` | Keep the current decision and its evidence in the same reading path. |
| Forms | `FormLayout` + `Field` + typed inputs | One primary action per screen; validation is inline and specific. |
| Evidence | `Card` + `FileInput` + `Dialog` + `Code` | Private object references stay private; hashes are identifiers, not decoration. |
| Recall | `Banner` + `Table` + `Stepper` | Affected locations and remaining quantities are first-class records. |
| Verification | `Heading` + `MetadataList` + `Table` + `Link` | Public view is read-only and omits private documents and patient data. |

The source of truth remains the Butter theme CSS already loaded by the Next.js layout. The app should wrap the component tree in Astryx's `Theme` provider with the Butter theme rather than recreating component styling locally.

## Role and route model

The browser surface should expose these role-scoped work areas. Authorization remains server-side; the UI only renders actions returned by the API and must not treat hidden controls as a security boundary.

| Role | Default work area | Primary decision |
| --- | --- | --- |
| Buyer owner / procurement | Purchase orders | Create terms and explicitly grant supplier access. |
| Supplier | Supplier inbox | Acknowledge terms, prepare shipment, attach evidence. |
| Receiving | Receiving queue | Confirm quantity, lot, site, and physical receipt. |
| QA | Review queue | Accept, adjust, hold, or reject with a reason and evidence. |
| Finance | Settlement queue | Fund, settle, or hold according to the recorded QA outcome. |
| Auditor / public verifier | Audit or public receipt | Read the chain of custody without mutation rights or private files. |

The top-level navigation is therefore:

```text
Nischit / tenant / site / signed-in user
├── Overview          (my pending decisions)
├── Purchase orders   (buyer and supplier views are scoped differently)
├── Receiving         (physical receipt queue)
├── QA review         (evidence and exception decisions)
├── Inventory         (lots, usage, transfers, quarantine)
├── Settlement        (funding, adjustment, confirmation)
├── Audit             (tenant audit and outbox health)
└── Settings          (sites, usage reason codes, tenant branding)
```

## Core workflow screens

### Overview

The overview is a prioritized needs-attention list, not a fake KPI wall. It contains an urgent exception/recall banner when one exists, the next three pending decisions for the current role, a compact lifecycle strip for a selected purchase order, and a small recent activity list sourced from audit events.

If there is no work, use an Astryx Empty State that explains how the current role receives work. Do not invent counts.

### Purchase order detail

The purchase order page is the shared record across organizations. It shows the commercial terms, acceptance policy, collaboration grants, current state, and the next allowed action for the current user. Supplier users see only records that have an active grant; buyer users see records owned by their tenant.

The page uses a horizontal Stepper for `Draft → Acknowledged → Funded → In transit → Received → Closed`, with evidence and settlement panels beneath it. It should never reveal a buyer's private audit or raw evidence object to a supplier.

Buyer creation is a two-step deliberate action: create the commercial record, then grant the supplier tenant access. The UI must not silently share a purchase order merely because the supplier was selected.

### Receiving

Receiving is touch-oriented. The operator selects a shipment, confirms quantity and destination site, sees the recorded lot/expiry, and submits one receipt. The screen should not ask a receiver to make a QA decision. After submission it clearly states that QA is now the next owner.

### QA review

QA is an evidence review, not a table of undifferentiated events. The first viewport shows required documents and their source (`uploaded`, `device`, or `manual`), temperature summary and excursion intervals, hash-chain/signature coverage indicators with text labels, received versus accepted/rejected quantity, and the decision form with reason and optional supplier adjustment.

The primary action changes with the evidence state: `Accept`, `Accept with adjustment`, `Hold`, or `Reject`. A reason is mandatory for non-pass outcomes and adjustment.

### Settlement

Finance sees the QA decision, the exact integer split, and the payment rail status. The page makes the dependency explicit: funds cannot settle through the normal path until an authorized QA decision exists. Chain references are secondary metadata and link to an explorer only when a real testnet adapter produced them.

### Public verification

The public page is a separate read-only route. It has a plain-language summary, commitment hashes, payment status, and public chain references. It never contains tenant-private object IDs, raw telemetry, patient information, or internal audit events.

## Visual direction

The visual direction is a calm laboratory console: bright Butter foundation, quiet surfaces, clear blue action, and restrained status color. The 60–30–10 rule is applied as composition: 60% warm Butter body/surface tokens, 30% muted section and semantic surfaces, and 10% blue interaction and verification emphasis.

No pill-shaped status system, no decorative gradients, no looping animation, no dashboard-shaped collection of four arbitrary statistics, and no rounded-card wall. Nischit uses `StatusDot` plus explicit text for state; persistent risk uses a Banner; tables carry the density; dividers establish hierarchy. Astryx badges remain available for future non-state metadata, but are not part of the primary workflow language.

Use Outfit for operational text and JetBrains Mono only for PO IDs, lot numbers, object IDs, hashes, device IDs, and transaction references. Use Astryx semantic tokens rather than raw hex values in product components. Tenant theming may change approved accent and neutral tokens but may not redefine semantic success, warning, error, or verified colors.

## Implementation gates

- The product shell renders through Astryx `Theme`, `AppShell`, `TopNav`, and `SideNav`.
- Each role's queue calls a role-scoped API read model; no role selector creates extra authority.
- All mutation controls are backed by the existing API command and have pending, success, and error states.
- Browser tests open role-specific screens and verify that a supplier cannot see an ungranted order, a receiver cannot approve QA, and a public verifier cannot see private evidence.
- Example scenarios belong in isolated test fixtures and must not be presented as live customer activity.

## References

- [Astryx design system](https://astryx.atmeta.com/)
- [Astryx component catalogue](https://astryx.atmeta.com/components)
- [Nischit design tokens and theme foundation](design-system.md)
- [Nischit workflow invariants](workflow-invariants.md)
- [Production readiness and implementation status](implementation-status.md)
- [Production readiness roadmap](roadmap.md)
