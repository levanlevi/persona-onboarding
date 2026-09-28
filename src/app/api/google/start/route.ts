import { NextRequest, NextResponse } from "next/server";
import { redirectUri, SCOPES } from "@/lib/google";

export async function GET(req: NextRequest) {
  const nonce = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(req.nextUrl.origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account consent",
    state: nonce,
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.cookies.set("persona_oauth_state", nonce, {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
