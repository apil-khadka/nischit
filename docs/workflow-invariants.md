# Workflow invariants

This is the implementation reference for inventory, QA, evidence, and settlement correctness. These rules apply across tenants and cannot be disabled by customization. Examples use synthetic data.

## Agreement, receipt, and QA

1. The buyer owns the PO and its policy snapshot. Supplier acknowledgement binds the same version; funding follows agreement. Editing agreed terms requires a new version and renewed consent, not overwriting a hash.
2. Receiving records what physically arrived, including discrepancies. It creates pending-QA stock, not automatically available stock. A signed receipt of delivery is not acceptance of quality.
3. The condition engine returns PASS, EXCEPTION, or INSUFFICIENT_EVIDENCE with the policy version and input references. Missing documents, incomplete claimed signatures, invalid predecessor hashes, unexplained gaps, invalid timestamp order, or inadequate coverage must not become PASS. The report retains aggregate metrics and a telemetry Merkle root; these commitments do not prove physical sensor accuracy.
4. Every receipt requires an authorized buyer QA decision. A supplier evidence-submission grant never grants buyer QA or finance authority. Acceptance with a discount does not make unsafe or recalled goods usable.
5. QA decides acceptability; commercial authorization decides the allowed distribution of funds. A discount/refund needs the agreed contract authority or counterparty consent. The backend must not invent a buyer's unilateral right to take a discount.
6. Corrections append a superseding decision/event and preserve the original. A new decision cannot reverse a payment already confirmed on-chain.

## Inventory identity and units

A lot identifies a manufacturer/product batch, not a mutable stock balance or globally unique lot-number string. A holding identifies quantity by tenant, site, lot, container where needed, and stock status. Map supplier and buyer identifiers explicitly; never join unrelated tenants by lot number.

Each product has a base stock unit with explicit precision. Use decimal database values or integer smallest units, not floating-point arithmetic. A kit, bottle, mL, and test are not interchangeable. Conversions require a versioned product-specific rule; no inferred “one test = one kit.” Multi-component kit recipes are later scope.

The current release uses one clearly declared stock unit per product. Record actual issued/consumed quantity by test use, QC/calibration, training, or other approved category. Test counts may support an estimate, but estimates must be labelled and reconciled against measured stock. Do not post both an estimated and actual deduction for the same use.

Opening a container records opening time and usable-until time; it does not consume the whole container. Usable-until is the earlier of manufacturer expiry and applicable post-opening expiry, interpreted under the documented product policy/timezone. Expiry blocks use; a later disposal event deducts stock once.

## Ledger and conservation

Inventory events are append-only. A transactional balance projection may accelerate queries, but must be rebuildable and reconciled with the ledger. Use unique source/idempotency keys, tenant-scoped foreign keys, and locking or atomic conditional updates to prevent duplicate receipt or negative stock under concurrency.

For one tenant and base unit:

`closing on-hand = opening on-hand + external receipts + approved positive corrections - consumption - waste/disposal - external returns - approved negative corrections`

Internal allocation, transfer, reservation, and quarantine do not change the tenant total. Partition on-hand into non-overlapping statuses; reserved stock is a subset of available stock, not additional stock. Consumable quantity excludes pending QA, in-transit, expired, quarantined, and reserved-for-other-work holdings.

Transfers debit the source into in-transit stock on dispatch and credit the destination on confirmed arrival. Both steps are idempotent and attributable; discrepancies require a reasoned correction, not silent loss. Consumption cannot occur from both source and destination.

Example: receive 20 kits, transfer 12 to a branch, then consume 6 for test work, consume 2 for QC, and waste 1 there. Central stock is 8, branch stock is 3, consumed is 8, waste is 1: 20 = 8 + 3 + 8 + 1. A recall quarantines the remaining 11; it does not create another deduction of 11.

Physical counts may differ from the ledger. Display “recorded remaining,” last reconciliation time, and unexplained variance; never claim complete physical traceability from incomplete entry.

## Recall

Match manufacturer, product, and explicit lot mappings within authorized tenant scope. Quarantine known remaining holdings and block new use; retain already-consumed and waste history. Cross-tenant propagation uses scoped grants and recipient acknowledgements, not global access.

A recall blocks new settlement authorization for affected goods pending the appropriate resolution; it does not cancel already-broadcast or confirmed payments. An in-flight submission race must be visible and reconciled. Lifting quarantine requires the applicable QA/recall authority and evidence; a payment adjustment is not clearance.

This is lot/location impact tracing, not patient notification or clinical follow-up.

## Settlement and cross-chain state

The current release has one settlement aggregate per PO, one supported test token per environment, and one final distribution. Amounts use integer token base units. The recorded supplier amount plus buyer credit/refund must equal the escrowed amount, apart from explicitly documented fees; fee funding is accounted for separately. Adjustment arithmetic is integer base-unit arithmetic, not floating point.

Document and test the contract's authorized funder, payees, QA attestor, release approver, dispute resolver, pause authority, and timeout/refund rules before deployment. No public method may let an arbitrary caller approve QA or redirect funds. A single trusted signer is a trust assumption, not decentralized arbitration.

Keep separate state dimensions:

| Dimension | Illustrative states |
|---|---|
| QA | Pending, accepted, accepted with adjustment, held, rejected |
| Settlement authorization | Draft, approved, submitted, reconciled, disputed |
| Chain transaction | Not submitted, pending, confirmed, reverted, unknown |
| Solana publication | Not requested, pending, confirmed, failed |

Write the approved intent, audit event, and outbox entry atomically in PostgreSQL. Before submission, recheck the current policy/authority and unresolved holds. Bind the command to chain ID, contract, PO reference, decision version, amount, recipients, and a unique intent ID.

Persist transaction identity/nonce or signature so the worker can reconcile after a timeout or crash. Outbox delivery is at least once; contract uniqueness and idempotent effects must prevent duplicate settlement. Unknown is not failed. Check existing chain state before replacement/retry. Mark paid only after the configured chain-specific confirmation/finality policy is satisfied; finality and token support need adapter tests. The domain mock now preserves `unknown` on a rail error and makes retry explicit.

Publish a Solana receipt only with a precisely scoped claim. A receipt referencing payment includes its confirmed Tempo chain ID, contract, transaction reference, and evidence commitment. A memo can record a signer's assertion but cannot independently verify a Tempo payment or enforce buyer QA authority. Verification must check the expected signer, payload version, and referenced chain state.

The chains are asynchronous; there is no atomic cross-chain transaction or bridge. Failed receipt publication is retryable and must not trigger another payment or downgrade a confirmed payment to unpaid.

## Evidence and public verification

Hash exact uploaded bytes. For structured bundles, define a versioned canonical serialization, fixed field meanings, UTC timestamps, decimal-as-string conventions, and a domain-separated commitment with a fresh random nonce. Keep the nonce with the private verification bundle; it reduces guessing of low-entropy private data.

Device signatures and hash chains expose some modification/replay/gap attacks; they do not prove physical accuracy or reveal an entirely withheld tail without expected coverage or independent checkpoints. Record measurement time and ingestion time separately; reject ambiguous coverage.

Public payloads contain only approved opaque references and commitments. On-chain amounts, wallet addresses, timing, and transaction relationships are inherently observable. Explain this before opting parties into a chain payment. A hash is not anonymization.

Private reports include records only for an authorized audience. Public verification can attest to integrity and signer identity within its trust model, not manufacturer authenticity, clinical suitability, complete usage capture, or regulatory compliance.
