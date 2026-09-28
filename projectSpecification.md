# Nischit

## Reagent Acceptance, Usage Traceability, and Settlement for Diagnostic Laboratories

> This specification describes intended product behavior; it does not claim every capability is implemented or production-ready. Accepted decisions live in [`docs/README.md`](docs/README.md); [`docs/roadmap.md`](docs/roadmap.md) defines current priorities and [`docs/workflow-invariants.md`](docs/workflow-invariants.md) defines correctness rules. These take precedence over illustrative schemas and future options below. Examples are synthetic and not clinically validated.

**Status:** Working product specification
**Public brand:** Nischit
**Chain roles:** Optional Tempo payment integration; optional Solana evidence/receipt publication; no asset bridge
**Product category:** B2B procurement / healthcare supply chain / payments / IoT
**Initial vertical:** In-vitro diagnostic reagents and laboratory consumables
**Initial users:** Diagnostic laboratories, reagent distributors, procurement teams and quality-assurance teams

---

# 1. Executive Summary

Nischit is a multi-tenant reagent acceptance and usage platform for diagnostic laboratories buying condition-sensitive reagents and test kits. It links procurement to QA, supplier settlement, actual lot-level consumption, and recorded recall impact without collecting patient data.

Laboratory procurement currently involves several disconnected records:

* Purchase Order
* Supplier invoice
* Product batch/lot
* Expiry date
* Certificate of Analysis
* Shipment documents
* Temperature records
* Delivery receipt
* Goods Receipt Note
* Quality-assurance decision
* Vendor payment
* Recall notices

Nischit connects these records into one verifiable procurement transaction.

The core workflow is:

**Agreed PO → Supplier Lot Declaration → Shipment Evidence → Physical Receipt → QA Decision → Accepted Stock + Authorized Settlement → Usage → Recall Impact**

The system lets a buyer define acceptance requirements before goods are shipped. Examples include:

* correct product and quantity;
* minimum remaining shelf life;
* required certificates;
* authorized supplier;
* manufacturer-prescribed storage conditions;
* valid shipment-condition evidence;
* intact seal;
* delivery before a deadline.

When the shipment arrives, Nischit evaluates the evidence against those requirements.

A compliant shipment becomes eligible for acceptance and payment.

A shipment with an exception is routed to QA rather than being automatically rejected.

A rejected shipment keeps settlement funds locked until the dispute is resolved.

The blockchain is **not used to pretend that blockchain can determine whether a physical temperature reading is true**. Instead, it provides a neutral and immutable record of:

1. what commercial conditions were agreed;
2. what evidence was submitted;
3. what receiving/QA decision was made;
4. what payment consequence followed.

---

# 2. Problem Definition

Diagnostic reagents are unusually sensitive procurement items.

Depending on the product, manufacturers may specify refrigeration, frozen storage, humidity limits, minimum shelf life, handling requirements or other conditions.

WHO procurement guidance notes that laboratory IVD reagents can have narrow temperature tolerances and may require transport at approximately 2–8°C or even substantially colder temperatures depending on the reagent. It also stresses clear responsibility when cold-chain failures cause product loss.

Yet the commercial process and the quality process are often disconnected.

A typical real-world sequence is:

Supplier sends invoice.

Logistics company sends goods.

Receiving staff count boxes.

Procurement creates the GRN.

Accounts processes the payment.

Separately, somebody may have:

* an Excel temperature log;
* a data logger;
* a paper delivery sheet;
* an email containing a Certificate of Analysis;
* a QA complaint;
* or no complete condition history at all.

The payment system generally does not understand any of these things.

Therefore disputes become difficult:

**Was this the correct lot?**

**Did it arrive with enough shelf life?**

**Was the cold chain breached?**

**Who had custody when the excursion occurred?**

**Did QA approve an exception?**

**Why was this invoice paid?**

**Which branches received a recalled lot?**

Nischit gives these questions a shared answer.

---

# 3. Product Thesis

Nischit is based on one principle:

> **Payment for regulated or condition-sensitive goods should be tied to verifiable acceptance of those goods.**

The application turns procurement conditions into machine-readable rules.

The blockchain turns the final commercial decision into a tamper-evident shared settlement record.

The system does **not** replace:

* laboratory information systems;
* ERP systems;
* accounting systems;
* manufacturers;
* validated temperature loggers;
* QA personnel;
* regulatory authorities.

