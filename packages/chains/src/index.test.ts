import { describe, expect, it } from "vitest";
import { parseSolanaSecretKey } from "./index.js";

describe("chain adapter configuration", () => {
  it("parses documented Solana secret-key formats without logging key material", () => {
    const jsonKey = Array.from({ length: 32 }, (_, index) => index);
    const base64Key = Uint8Array.from({ length: 64 }, (_, index) => index + 1);
    expect([...parseSolanaSecretKey(JSON.stringify(jsonKey))]).toEqual(jsonKey);
    expect([...parseSolanaSecretKey(Buffer.from(base64Key).toString("base64"))]).toEqual([...base64Key]);
    expect(() => parseSolanaSecretKey("[999]")).toThrow("Invalid Solana JSON secret key");
    expect(() => parseSolanaSecretKey("AQID")).toThrow("32 or 64 bytes");
    expect(() => parseSolanaSecretKey("not-base64!")).toThrow("Invalid Solana base64 secret key");
  });
});
