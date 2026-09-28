import { NextResponse } from "next/server";
import { getGoogleSession, GOOGLE_COOKIE } from "@/lib/google";

export async function POST() {
  const s = await getGoogleSession();
  if (s) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(s.accessToken)}`, {
      method: "POST",
    }).catch(() => {});
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(GOOGLE_COOKIE);
  return res;
}