Instead, Nischit sits between procurement, receiving, quality assurance and payment.

---

# 4. Differentiation

## 4.1 April Gate

April Gate already targets pharmaceutical cold-chain disputes.

Its architecture emphasizes:

**secure hardware → sensor consensus → immutable cold-chain proof → insurer/logistics dispute evidence**

April Gate publicly describes pharmaceutical cargo insurers and logistics operators as its target customers and uses Solana to anchor hardware-signed cold-chain records.

Nischit therefore should **not** compete on:

“we prove that the refrigerator remained cold.”

Nischit competes on:

**“we decide what happens to a procurement transaction after all of the evidence is considered.”**

Our core object is a **purchase transaction**.

April Gate's core object is effectively a **shipment proof**.

---

## 4.2 Generic pharmaceutical traceability

Many blockchain projects already register pharmaceutical batches and allow users to verify origin.

Nischit is not primarily an anti-counterfeiting system.

Authenticity may become one acceptance criterion, but the product focuses on:

**commercial acceptance + QA exceptions + settlement + recall traceability.**

---

## 4.3 Traditional ERP/LIMS

ERP software understands:

PO → invoice → GRN → payment.

A LIMS understands laboratory activity.

Neither inherently provides a neutral settlement layer shared between buyer, supplier and other independent parties.

Nischit adds:

**condition-aware acceptance + signed evidence + cross-party auditability + programmable settlement.**

---

# 5. Primary User

The first customer should be a diagnostic laboratory or laboratory network that:

* purchases significant amounts of reagents;
* works with multiple vendors;
* operates multiple branches;
* handles cold-chain or shelf-life-sensitive material;
* needs lot and expiry tracking;
* occasionally encounters delivery or invoice disputes.

The application should work even if the supplier does not use cryptocurrency.

The blockchain should remain almost invisible to normal users.

---

# 6. User Roles

## Procurement Manager

Creates purchase orders.

Defines commercial acceptance requirements.

Reviews vendor performance.

Tracks pending deliveries and settlement.

## Supplier

Receives PO.

Declares product, lot, expiry and shipment information.

Uploads required documents.

Initiates delivery.

Receives settlement.

## Receiving Staff

Scans incoming shipment.

Checks product, quantity, lot, expiry and seal.

Records delivery.

Creates the digital receiving event.

## QA Officer

Reviews condition exceptions.

Accepts, conditionally accepts or rejects questionable shipments.

Records reasoning and supporting documents.

## Finance

Reviews payable amount.

Sees whether conditions have been satisfied.

Tracks released, held, disputed and refunded transactions.

## Administrator/Auditor

Manages organizations, users and approved devices.

Inspects append-only audit trails and externally committed evidence.

Exports transaction evidence.

---

# 7. Core Product Objects

Nischit includes the following procurement objects, plus the inventory and recall records needed after receipt.

| Object            | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| Purchase Order    | Commercial agreement between lab and supplier      |
| Acceptance Policy | Rules determining whether delivery can be accepted |
| Shipment          | Physical movement associated with the PO           |
| Lot               | Manufacturer batch/lot and expiry information      |
| Condition Record  | Temperature/handling evidence                      |
| Goods Receipt     | Laboratory acknowledgement of physical receipt     |
| Settlement        | Funds reserved/released/refunded for the order     |
| Stock Holding     | Quantity by tenant, site, lot, unit, and status    |
| Inventory Event   | Receipt, transfer, opening, use, waste, correction |
| Recall            | Scoped lot impact and quarantine action           |

Use tenant-scoped IDs and explicit relationships. A lot can appear in multiple purchase orders; inventory events reference the relevant lot/holding and originating receipt rather than assuming everything belongs to one order.

---

# 8. Purchase Order Specification

A purchase order contains:

```text
orderId
buyerOrganization
supplierOrganization
currency
totalAmount
paymentToken
createdAt
deliveryDeadline
status
```

Each PO contains one or more line items:

```text
productId
manufacturer
catalogNumber
description
orderedQuantity
unit
unitPrice
minimumShelfLifeDays
requiredStorageProfile
requiredDocuments
```

The complete PO document is stored off-chain.

A cryptographic hash of the canonical PO is committed to the settlement contract.

Therefore neither party can quietly modify PO terms after escrow funding.

---

# 9. Acceptance Policy

