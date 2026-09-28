# Keep Tempo and Solana behind chain adapters

**Status: accepted.** Tempo is the conditional settlement adapter and Solana is the public receipt/attestation adapter. Domain modules must not import chain SDKs. The first release will not bridge assets or make Solana the operational ledger; each chain receives only the minimum commitment or settlement state needed for verification.

Use isolated test networks for development and verification. The adapters have independent confirmation and retry states: a failed Solana receipt must not repeat a Tempo payment. A signed memo is a publication assertion, not a trustless cross-chain proof. Receipt semantics and authorized signers must be explicit; a custom program is conditional on those requirements. Live networks remain disabled until authorization, privacy, custody, and reconciliation controls are reviewed.
