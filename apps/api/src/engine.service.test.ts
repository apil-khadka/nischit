import { afterEach, describe, expect, it } from "vitest";
import { EngineService } from "./engine.service.js";

const productionValues = {
  NODE_ENV: "production",
  PAYMENT_MODE: "tempo",
  ATTESTATION_MODE: "solana",
  TEMPO_RPC_URL: "http://127.0.0.1:8545",
  TEMPO_ESCROW_ADDRESS: `0x${"1".repeat(40)}`,
  TEMPO_PAYER_PRIVATE_KEY: `0x${"1".repeat(64)}`,
  TEMPO_TOKEN_ADDRESSES_JSON: JSON.stringify({ TEST_USD: `0x${"2".repeat(40)}` }),
  TEMPO_SUPPLIER_ADDRESSES_JSON: JSON.stringify({ "preview-supplier": `0x${"3".repeat(40)}` }),
  SOLANA_RPC_URL: "https://api.devnet.solana.com",
  SOLANA_SIGNER_SECRET_KEY: JSON.stringify(Array.from({ length: 32 }, () => 1)),
};

describe("production service boundary", () => {
  afterEach(() => {
    for (const key of Object.keys(productionValues)) delete process.env[key];
  });

  it("does not seed the synthetic preview directory when production identity is required", () => {
    Object.assign(process.env, productionValues);
    const service = new EngineService({ resolve: () => ({ tenantId: "tenant", userId: "user" }) });

    expect(service.preview).toBeUndefined();
  });
});
