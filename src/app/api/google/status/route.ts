import { NextResponse } from "next/server";
import { getGoogleSession } from "@/lib/google";

export async function GET() {
  const s = await getGoogleSession();
  return NextResponse.json(s ? { connected: true, email: s.email } : { connected: false });
}
