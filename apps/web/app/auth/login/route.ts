import { NextResponse } from "next/server";
import {
  authorizationUrl,
  cookieOptions,
  createOpaqueValue,
  createPkceVerifier,
  oidcNonceCookieName,
  oidcStateCookieName,
  oidcVerifierCookieName,
  returnToCookieName,
  safeReturnTo,
} from "../oidc";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const state = createOpaqueValue();
    const nonce = createOpaqueValue();
    const verifier = createPkceVerifier();
    const returnTo = safeReturnTo(url.searchParams.get("returnTo"), url.origin);
    const redirect = NextResponse.redirect(await authorizationUrl(state, verifier, nonce, request.url));
    const shortLived = cookieOptions(600);
    redirect.cookies.set(oidcStateCookieName, state, shortLived);
    redirect.cookies.set(oidcNonceCookieName, nonce, shortLived);
    redirect.cookies.set(oidcVerifierCookieName, verifier, shortLived);
    redirect.cookies.set(returnToCookieName, returnTo, shortLived);
    return redirect;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rauthy sign-in could not start";
    return NextResponse.json({ error: "AUTH_CONFIGURATION_ERROR", message }, { status: 503 });
  }
}
