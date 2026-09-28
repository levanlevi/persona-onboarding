import { NextResponse } from "next/server";
import { logEvent } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const { sessionId, type, payload } = await req.json();
  if (await rateLimit([{ key: `log:ip:${clientIp(req)}`, max: 400, windowSec: 600 }])) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  if (typeof sessionId === "string" && typeof type === "string") {
    await logEvent(sessionId.slice(0, 64), type.slice(0, 64), payload ?? {});
  }
  return NextResponse.json({ ok: true });
}
