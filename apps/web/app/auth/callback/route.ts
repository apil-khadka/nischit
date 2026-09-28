import { NextResponse } from "next/server";
import {
  authConfig,
  cookieOptions,
  exchangeCode,
  discover,
  idTokenCookieName,
  identityFromUserInfo,
  oidcNonceCookieName,
  oidcStateCookieName,
  oidcVerifierCookieName,
  refreshCookieName,
  returnToCookieName,
  safeReturnTo,
  sessionCookieName,
  sessionToken,
  userInfo,
  verifyIdToken,
  verifyOpaqueValue,
} from "../oidc";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const cookies = request.headers.get("cookie") ?? "";
  const cookieValue = (name: string) => cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  const returnTo = safeReturnTo(cookieValue(returnToCookieName), url.origin);
  if (error || !verifyOpaqueValue(cookieValue(oidcStateCookieName), state) || !code) {
    return NextResponse.json({ error: "AUTH_CALLBACK_REJECTED", message: error ?? "The Rauthy callback state was invalid" }, { status: 400 });
  }

  try {
    const tokens = await exchangeCode(code, cookieValue(oidcVerifierCookieName) ?? "");
    const accessToken = typeof tokens.access_token === "string" ? tokens.access_token : undefined;
    if (!accessToken) throw new Error("Rauthy did not return an access token");
    const profile = await userInfo(accessToken);
    const identity = identityFromUserInfo(profile);
    const idToken = typeof tokens.id_token === "string" ? tokens.id_token : undefined;
    const config = authConfig();
    if (!idToken) throw new Error("Rauthy did not return an ID token");
    const configuration = await discover(config);
    const idClaims = await verifyIdToken(idToken, configuration, config);
    if (!verifyOpaqueValue(cookieValue(oidcNonceCookieName), String(idClaims.nonce))) throw new Error("Rauthy nonce validation failed");
    if (idClaims.sub !== identity.userId) throw new Error("Rauthy subject validation failed");

    const response = NextResponse.redirect(new URL(returnTo, url.origin));
    response.cookies.set(sessionCookieName, sessionToken(identity), cookieOptions(3600));
    if (typeof tokens.refresh_token === "string") response.cookies.set(refreshCookieName, tokens.refresh_token, cookieOptions(60 * 60 * 24 * 2));
    if (idToken) response.cookies.set(idTokenCookieName, idToken, cookieOptions(60 * 60 * 4));
    response.cookies.set(oidcStateCookieName, "", { ...cookieOptions(0), maxAge: 0 });
    response.cookies.set(oidcNonceCookieName, "", { ...cookieOptions(0), maxAge: 0 });
    response.cookies.set(oidcVerifierCookieName, "", { ...cookieOptions(0), maxAge: 0 });
    response.cookies.set(returnToCookieName, "", { ...cookieOptions(0), maxAge: 0 });
    return response;
  } catch (exchangeError) {
    const message = exchangeError instanceof Error ? exchangeError.message : "Rauthy sign-in failed";
    return NextResponse.json({ error: "AUTH_CALLBACK_FAILED", message }, { status: 502 });
  }
}
