---
title: PostgreSQL source of truth
description: Record which systems own operational records, private documents, coordination, and chain receipts.
docType: explanation
---

# Use PostgreSQL as the operational source of truth

**Status: accepted.** PostgreSQL will own purchase orders, lots, inventory events, QA decisions, settlement state, collaboration grants, and audit records. Object storage owns private documents; Tempo and Solana hold commitments/settlement receipts. This preserves transactional inventory and QA invariants without forcing high-volume or private data on-chain.

For actual on-chain funds movement, confirmed chain state is authoritative; database payment status is a reconciled projection. Valkey is disposable and cannot own inventory balances, audit history, or durable job completion.
