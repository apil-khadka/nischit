import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authConfig, sameIssuer, verifyIdToken } from "./oidc";

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

describe("OIDC verification", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("treats an explicit standard HTTPS port as the same issuer", () => {
    expect(sameIssuer("https://id.example.test:443/auth/v1/", "https://id.example.test/auth/v1")).toBe(true);
    expect(sameIssuer("https://id.example.test/auth/v1", "https://other.example.test/auth/v1")).toBe(false);
  });

  it("verifies an EdDSA ID token against the discovered JWKS", async () => {
    vi.stubEnv("RAUTHY_ISSUER", "https://id.example.test:443/auth/v1");
    vi.stubEnv("RAUTHY_CLIENT_ID", "nischit-web");
    vi.stubEnv("AUTH_SESSION_SECRET", "a".repeat(32));
    vi.stubEnv("NISCHIT_OIDC_REDIRECT_URI", "https://nischit.example.test/auth/callback");
    const config = authConfig();
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const jwk = publicKey.export({ format: "jwk" });
    const header = { alg: "EdDSA", kid: "test-key", typ: "JWT" };
    const payload = {
      iss: "https://id.example.test:443/auth/v1/",
      aud: "nischit-web",
      sub: "user-1",
      nonce: "nonce-1",
      exp: Math.floor(Date.now() / 1000) + 300,
    };
    const signingInput = `${encode(header)}.${encode(payload)}`;
    const signature = sign(null, Buffer.from(signingInput), privateKey).toString("base64url");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ keys: [{ ...jwk, kid: "test-key", alg: "EdDSA" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    await expect(verifyIdToken(`${signingInput}.${signature}`, {
      issuer: "https://id.example.test/auth/v1/",
      jwks_uri: "https://id.example.test/auth/v1/oidc/certs",
    }, config)).resolves.toMatchObject({ sub: "user-1", nonce: "nonce-1" });
  });

  it("rejects a tampered ID token", async () => {
    vi.stubEnv("RAUTHY_ISSUER", "https://id.example.test/auth/v1");
    vi.stubEnv("RAUTHY_CLIENT_ID", "nischit-web");
    vi.stubEnv("AUTH_SESSION_SECRET", "a".repeat(32));
    vi.stubEnv("NISCHIT_OIDC_REDIRECT_URI", "https://nischit.example.test/auth/callback");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const header = { alg: "EdDSA", kid: "test-key", typ: "JWT" };
    const payload = { iss: "https://id.example.test/auth/v1/", aud: "nischit-web", sub: "user-1", nonce: "nonce-1", exp: Math.floor(Date.now() / 1000) + 300 };
    const signingInput = `${encode(header)}.${encode(payload)}`;
    const signature = sign(null, Buffer.from(signingInput), privateKey).toString("base64url");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "EdDSA" }] }))));

    const tamperedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    await expect(verifyIdToken(`${signingInput}.${tamperedSignature}`, {
      issuer: "https://id.example.test/auth/v1",
      jwks_uri: "https://id.example.test/auth/v1/oidc/certs",
    })).rejects.toThrow("signature validation failed");
  });
});
