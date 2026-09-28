import { NextRequest } from "next/server";
import { GOOGLE_COOKIE, redirectUri, type GoogleSession } from "@/lib/google";
import { seal } from "@/lib/seal";

// Result is handed back to the chat window: postMessage to the opener (popup flow),
// BroadcastChannel (same-browser tab), or a redirect to "/" when there is no opener (mobile).
function finish(result: Record<string, unknown>, cookie?: { value: string; secure: boolean }) {
  const json = JSON.stringify({ type: "persona-google", ...result }).replace(/</g, "\\u003c");
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Connecting…</title>
<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;color:#444">
<p>${result.ok ? "Connected. You can close this window." : "Couldn't connect. You can close this window."}</p>
<script>
  const r = ${json};
  try { new BroadcastChannel("persona-google").postMessage(r); } catch {}
  if (window.opener) { try { window.opener.postMessage(r, location.origin); } catch {} setTimeout(() => window.close(), 150); }
  else { location.replace("/?google=" + (r.ok ? "ok" : "error")); }
</script></body>`;
  const headers = new Headers({ "Content-Type": "text/html; charset=utf-8" });
  if (cookie) {
    headers.append(
      "Set-Cookie",
      `${GOOGLE_COOKIE}=${cookie.value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${cookie.secure ? "; Secure" : ""}`,
    );
  }
  headers.append("Set-Cookie", "persona_oauth_state=; Path=/; Max-Age=0");
  return new Response(html, { headers });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const error = url.searchParams.get("error");
  if (error) return finish({ ok: false, reason: error === "access_denied" ? "denied" : error });

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== req.cookies.get("persona_oauth_state")?.value) {
    return finish({ ok: false, reason: "invalid_state" });
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(url.origin),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    console.error("[google] token exchange failed", await tokenRes.text());
    return finish({ ok: false, reason: "token_exchange_failed" });
  }
  const token = (await tokenRes.json()) as { access_token: string; expires_in: number; scope: string };

  const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  }).then((r) => r.json() as Promise<{ email?: string; given_name?: string }>);

  // Google's consent screen lets users untick Gmail while still signing in.
  const gmailScope = token.scope.includes("gmail.readonly");
  const session: GoogleSession = {
    accessToken: token.access_token,
    email: info.email ?? "your Google account",
    expiresAt: Date.now() + (token.expires_in - 60) * 1000,
  };

  return finish(
    { ok: true, email: session.email, gmailScope, givenName: info.given_name ?? null },
    { value: await seal(session), secure: url.protocol === "https:" },
  );
}
