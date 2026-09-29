# Test guide

This guide describes expected behavior in ordinary language. Edit these statements when product behavior should change; automated checks should then be adapted to match the new expectations. You can edit this guide without writing code. The test runner does not execute this file.

## Access and roles

- When a buyer creates a purchase order, the supplier should not see it until the buyer explicitly grants access. After the grant, only the authorized supplier should see it.
- A supplier should be able to acknowledge an order and provide shipment information, but should not be able to make the buyer’s QA or finance decisions.
- A user should only see records and evidence allowed by their active tenant membership and role. Changing a URL or sending another tenant’s identifier should not grant access.
- A session with missing, invalid, expired, or wrongly issued identity information should be rejected. Production should never accept the local preview identity.

## Evidence and quality decisions

- If required shipment evidence is missing, malformed, or inconsistent, the system should not silently mark the shipment acceptable.
- Every purchase order should record the product-specific maximum gap between telemetry readings. Evidence should remain insufficient until receiving closes the shipment window and readings cover dispatch through receipt within that gap. A single reading, a missing policy gap, or an unexplained gap should never produce PASS.
- A temperature that is missing, non-finite, or outside the agreed range should not produce PASS. A provided device signature should count as verified only when the system can validate it against a trusted device key; an unverified signature claim should leave evidence insufficient.
- When recorded conditions fall outside the agreed policy, settlement should remain held until an authorized QA reviewer makes and records a decision with a reason.
- A QA decision of Hold or Reject should keep settlement held. It should never authorize a payout.
- An accepted-with-adjustment decision should be rejected unless the agreed purchase-order policy allows adjustments. Adjustments should be whole basis points within the permitted range.
- A supplier should not be able to approve its own shipment’s QA result. A sensor reading, signature, hash, or chain receipt should support review but should not automatically prove physical quality.
- Private evidence files should remain private. An authorized buyer QA reviewer should be able to open only files attached to that purchase order, even when those files are stored in the supplier’s tenant. A public verification record should not reveal the documents themselves.

## Inventory, recalls, and settlement

- Receiving stock, moving it between sites, consuming it, or disposing of it should update the recorded quantity without creating or losing stock unintentionally.
- Expired or recalled stock should not be available for use or new settlement authorization. Releasing quarantined stock should require the appropriate authorization.
- Repeating the same funded, received, QA, or settlement command should not create a duplicate result.
- Before sending a payment, the system should save the payment intent. If a payment request times out, the system should retain its action and transaction reference when available, show an unknown state, and reconcile the same action before allowing another submission.
- Publishing an attestation should not be shown as proof that a payment settled. The payment and attestation records should be checked independently.

## Evidence storage and background work

- Evidence belonging to one tenant should not be accessible through another tenant’s storage path. Invalid paths and mismatched checksums should be rejected.
- The background worker should record completion for event types it knows how to handle. It should leave unknown event types available for a later retry rather than silently discarding them.
- Saving operational state and its audit/outbox records should succeed or fail together, so the system does not report an action without its corresponding audit record.

## What a passing run means

A passing run means the automated cases that ran passed under their test conditions. It does not mean every expectation in this guide is covered, and it does not prove a production identity provider, storage service, payment network, contract, or deployment is configured correctly. Live network checks, full browser workflows, backup restoration, and deployment security reviews remain separate verification work.

For the commands and detailed coverage map, see [the testing reference](testing.md). The repository commands are also listed in the [README](../README.md#verification-commands).