Each PO contains an explicit acceptance policy.

Example:

```text
Product:
HbA1c Reagent Kit

Quantity:
20 kits

Minimum remaining shelf life:
180 days

Temperature:
2°C – 8°C

Allowed excursion:
Manufacturer profile

Required documents:
- Invoice
- Certificate of Analysis
- Delivery Note

Lot declaration:
Required

Seal verification:
Required

Condition evidence:
Required

QA review:
Required before every acceptance/payment authorization; exceptions need a reason
```

Policies should be configurable per product rather than applying one global temperature rule.

This is important.

A reading above 8°C does **not automatically mean a reagent is unusable**.

The actual decision depends on manufacturer stability specifications, excursion duration, product type and QA judgment.

WHO guidance similarly recommends reporting storage-condition breaches for QA follow-up rather than blindly treating every breach as identical.

---

# 10. End-to-End Workflow

## Stage 1 — PO Creation

Buyer creates PO.

Nischit canonicalizes the PO and computes:

```text
termsHash = SHA256(domainSeparator || version || nonce || canonicalPurchaseOrder)
```

The supplier acknowledges the same versioned terms before funding. The nonce and canonical manifest are retained in the private verification bundle.

Buyer chooses:

**Create settlement**

Funds are deposited into the Nischit settlement contract.

Blockchain state becomes:

```text
FUNDED
```

---

## Stage 2 — Supplier Confirmation

Supplier confirms shipment details against the already acknowledged PO version.

Supplier declares:

```text
manufacturer
catalogNumber
lotNumber
manufacturingDate
expiryDate
quantity
invoiceNumber
shipmentId
```

Supplier uploads:

* invoice;
* Certificate of Analysis;
* shipment documents;
* other required certifications.

Documents remain off-chain.

Their hashes are attached to the shipment manifest.

Supplier signs the manifest.

---

## Stage 3 — Shipment Creation

Shipment enters:

```text
READY_FOR_DISPATCH
```

A QR code is generated.

QR represents:

```text
https://<configured-app-host>/shipments/{opaqueShipmentId}
```

The QR contains a locator, not access credentials; authentication and tenant authorization still apply. No native app is required.

Optional sensor device is assigned.

Shipment changes to:

```text
IN_TRANSIT
```

---

# 11. Condition Monitoring

Nischit supports three levels of condition evidence.

## Level A — Manual

User uploads a logger report or temperature certificate.

Useful for organizations with existing cold-chain equipment.

## Level B — Integrated Logger

A compatible IoT logger sends signed measurements to Nischit.

## Level C — Reference Logger Integration

Optional future hardware integration; the current implementation uses a signed simulator:

```text
ESP32
+
temperature sensor
+
Wi-Fi
```

The simulator exercises the evidence protocol.

It must **not** be marketed as validated pharmaceutical monitoring hardware.

Production deployments should integrate validated loggers and secure hardware.

---

# 12. Sensor Event Format

Each reading uses:

```json
{
  "deviceId": "DEV-0019",
  "shipmentId": "SHIP-20392",
  "sequence": 411,
  "timestamp": 1789817400,
  "temperature": 4.21,
  "humidity": 51.2,
  "battery": 81,
  "previousHash": "...",
  "signature": "..."
}
```

The device signs the canonical payload.

Each event includes the previous reading's hash.

This creates:

```text
reading 1
   ↓ hash
reading 2
   ↓ hash
reading 3
   ↓ hash
reading 4
```

Sequence and hash checks detect gaps or reordering within the received chain. An entirely withheld tail requires expected coverage or an independent closing checkpoint to detect; signatures alone do not prove completeness.

The chain does **not** prove that the physical sensor itself was honest.

It proves that the submitted digital record has not subsequently been altered.

---

# 13. Condition Aggregation

Thousands of sensor readings should not be written individually to blockchain.

The backend calculates:

```text
telemetryMerkleRoot
```

and creates a condition report:

```text
shipmentId
readingCount
firstReadingAt
lastReadingAt
minimumTemperature
maximumTemperature
averageTemperature
excursionCount
longestExcursionSeconds
missingSequenceCount
telemetryMerkleRoot
conditionStatus
```

Possible condition states:

```text
PASS

EXCEPTION

INSUFFICIENT_EVIDENCE
```

The report itself remains off-chain.

The report hash is committed to the settlement transaction.

