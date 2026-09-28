# Tempo escrow contract

`NischitEscrow.sol` is the smallest contract needed by the configured Tempo
adapter for isolated integration testing: one opaque order reference, one TIP-20 token,
one supplier, and one buyer-controlled final split or refund.

Deploy it to the selected Tempo testnet with a reviewed toolchain, record the
address in `TEMPO_ESCROW_ADDRESS`, and keep the payer key outside the image.
The repository does not claim this contract is audited or suitable for
production custody. For a Nepal deployment, use an authorized fiat/PSP boundary in
the deployment and security documents until legal and custody review is done.
