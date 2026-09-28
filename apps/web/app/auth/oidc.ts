import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify as verifySignature } from "node:crypto";

export const sessionCookieName = process.env.AUTH_SESSION_COOKIE ?? "nischit_session";
export const refreshCookieName = "nischit_refresh";
export const idTokenCookieName = "nischit_id_token";
export const oidcStateCookieName = "nischit_oidc_state";
export const oidcVerifierCookieName = "nischit_oidc_verifier";
export const oidcNonceCookieName = "nischit_oidc_nonce";
export const returnToCookieName = "nischit_return_to";

type JsonObject = Record<string, unknown>;

export interface OidcConfiguration {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  end_session_endpoint?: string;
  [key: string]: unknown;
}

export interface OidcIdentity {
  userId: string;
  tenantId: string;
  email?: string;
  displayName?: string;
}

const base64url = (value: string | Uint8Array) => Buffer.from(value).toString("base64url");

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Rauthy sign-in`);
  return value;
};

export const authConfig = () => ({
  issuer: required("RAUTHY_ISSUER").replace(/\/$/, ""),
  clientId: required("RAUTHY_CLIENT_ID"),
  clientSecret: process.env.RAUTHY_CLIENT_SECRET?.trim(),
  redirectUri: required("NISCHIT_OIDC_REDIRECT_URI"),
  sessionSecret: required("AUTH_SESSION_SECRET"),
  sessionIssuer: process.env.AUTH_SESSION_ISSUER?.trim() || "nischit-session",
  audience: process.env.IDENTITY_AUDIENCE?.trim() || "nischit-api",
  tenantClaim: process.env.IDENTITY_TENANT_CLAIM?.trim() || "tenant_id",
  defaultTenantId: process.env.IDENTITY_DEFAULT_TENANT_ID?.trim(),
  userClaim: process.env.IDENTITY_USER_CLAIM?.trim() || "sub",
  sessionTtlSeconds: Number(process.env.AUTH_SESSION_TTL_SECONDS ?? "3600"),
});

export async function discover(config = authConfig()): Promise<OidcConfiguration> {
  const response = await fetch(`${config.issuer}/.well-known/openid-configuration`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Rauthy discovery failed (${response.status})`);
  const payload = await response.json() as unknown;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Rauthy discovery returned an invalid document");
  const configuration = payload as OidcConfiguration;
  if (typeof configuration.issuer !== "string" || !sameIssuer(configuration.issuer, config.issuer)) {
    throw new Error("Rauthy discovery issuer validation failed");
  }
  return configuration;
}

const canonicalIssuer = (value: string) => {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("OIDC issuer must use HTTP(S)");
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
};

export const sameIssuer = (left: string, right: string) => {
  try {
    return canonicalIssuer(left) === canonicalIssuer(right);
  } catch {
    return false;
  }
};

const endpoint = (configuration: OidcConfiguration, name: keyof OidcConfiguration, issuer: string, path: string) => {
  const value = configuration[name];
  return typeof value === "string" && value ? value : `${issuer}${path}`;
};

export const endpointFor = (configuration: OidcConfiguration, name: keyof OidcConfiguration, config = authConfig()) => {
  const paths: Partial<Record<keyof OidcConfiguration, string>> = {
    authorization_endpoint: "/oidc/authorize",
    token_endpoint: "/oidc/token",
    userinfo_endpoint: "/oidc/userinfo",
    end_session_endpoint: "/oidc/logout",
  };
  return endpoint(configuration, name, config.issuer, paths[name] ?? "/");
};

export function createPkceVerifier() {
  return base64url(randomBytes(48));
}

export function createPkceChallenge(verifier: string) {
  return base64url(createHash("sha256").update(verifier).digest());
}

export function createOpaqueValue() {
  return base64url(randomBytes(32));
}

export async function authorizationUrl(state: string, verifier: string, nonce: string, requestUrl?: string) {
  const config = authConfig();
  const configuration = await discover(config);
  const url = new URL(endpointFor(configuration, "authorization_endpoint", config));
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri || new URL("/auth/callback", requestUrl).toString());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", createPkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

async function tokenRequest(values: URLSearchParams, config = authConfig()) {
  const configuration = await discover(config);
  const headers: HeadersInit = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (config.clientSecret) headers.authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
  else values.set("client_id", config.clientId);
  const response = await fetch(endpointFor(configuration, "token_endpoint", config), { method: "POST", headers, body: values, cache: "no-store" });
  const payload = await response.json().catch(() => undefined) as unknown;
  if (!response.ok || !payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error(`Rauthy token exchange failed (${response.status})`);
  return payload as JsonObject;
}

export async function exchangeCode(code: string, verifier: string) {
  const config = authConfig();
  return tokenRequest(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: config.redirectUri, code_verifier: verifier }));
}

export async function refreshTokens(refreshToken: string) {
  return tokenRequest(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));
}