---

# 14. Receiving Workflow

Receiving staff scan the shipment QR.

Application displays:

```text
PO #PO-2026-0912

Supplier
ABC Diagnostics

Product
HbA1c Reagent Kit

Expected quantity
20

Declared lot
HBA09183

Expiry
2027-08-31

Condition
PASS
```

Receiver manually verifies:

```text
Quantity
Lot
Expiry
Seal
Packaging
Documents
```

Receiver signs the goods receipt.

---

# 15. Acceptance Engine

The rules engine evaluates:

```text
product match
quantity match
lot declared
minimum shelf life
required documents
condition evidence
seal state
delivery deadline
authorized supplier
```

The output is:

### PASS

All hard rules satisfied.

Shipment can be accepted normally.

### EXCEPTION

One or more requirements require QA decision.

Examples:

```text
temperature excursion
short shelf life
damaged packaging
late delivery
quantity mismatch
missing certificate
```

### FAIL

Commercially invalid delivery.

Examples may include:

```text
wrong product
unrecognized supplier
explicit QA rejection
```

FAIL does not automatically transfer money.

---

# 16. QA Exception Workflow

Suppose a shipment briefly reaches:

```text
9.4°C
```

The application shows:

```text
CONDITION EXCEPTION

Expected:
2°C – 8°C

Maximum observed:
9.4°C

Excursion duration:
11 minutes

Evidence:
843 signed measurements

Settlement:
HELD
```

QA receives three actions:

```text
ACCEPT

ACCEPT WITH ADJUSTMENT

REJECT
```

QA must provide a reason.

Supporting evidence may include:

* manufacturer excursion guidance;
* supplier response;
* internal QC;
* product stability documentation.

The QA decision is hashed and attached to the settlement.

---

# 17. Goods Receipt Note

Create a goods receipt when goods physically arrive and hold stock pending QA. Append the QA acceptance/rejection decision to that receipt; never overwrite the original receiving evidence.

GRN contains:

```text
grnId
purchaseOrderId
shipmentId
receivedQuantity
acceptedQuantity
rejectedQuantity
lot
expiry
receivedBy
receivedAt
qaDecision
conditionReportHash
documentBundleHash
```

The laboratory signs the GRN.

The committed receipt plus authorized QA decision records what arrived and what was accepted. A receiving signature alone is not QA acceptance.

---

# 18. Settlement

The initial settlement design uses a Tempo smart contract, subject to deployment-specific contract, custody, and network review.

Tempo is EVM-compatible and is explicitly optimized for stablecoin payments. It supports payment-focused features including fee sponsorship and indexed transfer memos.

For isolated integration testing, settlement can use a supported Tempo test token such as testnet `pathUSD`; this does not move or represent commercial funds.

Users should not need to understand gas.

Nischit sponsors user transaction fees. Tempo supports native-style fee sponsorship for this purpose.

---

# 19. Smart Contract

Working contract name:

```text
ProcurementEscrow.sol
```

Illustrative structure, not a complete or audited contract. Implement the authority, amount conservation, replay protection, refund/timeouts, and confirmation rules in [workflow invariants](docs/workflow-invariants.md) before deployment:

```solidity
struct Order {
    bytes32 orderId;
    address buyer;
    address supplier;
    address paymentToken;
    uint256 amount;
    bytes32 termsHash;
    bytes32 conditionHash;
    bytes32 grnHash;
    uint64 createdAt;
    OrderStatus status;
}
```

Illustrative business states (keep QA, payment authorization, transaction confirmation, and Solana publication separate in implementation):

```text
CREATED
FUNDED
DELIVERY_RECORDED
EXCEPTION
ACCEPTED
DISPUTED
SETTLED
REFUNDED
CANCELLED
```

Major contract operations:

```text
createOrder()

fundOrder()

submitConditionCommitment()

recordAcceptance()

openDispute()

resolveDispute()

releasePayment()

refundBuyer()
```

---

# 20. Contract Authorization

Only buyer can:

```text
create order
accept delivery
open buyer dispute
```

Only designated supplier can:

```text
acknowledge order
receive settlement
```

Only authorized Nischit verifier can submit:

```text
conditionReportHash
```

QA decision itself remains part of buyer-side organizational approval.

A later decentralized architecture can replace the single verifier with multiple trusted attestors.

