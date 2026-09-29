---
title: Nischit workflow UI research
description: Read the research and design rationale behind Nischit's receiving, QA, inventory, and settlement interface.
docType: explanation
---

# Nischit workflow UI research

Updated 29 September 2026.

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
| Queue | Responsive queue rows + `StateMark` + `EmptyState` | One row represents one actionable record; state always has a readable label and restrained semantic color. |
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
| Buyer owner / procurement | Overview | Review prioritized purchase orders; create terms and explicitly grant supplier access from Purchase orders. |
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

The overview is a prioritized needs-attention list, not a fake KPI wall. The current screen shows each loaded, role-scoped record with its reference, item, state, next action, and a control that opens the record inspector. Its queue summary counts those same records by state, and “Up next” opens the first record in queue order. These counts stay hidden until the queue has loaded; an empty queue uses an Empty State.

On narrow screens, queue rows become stacked records and the summary follows the queue. The selected record inspector owns lifecycle and action details. Do not show activity timestamps unless they come from an authorized audit response; the buyer queue cannot assume audit access and must not invent recent events.

Urgent recall or exception banners should appear when the relevant live record is available. Future activity views must use authorized audit data and clearly distinguish recorded events from preview fixtures.

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

Use compact, explicitly labeled state marks with restrained semantic color; color alone never conveys state. Avoid decorative gradients, looping animation, arbitrary KPI panels, and rounded-card walls. Persistent risk uses a Banner, queue rows carry the density, and dividers establish hierarchy. Do not show status or activity data that the active role cannot read.

Use Plus Jakarta Sans for interface text and JetBrains Mono for PO IDs, lot numbers, object IDs, hashes, device IDs, and transaction references. Use Astryx semantic tokens rather than raw hex values in product components. Tenant theming may change approved accent and neutral tokens but may not redefine semantic success, warning, error, or verified colors.

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
