import { NextResponse, type NextRequest } from "next/server";

// Google OAuth only allows registered redirect URIs, and the OAuth cookies are per-host.
// Vercel exposes production under several aliases, so send everyone to the one canonical domain.
const CANONICAL_HOST = process.env.CANONICAL_HOST ?? "levan-persona.vercel.app";

export function proxy(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (process.env.VERCEL_ENV === "production" && host !== CANONICAL_HOST) {
    const url = req.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