That should remain deferred until the trust model, signer governance, recovery behavior, and operational responsibilities are designed and reviewed.

---

# 21. Payment Memo

Tempo supports payment transfer memos.

Every settlement should contain something similar to:

```text
opaqueSettlementReference
```

Map the opaque reference to the PO inside authorized application records. Do not leak business PO numbers or supplier terms in public memos.

The blockchain payment can therefore be mapped directly to:

```text
Purchase Order
→ GRN
→ Invoice
→ Payment
```

without searching wallet history manually.

---

# 22. Dispute Handling

A blockchain cannot resolve whether damaged packaging is acceptable.

Therefore Nischit does not attempt fully autonomous arbitration.

A dispute contains:

```text
disputeId
orderId
initiatedBy
reasonCode
reasonText
evidenceBundleHash
createdAt
status
```

Settlement stays locked.

A resolver whose authority was agreed by the parties resolves the dispute. QA rejection alone does not authorize a refund or arbitrary split. The contract's signers, timeouts, and refund rights must be defined and tested before deployment; a full dispute-management product is outside the current release scope.

Possible resolutions:

```text
100% supplier

100% buyer

split settlement
```

For the initial release:

```text
supplierPercentageBps
buyerPercentageBps
```

must total:

```text
10,000
```

This allows scenarios such as:

```text
95% supplier
5% buyer credit
```

without redesigning the contract.

---

# 23. Recall Management

Recall tracing is a key secondary feature.

A recall references:

```text
manufacturer
product
lot
recallReference
severity
reason
effectiveDate
```

Nischit searches every shipment and GRN involving that lot.

Result:

```text
LOT HBA09183

Kathmandu
Received: 20
Remaining: 4

Lalitpur
Received: 10
Remaining: 3

Butwal
Received: 15
Remaining: 8
```

The initial release includes a usage ledger and reports recorded remaining, consumed, and wasted stock with the last reconciliation time. Receipt-only data must be labelled incomplete; do not imply a physical count or patient-level recall.

Lot-level tracing has obvious practical value: FDA recall records continue to identify IVD reagents using specific affected lot numbers. For example, an August 2026 FDA Class II recall identified specific lots of an AKI reagent kit and required consignees to coordinate replacement or destruction.

---

# 24. Recall Alerts

When a recalled lot exists in the system:

```text
RECALL ALERT
```

Affected branches receive notification.

Receiving and procurement screens display:

```text
BLOCKED LOT
```

Block new use and new settlement authorization pending a valid recall/QA resolution. A discount cannot override an unresolved safety recall; neither quarantine nor recall can undo an already-submitted or confirmed payment.

---

# 25. System Architecture

Use a TypeScript modular monolith: Next.js/Astryx web, NestJS/Fastify API, and a separate worker sharing domain modules. PostgreSQL owns operational data and the durable outbox; Valkey holds disposable caches/rate limits. Private files use RustFS locally and Cloudflare R2 in production.

The worker calls Tempo and Solana through separate adapters. Only the TLS reverse proxy is public on the VPS. The authoritative topology and security boundaries are in [architecture](docs/architecture.md) and [deployment](docs/deployment.md).

---

# 26. Technology Stack

- Web: TypeScript, React/Next.js, Astryx Butter, StyleX, mobile browser receiving.
- API/worker: TypeScript, NestJS/Fastify, Zod, Drizzle and explicit SQL migrations.
- Data: PostgreSQL with RLS and transactional outbox; Valkey for disposable state.
- Files: S3-compatible adapter, RustFS locally, Cloudflare R2 in production.
- Chains: Solidity/Foundry/viem for Tempo; Solana Kit for receipt publication.
- Packaging: versioned Docker images and local/production Compose definitions on a small VPS.
- Evidence: HTTPS signed logger simulator first. Real loggers, MQTT, and ESP32/secure-element hardware are later integration work.

See [selected stack](docs/tech-stack.md) and [implementation status](docs/implementation-status.md). The TypeScript/Astryx/API/worker/storage stack, normalized persistence, configurable identity seam, condition aggregation metrics, inventory transfer/quarantine controls, and configurable chain adapters are implemented; key rotation, live network execution, and production-grade evidence and operations remain explicit gates.

---

# 27. Database Model

Main tables:

