import { createHmac, createVerify, timingSafeEqual, type KeyObject } from "node:crypto";
import { DomainError } from "@nischit/domain";

export interface RequestIdentity {
  tenantId: string;
  userId: string;
  email?: string;
  displayName?: string;
}

export interface IdentityProvider {
  readonly verified?: boolean;
  resolve(headers: Record<string, string | string[] | undefined>): RequestIdentity;
}

interface JwtClaims {
  iss?: unknown;
  aud?: unknown;
  sub?: unknown;
  exp?: unknown;
  nbf?: unknown;
  [claim: string]: unknown;
}

export interface BearerJwtIdentityOptions {
  publicKey: KeyObject | string;
  issuer: string;
  audience: string;
  tenantClaim?: string;
  defaultTenantId?: string;
  userClaim?: string;
  headerName?: string;
  clockSkewSeconds?: number;
}

/**
 * Minimal production-facing seam for an OIDC provider that exposes an RS256
 * public key. Key rotation/JWKS fetching belongs at the edge or deployment
 * layer; the API still verifies the signature and registered claims here.
 */
export class BearerJwtIdentityProvider implements IdentityProvider {
  readonly verified = true;
  private readonly tenantClaim: string;
  private readonly userClaim: string;
  private readonly headerName: string;
  private readonly clockSkewSeconds: number;

  constructor(private readonly options: BearerJwtIdentityOptions) {
    if (!options.issuer || !options.audience) throw new Error("JWT issuer and audience are required");
    this.tenantClaim = options.tenantClaim ?? "tenant_id";
    this.userClaim = options.userClaim ?? "sub";
    this.headerName = options.headerName?.toLowerCase() ?? "authorization";
    this.clockSkewSeconds = options.clockSkewSeconds ?? 30;
  }

  static fromEnvironment(environment: NodeJS.ProcessEnv = process.env) {
    const publicKey = environment.IDENTITY_PUBLIC_KEY?.replaceAll("\\n", "\n");
    const issuer = environment.IDENTITY_ISSUER;
    const audience = environment.IDENTITY_AUDIENCE;
    const configuredValues = [publicKey, issuer, audience].filter(Boolean).length;
    if (configuredValues > 0 && configuredValues < 3) {
      throw new Error("IDENTITY_PUBLIC_KEY, IDENTITY_ISSUER, and IDENTITY_AUDIENCE must be configured together");
    }
    if (!publicKey || !issuer || !audience) return undefined;
    return new BearerJwtIdentityProvider({
      publicKey,
      issuer,
      audience,
      tenantClaim: environment.IDENTITY_TENANT_CLAIM ?? "tenant_id",
      defaultTenantId: environment.IDENTITY_DEFAULT_TENANT_ID,
      userClaim: environment.IDENTITY_USER_CLAIM ?? "sub",
      headerName: environment.IDENTITY_HEADER ?? "authorization",
    });
  }

  resolve(headers: Record<string, string | string[] | undefined>): RequestIdentity {
    const credential = this.singleHeader(headers[this.headerName]);
    const token = this.headerName === "authorization"
      ? credential?.startsWith("Bearer ") ? credential.slice("Bearer ".length).trim() : undefined
      : credential?.trim();
    if (!token) throw new DomainError("Bearer token is required", "UNAUTHENTICATED", 401);
    const parts = token.split(".");
    if (parts.length !== 3) throw new DomainError("Invalid bearer token", "UNAUTHENTICATED", 401);
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    try {
      const header = JSON.parse(Buffer.from(encodedHeader!, "base64url").toString("utf8")) as { alg?: unknown; typ?: unknown };
      if (header.alg !== "RS256") throw new Error("Unsupported JWT algorithm");
      const verifier = createVerify("RSA-SHA256");
      verifier.update(`${encodedHeader}.${encodedPayload}`);
      verifier.end();
      if (!verifier.verify(this.options.publicKey, Buffer.from(encodedSignature!, "base64url"))) throw new Error("Signature mismatch");
      const claims = JSON.parse(Buffer.from(encodedPayload!, "base64url").toString("utf8")) as JwtClaims;
      this.validateClaims(claims);
      const configuredTenant = claims[this.tenantClaim];
      const tenantId = typeof configuredTenant === "string" && configuredTenant
        ? configuredTenant
        : this.options.defaultTenantId;
      const userId = claims[this.userClaim];
      if (typeof tenantId !== "string" || !tenantId) throw new Error("Tenant claim is missing");
      if (typeof userId !== "string" || !userId) throw new Error("Subject claim is missing");
      const email = typeof claims.email === "string" ? claims.email : undefined;
      const displayName = typeof claims.name === "string"
        ? claims.name
        : email;
      return { tenantId, userId, email, displayName };
    } catch {
      throw new DomainError("Invalid bearer token", "UNAUTHENTICATED", 401);
    }
  }

  private validateClaims(claims: JwtClaims) {
    if (claims.iss !== this.options.issuer) throw new Error("Issuer mismatch");
    const audience = claims.aud;
    if (!(audience === this.options.audience || (Array.isArray(audience) && audience.includes(this.options.audience)))) {
      throw new Error("Audience mismatch");
    }
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== "number" || claims.exp <= now - this.clockSkewSeconds) throw new Error("Token expired");
    if (claims.nbf !== undefined && (typeof claims.nbf !== "number" || claims.nbf > now + this.clockSkewSeconds)) {
      throw new Error("Token is not active");
    }
  }

  private singleHeader(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
      if (value.length !== 1) throw new DomainError("Ambiguous authorization header", "UNAUTHENTICATED", 401);
      return value[0];
    }
    return value;
  }
}

