# Nischit domain language

This glossary defines the shared business language for Nischit. It describes the diagnostic-supply workflow without prescribing a programming language or infrastructure.

## Parties and access

**Tenant**:
The security and commercial workspace whose data, configuration, users, and subscription are isolated from other customers.
_Avoid_: account, customer database, organization when isolation is meant.

**Organization**:
A legal or operating entity participating in the workflow, such as a laboratory group, supplier, distributor, or QA provider.
_Avoid_: tenant when the entity is participating in a transaction across workspaces.

**Site**:
A physical operating location belonging to an organization, such as a central store, branch laboratory, or receiving location.
_Avoid_: branch when the location may be a warehouse or other non-branch facility.

**Party**:
An organization or site that has a defined role in a procurement workflow.
_Avoid_: user; a user acts for a party but is not the party.

**Collaboration**:
An explicitly granted, scoped relationship that lets parties exchange selected records without weakening tenant isolation.
_Avoid_: shared tenant, global access.

## Procurement and inventory

**Purchase Order**:
The buyer's versioned request for specified products, quantities, prices, evidence, acceptance rules, and payment terms.
_Avoid_: order when a purchase order is meant.

**Lot**:
A manufacturer/product batch with a lot identifier, expiry, and relevant handling properties. Its stock holdings are tracked separately by tenant, site, container where needed, unit, and status; a lot-number string is not globally unique.
_Avoid_: batch when the product's official identifier is lot.

**Shipment**:
A custody and transport instance carrying one or more lots from a supplier or distributor to a receiving site.
_Avoid_: delivery when the transport record, not just arrival, is meant.

**Goods Receipt**:
The receiving record that confirms what arrived, in what quantity, and with what visible/documentary exceptions. Physical receipt enters pending-QA stock; a linked QA decision records acceptance separately.
_Avoid_: GRN when communicating with non-technical users; GRN is an accepted abbreviation.

**Inventory Event**:
An append-only record of a lot quantity changing balance, location, or status. Transfers and quarantine preserve total stock; consumption and disposal deduct it. Corrections are new events, not edits.
_Avoid_: stock update, mutable inventory balance.

**Consumption Event**:
An inventory event that attributes quantity to patient testing, QC/calibration, training, waste, damage, expiry, or another approved use without requiring patient identity.
_Avoid_: usage when the category of use matters.

## Evidence and quality

**Condition Evidence**:
Data and documents describing how a shipment or lot was handled, including temperature, shock, custody, calibration, and provenance.
_Avoid_: sensor truth; evidence does not prove the physical world was measured perfectly.

**Acceptance Policy**:
The versioned rules attached to a purchase order that define required documents, shelf life, quantity tolerance, storage limits, and exception handling.
_Avoid_: smart-contract rules when the policy is a business rule.

**QA Decision**:
An authorized human decision to accept, accept with adjustment, hold, quarantine, or reject a goods receipt, with evidence and reason.
_Avoid_: automated approval; Nischit assists QA but does not replace it.

**Evidence Commitment**:
A cryptographic commitment to a document, event bundle, or condition report that can be verified later without publishing the private content.
_Avoid_: blockchain proof of quality.

## Settlement and recall

**Settlement**:
The payment consequence of a QA decision, such as release, adjustment, hold, refund, or dispute.
_Avoid_: payment when the decision and reconciliation state are important.

**Recall**:
An instruction to quarantine, stop using, return, or otherwise act on a lot because of a product, quality, safety, or regulatory concern.
_Avoid_: alert; an alert is a communication, while a recall is a controlled business action.

**Quarantine**:
A non-destructive inventory status that blocks use and new settlement authorization for affected goods pending an authorized resolution. It preserves quantity and cannot undo already-submitted or confirmed payments.
_Avoid_: delete, cancel, destroy.

**Verification Report**:
An exportable human-readable record that links the purchase order, evidence commitments, QA decision, inventory history, recall impact, and settlement references.
_Avoid_: block explorer report.

## Correctness reference

See [workflow invariants](workflow-invariants.md) for unit conversion, actual versus estimated usage, post-opening expiry, inventory conservation, decision authority, and payment reconciliation.
