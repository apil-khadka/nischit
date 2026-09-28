import { NextResponse } from "next/server";
import {
  cookieOptions,
  identityFromUserInfo,
  refreshCookieName,
  refreshTokens,
  sessionCookieName,
  sessionToken,
  userInfo,
} from "../oidc";

export async function POST(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  const refreshToken = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${refreshCookieName}=`))?.slice(refreshCookieName.length + 1);
  if (!refreshToken) return NextResponse.json({ error: "REFRESH_REQUIRED" }, { status: 401 });
  try {
    const tokens = await refreshTokens(refreshToken);
    const accessToken = typeof tokens.access_token === "string" ? tokens.access_token : undefined;
    if (!accessToken) throw new Error("Rauthy did not return a refreshed access token");
    const identity = identityFromUserInfo(await userInfo(accessToken));
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookieName, sessionToken(identity), cookieOptions(3600));
    if (typeof tokens.refresh_token === "string") response.cookies.set(refreshCookieName, tokens.refresh_token, cookieOptions(60 * 60 * 24 * 2));
    return response;
  } catch (error) {
    const response = NextResponse.json({ error: "REFRESH_FAILED" }, { status: 401 });
    response.cookies.set(sessionCookieName, "", { ...cookieOptions(0), maxAge: 0 });
    response.cookies.set(refreshCookieName, "", { ...cookieOptions(0), maxAge: 0 });
    return response;
  }
}