export interface SignedSessionIdentityOptions {
  secret: string;
  issuer: string;
  audience: string;
  cookieName?: string;
  tenantClaim?: string;
  userClaim?: string;
  clockSkewSeconds?: number;
}

/**
 * Verifies the short-lived, HttpOnly application session minted by the web
 * OIDC callback. Rauthy remains the source of authentication; this boundary
 * prevents the browser from carrying a bearer token in JavaScript while still
 * allowing the API to enforce its own tenant membership and roles.
 */
export class SignedSessionIdentityProvider implements IdentityProvider {
  readonly verified = true;
  private readonly cookieName: string;
  private readonly tenantClaim: string;
  private readonly userClaim: string;
  private readonly clockSkewSeconds: number;

  constructor(private readonly options: SignedSessionIdentityOptions) {
    if (options.secret.length < 32) throw new Error("AUTH_SESSION_SECRET must be at least 32 characters");
    if (!options.issuer || !options.audience) throw new Error("Session issuer and audience are required");
    this.cookieName = options.cookieName ?? "nischit_session";
    this.tenantClaim = options.tenantClaim ?? "tenant_id";
    this.userClaim = options.userClaim ?? "sub";
    this.clockSkewSeconds = options.clockSkewSeconds ?? 30;
  }

  static fromEnvironment(environment: NodeJS.ProcessEnv = process.env) {
    if (environment.IDENTITY_MODE !== "rauthy-session") return undefined;
    const secret = environment.AUTH_SESSION_SECRET;
    if (!secret) throw new Error("AUTH_SESSION_SECRET is required for IDENTITY_MODE=rauthy-session");
    return new SignedSessionIdentityProvider({
      secret,
      issuer: environment.AUTH_SESSION_ISSUER ?? environment.IDENTITY_ISSUER ?? "nischit-session",
      audience: environment.IDENTITY_AUDIENCE ?? "nischit-api",
      cookieName: environment.AUTH_SESSION_COOKIE ?? "nischit_session",
      tenantClaim: environment.IDENTITY_TENANT_CLAIM ?? "tenant_id",
      userClaim: environment.IDENTITY_USER_CLAIM ?? "sub",
    });
  }

  resolve(headers: Record<string, string | string[] | undefined>): RequestIdentity {
    const cookieHeader = this.singleHeader(headers.cookie);
    const token = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${this.cookieName}=`))?.slice(this.cookieName.length + 1);
    if (!token) throw new DomainError("Session cookie is required", "UNAUTHENTICATED", 401);
    const parts = token.split(".");
    if (parts.length !== 3) throw new DomainError("Invalid session", "UNAUTHENTICATED", 401);
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    try {
      const header = JSON.parse(Buffer.from(encodedHeader!, "base64url").toString("utf8")) as { alg?: unknown; typ?: unknown };
      if (header.alg !== "HS256") throw new Error("Unsupported session algorithm");
      const expected = createHmac("sha256", this.options.secret).update(`${encodedHeader}.${encodedPayload}`).digest();
      const actual = Buffer.from(encodedSignature!, "base64url");
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Session signature mismatch");
      const claims = JSON.parse(Buffer.from(encodedPayload!, "base64url").toString("utf8")) as JwtClaims;
      if (claims.iss !== this.options.issuer) throw new Error("Session issuer mismatch");
      const audience = claims.aud;
      if (!(audience === this.options.audience || (Array.isArray(audience) && audience.includes(this.options.audience)))) throw new Error("Session audience mismatch");
      const now = Math.floor(Date.now() / 1000);
      if (typeof claims.exp !== "number" || claims.exp <= now - this.clockSkewSeconds) throw new Error("Session expired");
      if (claims.nbf !== undefined && (typeof claims.nbf !== "number" || claims.nbf > now + this.clockSkewSeconds)) throw new Error("Session is not active");
      const tenantId = claims[this.tenantClaim];
      const userId = claims[this.userClaim];
      if (typeof tenantId !== "string" || !tenantId || typeof userId !== "string" || !userId) throw new Error("Session identity is incomplete");
      const email = typeof claims.email === "string" ? claims.email : undefined;
      const displayName = typeof claims.name === "string" ? claims.name : email;
      return { tenantId, userId, email, displayName };
    } catch {
      throw new DomainError("Invalid session", "UNAUTHENTICATED", 401);
    }
  }

  private singleHeader(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
      if (value.length !== 1) throw new DomainError("Ambiguous cookie header", "UNAUTHENTICATED", 401);
      return value[0];
    }
    return value;
  }
}

/**
 * Local development adapter only. Production startup requires a verified
 * identity provider before the API accepts requests.
 */
export class PreviewHeaderIdentityProvider implements IdentityProvider {
  readonly verified = false;
  resolve(headers: Record<string, string | string[] | undefined>): RequestIdentity {
    const tenantId = String(headers["x-tenant-id"] ?? "");
    const userId = String(headers["x-user-id"] ?? "");
    if (!tenantId || tenantId === "undefined" || !userId || userId === "undefined") {
      throw new DomainError("Identity headers are required", "UNAUTHENTICATED", 401);
    }
    return { tenantId, userId };
  }
}