```text
tenants
organizations
sites
users
memberships
collaboration_grants
tenant_config_versions
suppliers

products
storage_profiles

purchase_orders
purchase_order_items
acceptance_policy_snapshots
supplier_acknowledgements

shipments
shipment_items
lots

devices
device_assignments
telemetry_readings
condition_reports

documents

goods_receipts
goods_receipt_items
qa_decisions

stock_holdings
inventory_events
container_openings
transfers

settlements
settlement_intents
blockchain_transactions
attestation_publications
outbox_events
jobs

disputes

recalls
recall_impacts

audit_events
```

---

# 28. Important Relationships

```text
PurchaseOrder
  └── PurchaseOrderItems

PurchaseOrder
  └── Shipment
        ├── ShipmentItems
        │      └── Lot
        │
        ├── DeviceAssignment
        │      └── Telemetry
        │
        └── ConditionReport

Shipment
  └── GoodsReceipt
        └── QADecision

PurchaseOrder
  └── Settlement
```

---

# 29. API Design

Illustrative endpoint inventory, not a complete API contract. All commands require tenant/resource authorization, input validation, allowed-state checks, and idempotency. Inventory, transfer, opening, and usage commands belong in the initial release. Public identifiers never grant access by themselves. Exact routes and schemas require a formal OpenAPI contract.

## Procurement

```text
POST /api/orders
GET  /api/orders
GET  /api/orders/{orderId}
POST /api/orders/{orderId}/fund
POST /api/orders/{orderId}/cancel
```

## Supplier

```text
POST /api/orders/{orderId}/acknowledge
POST /api/orders/{orderId}/shipments
POST /api/shipments/{shipmentId}/documents
POST /api/shipments/{shipmentId}/dispatch
```

## Telemetry

```text
POST /api/telemetry/readings
GET  /api/shipments/{shipmentId}/telemetry
GET  /api/shipments/{shipmentId}/condition
```

## Receiving

```text
POST /api/shipments/{shipmentId}/receive
POST /api/receipts/{receiptId}/confirm
POST /api/inventory/transfers
POST /api/inventory/quarantine
POST /api/recalls/{recallId}/release
```

## QA

```text
GET  /api/qa/exceptions
POST /api/qa/{receiptId}/decision
```

## Settlement

```text
GET  /api/settlements/{orderId}
POST /api/settlements/{orderId}/release
POST /api/settlements/{orderId}/dispute
POST /api/disputes/{disputeId}/resolve
```

## Recall

```text
POST /api/recalls
GET  /api/recalls/{recallId}/impact
GET  /api/lots/{lotId}/locations
```

---

# 30. Authentication

Normal users should **not log in using crypto wallets**.

Use:

```text
email/password or OAuth
+
organization membership
+
role-based permissions
```

Blockchain accounts can be abstracted behind application-managed/passkey-backed accounts.

User experience should feel like ordinary enterprise software.

The blockchain should appear primarily in:

```text
Verified record
Transaction ID
Settlement reference
```

---

# 31. Frontend Screens

## Dashboard

Show:

```text
Open POs
Shipments in transit
Receiving today
Condition exceptions
Payments on hold
Pending QA review
Active recalls
```

## Purchase Order Screen

Full PO and acceptance policy.

## Shipment Screen

Timeline:

```text
Order created
Supplier acknowledged
Shipment dispatched
Condition monitoring
Arrived
Received
QA
Settled
```

## Condition Screen

Graph:

```text
temperature vs time
```

with excursion regions highlighted.

## Receiving Screen

Mobile-friendly QR workflow.

## QA Exception Queue

Shows all shipments requiring manual decision.

## Settlement Screen

Shows:

```text
amount
escrow status
condition decision
GRN
blockchain transaction
```

## Recall Console

Search lot and show all affected receiving sites.

---

# 32. Audit Timeline

Each procurement transaction should render a human-readable audit history.

Example:

```text
09:12   PO created
09:14   Supplier acknowledged versioned PO
10:31   Settlement funding confirmed
14:20   Lot HBA09183 assigned
16:01   Shipment dispatched

Next day

08:42   Temperature exception detected
11:04   Shipment delivered
11:12   Receiver verified lot
11:16   QA review requested
12:01   QA accepted shipment
12:03   GRN created
12:04   $1,200 settlement released
```

The user should understand the full transaction without opening a block explorer.

---

# 33. Cryptographic Evidence Bundle

For each completed procurement, create:

```text
orderHash
supplierManifestHash
documentBundleHash
telemetryMerkleRoot
conditionReportHash
goodsReceiptHash
qaDecisionHash
paymentTransactionHash
```

Exportable as:

```text
Nischit Verification Report
```

An authorized holder of the original documents and versioned verification manifest (including commitment nonces) can verify content matches. The report must identify signer trust and chain confirmation status; matching hashes do not establish physical quality.

---

# 34. Privacy

Do not put these directly on a public blockchain:

```text
supplier invoices
confidential invoices and unit-price terms
temperature history
internal comments
documents
employee names
branch inventory
Certificates of Analysis
```

Blockchain should contain reviewed opaque references, commitments, addresses, state and settlement information only. Escrow and token-transfer amounts, wallet addresses, and timing are public; do not promise confidential payments.

No patient records belong anywhere in Nischit.

Nischit has no reason to process:

```text
patient identity
test result
diagnosis
clinical history
```

---

# 35. Threat Model

## Fake sensor data

Mitigation:

signed device messages and production secure-element support.

Limitation:

cryptography cannot prove that a physically compromised sensor measured reality correctly.

## Deleted readings

Mitigation:

sequence numbers + chained hashes.

## Replayed readings

Mitigation:

device ID + shipment ID + sequence + timestamp.

## Modified PO

Mitigation:

terms hash committed before shipment.

## Modified documents

Mitigation:

document hash bundle.

## Fake GRN

Mitigation:

role-controlled organizational signature.

## Compromised verifier

Initial release:

single verifier signer.

Production:

multi-attestation/oracle model.

## Blockchain data leakage

Mitigation:

store only commitments and settlement data.

---

# 36. What Blockchain Actually Solves

Nischit should be able to answer this question clearly during judging.

Without blockchain, the buyer could control:

```text
PO database
condition decision
GRN
payment database
```

and the supplier would simply have to trust that record.

Alternatively, the supplier might control shipment evidence.

Nischit creates a shared settlement state that neither organization can quietly rewrite after settlement.

Blockchain is used for:

```text
agreed terms commitment
evidence commitment
acceptance commitment
settlement
dispute state
audit timestamp
```

It is **not** used as a replacement for PostgreSQL.

---

# 37. Why Tempo

Tempo fits Nischit because the product ends in real-world B2B payment.

Tempo is EVM-compatible, allowing standard Solidity/Foundry development, while being designed specifically around stablecoin payments.

Useful Tempo features include:

```text
stablecoin-oriented transactions
payment memos
gas sponsorship
batching
programmable smart contracts
USD-denominated payment design
```

For Nischit specifically:

```text
PO
   ↓
stablecoin escrow
   ↓
condition + GRN
   ↓
supplier settlement
```

is more strategically coherent than writing thousands of sensor readings to a general-purpose blockchain.

---

# 38. Chain Strategy

Use Tempo testnet for conditional settlement and Solana devnet for a compact evidence/decision receipt with a confirmed Tempo transaction reference. Keep PaymentRail and PublicAttestationRail interfaces independent; no bridge or atomic cross-chain dependency.

A failed Solana publication is retried without repeating a payment. A signed memo proves an assertion was published by the signer; it does not trustlessly verify Tempo or enforce the buyer's QA rules. A custom Solana program is conditional on the required verification semantics, not a default extra language.

---

# 39. Initial Release Scope

The authoritative scope and tests are in [the roadmap](docs/roadmap.md). In brief: two tenants, one buyer/supplier relationship, one product/lot/receipt per PO, agreed acceptance policy, private documents, simulated signed condition evidence, authorized receiving/QA, a small usage/transfer/quarantine ledger, testnet settlement, Solana receipt, and a compact verification/recall view.

No automatic QA approval on the clean path. Opening and consumption must use consistent units and cannot double-deduct stock. Supplier approval of a commercial adjustment is distinct from buyer QA acceptance.

The schema supports later growth, but product materials must not promise a full ERP, unrestricted customization, multiple settlement tranches, or clinical/payment readiness that has not been independently established.

---

# 40. Deferred Product Scope

Do not build:

```text
complete ERP
complete inventory system
complete LIMS
manufacturer blockchain
NFTs
tokens
DAO governance
cross-chain bridge
AI procurement assistant
supplier marketplace
insurance platform
zero-knowledge proofs
decentralized oracle network
custom hardware PCB
mobile native app
full accounting package
patient records
```

