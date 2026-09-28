import { NextResponse } from "next/server";
import {
  authConfig,
  cookieOptions,
  discover,
  endpointFor,
  idTokenCookieName,
  oidcNonceCookieName,
  oidcStateCookieName,
  oidcVerifierCookieName,
  refreshCookieName,
  returnToCookieName,
  sessionCookieName,
} from "../oidc";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/", url.origin));
  for (const name of [sessionCookieName, refreshCookieName, idTokenCookieName, oidcNonceCookieName, oidcStateCookieName, oidcVerifierCookieName, returnToCookieName]) {
    response.cookies.set(name, "", { ...cookieOptions(0), maxAge: 0 });
  }
  try {
    const config = authConfig();
    const discovery = await discover(config);
    const endpoint = endpointFor(discovery, "end_session_endpoint", config);
    const idToken = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${idTokenCookieName}=`))?.slice(idTokenCookieName.length + 1);
    const logout = new URL(endpoint);
    logout.searchParams.set("post_logout_redirect_uri", new URL("/", url.origin).toString());
    logout.searchParams.set("client_id", config.clientId);
    if (idToken) logout.searchParams.set("id_token_hint", idToken);
    return NextResponse.redirect(logout);
  } catch {
    return response;
  }
}
