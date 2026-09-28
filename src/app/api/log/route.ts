import { NextResponse } from "next/server";
import { logEvent } from "@/lib/db";

export async function POST(req: Request) {
  const { sessionId, type, payload } = await req.json();
  if (typeof sessionId === "string" && typeof type === "string") {
    await logEvent(sessionId.slice(0, 64), type.slice(0, 64), payload ?? {});
  }
  return NextResponse.json({ ok: true });
}
