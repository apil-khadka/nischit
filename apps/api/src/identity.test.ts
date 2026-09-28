import { createHmac, generateKeyPairSync, createSign, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BearerJwtIdentityProvider, PreviewHeaderIdentityProvider, SignedSessionIdentityProvider } from "./identity.js";

const base64url = (value: string | Uint8Array) => Buffer.from(value).toString("base64url");
const signToken = (privateKey: KeyObject, overrides: Record<string, unknown> = {}) => {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: "https://issuer.example",
    aud: "nischit-api",
    sub: "user-a",
    tenant_id: "tenant-a",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    ...overrides,
  }));
  const input = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(input);
  signer.end();
  return `${input}.${signer.sign(privateKey).toString("base64url")}`;
};
const signSession = (secret: string, overrides: Record<string, unknown> = {}) => {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: "nischit-session",
    aud: "nischit-api",
    sub: "user-a",
    tenant_id: "tenant-a",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    ...overrides,
  }));
  const input = `${header}.${payload}`;
  return `${input}.${createHmac("sha256", secret).update(input).digest("base64url")}`;
};

describe("identity provider seam", () => {
  it("resolves an explicit preview tenant context", () => {
    const identity = new PreviewHeaderIdentityProvider().resolve({
      "x-tenant-id": "tenant-a",
      "x-user-id": "user-a",
    });
    expect(identity).toEqual({ tenantId: "tenant-a", userId: "user-a" });
  });

  it("fails closed when either identity header is absent", () => {
    expect(() => new PreviewHeaderIdentityProvider().resolve({ "x-tenant-id": "tenant-a" }))
      .toThrow("Identity headers are required");
  });

  it("verifies a configured RS256 bearer token and maps its tenant claim", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const provider = new BearerJwtIdentityProvider({
      publicKey,
      issuer: "https://issuer.example",
      audience: "nischit-api",
    });
    expect(provider.resolve({ authorization: `Bearer ${signToken(privateKey)}` })).toEqual({
      tenantId: "tenant-a",
      userId: "user-a",
    });
  });

  it("rejects expired, wrong-issuer, and non-bearer credentials", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const provider = new BearerJwtIdentityProvider({
      publicKey,
      issuer: "https://issuer.example",
      audience: "nischit-api",
    });
    expect(() => provider.resolve({ authorization: "Basic abc" })).toThrow("Bearer token is required");
    expect(() => provider.resolve({ authorization: "Bearer not-a-token" })).toThrow("Invalid bearer token");
    expect(() => provider.resolve({ authorization: `Bearer ${signToken(privateKey, { exp: Math.floor(Date.now() / 1000) - 60 })}` }))
      .toThrow("Invalid bearer token");
    expect(() => provider.resolve({ authorization: `Bearer ${signToken(privateKey, { iss: "https://wrong.example" })}` }))
      .toThrow("Invalid bearer token");
  });

  it("does not silently fall back to preview identity when JWT configuration is partial", () => {
    expect(() => BearerJwtIdentityProvider.fromEnvironment({ IDENTITY_ISSUER: "https://issuer.example" }))
      .toThrow("must be configured together");
  });

  it("accepts a verified Cloudflare Access-style assertion header and an explicit default tenant", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const provider = new BearerJwtIdentityProvider({
      publicKey,
      issuer: "https://issuer.example",
      audience: "access-application-audience",
      headerName: "cf-access-jwt-assertion",
      defaultTenantId: "tenant-default",
      userClaim: "email",
    });
    const token = signToken(privateKey, { aud: "access-application-audience", tenant_id: undefined, email: "owner@example.com", name: "Owner" });
    expect(provider.resolve({ "cf-access-jwt-assertion": token })).toEqual({
      tenantId: "tenant-default",
      userId: "owner@example.com",
      email: "owner@example.com",
      displayName: "Owner",
    });
  });

  it("verifies the HttpOnly application session issued after Rauthy login", () => {
    const provider = new SignedSessionIdentityProvider({ secret: "s".repeat(32), issuer: "nischit-session", audience: "nischit-api" });
    expect(provider.resolve({ cookie: `nischit_session=${signSession("s".repeat(32), { email: "owner@example.com", name: "Owner" })}` })).toEqual({
      tenantId: "tenant-a",
      userId: "user-a",
      email: "owner@example.com",
      displayName: "Owner",
    });
    expect(() => provider.resolve({ cookie: "nischit_session=not-a-session" })).toThrow("Invalid session");
  });
});