These features add substantial product, security, and operational scope and remain deferred until validated needs justify them.

---

# 41. Example Operational Scenario

This example describes an exception-and-resolution workflow with usage and recall. The clean shipment below is an optional comparison fixture. All values are synthetic and are not stability guidance.

## Shipment A — Compliant

Create:

```text
PO #PB-1001
20 reagent kits
$500 test stablecoin
2–8°C
180-day minimum shelf life
```

Fund settlement.

Supplier assigns:

```text
LOT-A102
```

Sensor reports:

```text
3.1
3.4
4.2
5.1
4.8
```

Shipment arrives.

Receiver scans QR.

Nischit displays:

```text
PRODUCT     ✓
QUANTITY    ✓
LOT         ✓
EXPIRY      ✓
DOCUMENTS   ✓
CONDITION   ✓
```

Receiver records physical receipt; authorized buyer QA accepts.

The receipt is linked to the QA decision, and finance/contract authorization permits settlement.

Dashboard changes:

```text
SETTLEMENT RELEASED
```

Tempo transaction appears.

---

# 42. Example Scenario — Shipment B

Create second shipment.

Use deterministic signed simulator data until an approved logger integration is available and independently validated.

Temperature becomes:

```text
4.1°C
5.3°C
7.8°C
9.6°C
11.2°C
10.4°C
7.1°C
```

Nischit detects excursion.

When shipment is scanned:

```text
CONDITION EXCEPTION

Maximum:
11.2°C

Allowed:
2–8°C

Settlement:
HELD

QA REVIEW REQUIRED
```

This is the critical operational decision in the example.

Keep the exception, held settlement state, and next authorized QA action visible together.

QA then selects:

```text
REJECT
```

Settlement remains held until an authorized refund/dispute resolution is submitted and confirmed. Rejection alone is not a confirmed refund.

No explanation of DeFi is required.

---

# 43. Commercial Adjustment Example

In this example, QA records an acceptable exception with supporting fixture evidence and the parties authorize the corresponding commercial split:

```text
ACCEPT WITH ADJUSTMENT
```

Example:

```text
Supplier receives: $475
Buyer credit:       $25
```

This illustrates that Nischit records commercial exceptions rather than treating sensor thresholds as automatic approvals.

---

# 44. Operational Evaluation Metrics

For an operational evaluation, measure:

```text
% shipments with complete lot records

% shipments with condition evidence

time from delivery → GRN

time from GRN → payment

number of QA exceptions identified

time required to investigate a delivery dispute

time required to locate all sites containing a recalled lot

% purchase transactions with complete evidence bundle
```

One useful operational metric is:

> **Time to answer “why was this shipment accepted and paid?”**

Record baseline and Nischit-assisted results separately. Report measured outcomes and the evaluation method; do not present an expected improvement as an achieved result.

---

# 45. Controlled Evaluation

Begin deployment evaluation with synthetic or explicitly approved data and a bounded workflow. Keep existing procurement, accounting, and laboratory systems authoritative until the deployment has passed its security, operational, and integration reviews. Define acceptance criteria, data handling, rollback, and reconciliation before processing operational records.

---

# 46. Integration Strategy

Treat existing procurement, laboratory, finance, inventory, and logger systems as integration boundaries. Potential adapter targets include:

```text
ERP
LIMS
accounting software
warehouse systems
vendor portals
IoT logger APIs
```

The current integration surface is the application REST API. CSV/LIMS mappings and external webhooks require a defined operator need, authorization model, failure handling, and production support plan.

---

# 47. Product and System Boundary

Nischit records procurement terms, lot and shipment details, private evidence references, receiving, authorized QA decisions, inventory events, and settlement state for diagnostic laboratory supplies.

- PostgreSQL is the operational source of truth; evidence documents remain in private object storage.
- Tenant and resource authorization is enforced by the API. User-interface visibility is not an authorization control.
- QA decisions require an authorized human. Sensors, hashes, signatures, and public-chain records support traceability but do not prove physical quality or regulatory compliance.
- Payment and attestation integrations are optional. Live settlement requires separate security, custody, legal, reconciliation, and operational approval.
- Nischit does not issue a project token. Any payment token belongs to a separately configured external rail and requires deployment approval.
- The system must not collect patient identities, diagnoses, clinical histories, or patient-linked test results.