export async function userInfo(accessToken: string) {
  const config = authConfig();
  const configuration = await discover(config);
  const response = await fetch(endpointFor(configuration, "userinfo_endpoint", config), {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => undefined) as unknown;
  if (!response.ok || !payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error(`Rauthy userinfo failed (${response.status})`);
  return payload as JsonObject;
}

const decodeBase64Url = (value: string) => Buffer.from(value, "base64url");

const signatureAlgorithm = (alg: string) => {
  if (alg === "EdDSA") return null;
  if (alg === "RS256") return "RSA-SHA256";
  if (alg === "RS384") return "RSA-SHA384";
  if (alg === "RS512") return "RSA-SHA512";
  return undefined;
};

export async function verifyIdToken(idToken: string, configuration: OidcConfiguration, config = authConfig()) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Rauthy ID token format is invalid");
  const encodedHeader = parts[0];
  const encodedPayload = parts[1];
  const encodedSignature = parts[2];
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error("Rauthy ID token format is invalid");
  let header: JsonObject;
  let payload: JsonObject;
  try {
    header = JSON.parse(decodeBase64Url(encodedHeader).toString("utf8")) as JsonObject;
    payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8")) as JsonObject;
  } catch {
    throw new Error("Rauthy ID token JSON is invalid");
  }
  const alg = typeof header.alg === "string" ? header.alg : "";
  const keyId = typeof header.kid === "string" ? header.kid : undefined;
  const jwksUri = configuration.jwks_uri;
  if (!jwksUri) throw new Error("Rauthy JWKS endpoint is missing");
  const keyResponse = await fetch(jwksUri, { cache: "no-store" });
  if (!keyResponse.ok) throw new Error(`Rauthy JWKS request failed (${keyResponse.status})`);
  const keyDocument = await keyResponse.json() as unknown;
  const keys = keyDocument && typeof keyDocument === "object" && !Array.isArray(keyDocument) && Array.isArray((keyDocument as JsonObject).keys)
    ? (keyDocument as JsonObject).keys as unknown[]
    : [];
  const jwk = keys.find((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    const item = candidate as JsonObject;
    return item.kty && (!keyId || item.kid === keyId) && item.alg === alg;
  }) as JsonObject | undefined;
  if (!jwk) throw new Error("Rauthy signing key was not found");
  const digest = signatureAlgorithm(alg);
  if (digest === undefined) throw new Error(`Rauthy ID token algorithm '${alg}' is not allowed`);
  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const valid = verifySignature(digest, Buffer.from(`${encodedHeader}.${encodedPayload}`), publicKey, decodeBase64Url(encodedSignature));
  if (!valid) throw new Error("Rauthy ID token signature validation failed");
  if (!sameIssuer(String(payload.iss ?? ""), String(configuration.issuer ?? config.issuer))) throw new Error("Rauthy issuer validation failed");
  const audience = payload.aud;
  if (!(audience === config.clientId || (Array.isArray(audience) && audience.includes(config.clientId)))) throw new Error("Rauthy audience validation failed");
  if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error("Rauthy ID token expired");
  if (typeof payload.nonce !== "string" || !payload.nonce) throw new Error("Rauthy ID token nonce is missing");
  return payload;
}

const claim = (payload: JsonObject, name: string) => {
  const direct = payload[name];
  if (direct !== undefined) return direct;
  const custom = payload.custom;
  return custom && typeof custom === "object" && !Array.isArray(custom) ? (custom as JsonObject)[name] : undefined;
};

export function identityFromUserInfo(payload: JsonObject, config = authConfig()): OidcIdentity {
  if (payload.email_verified === false) throw new Error("Rauthy returned an unverified email");
  const user = claim(payload, config.userClaim);
  const tenant = claim(payload, config.tenantClaim) ?? config.defaultTenantId;
  if (typeof user !== "string" || !user) throw new Error(`Rauthy user claim '${config.userClaim}' is missing`);
  if (typeof tenant !== "string" || !tenant) throw new Error(`Rauthy tenant claim '${config.tenantClaim}' is missing`);
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const displayName = typeof payload.name === "string" ? payload.name : typeof payload.preferred_username === "string" ? payload.preferred_username : email;
  return { userId: user, tenantId: tenant, email, displayName };
}

export function sessionToken(identity: OidcIdentity, config = authConfig()) {
  if (config.sessionSecret.length < 32) throw new Error("AUTH_SESSION_SECRET must be at least 32 characters");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: config.sessionIssuer,
    aud: config.audience,
    sub: identity.userId,
    tenant_id: identity.tenantId,
    ...(identity.email ? { email: identity.email } : {}),
    ...(identity.displayName ? { name: identity.displayName } : {}),
    iat: now,
    exp: now + config.sessionTtlSeconds,
  }));
  const input = `${header}.${payload}`;
  const signature = createHmac("sha256", config.sessionSecret).update(input).digest();
  return `${input}.${base64url(signature)}`;
}

export function safeReturnTo(value: string | null | undefined, origin = "https://nischit.invalid") {
  if (!value || !value.startsWith("/")) return "/dashboard";
  try {
    const base = new URL(origin);
    const resolved = new URL(value, base);
    if (resolved.origin !== base.origin) return "/dashboard";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/dashboard";
  }
}

export function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}

export function verifyOpaqueValue(expected: string | undefined, received: string | null | undefined) {
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
