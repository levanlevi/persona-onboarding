import { NextResponse } from "next/server";
import { sql } from "./db";

// Sliding-window limits on the Neon table we already have, so a shared link can't run up the
// OpenAI bill. Fails open: if the database is unreachable, the user keeps talking to the bot.

interface Limit {
  key: string; // e.g. "chat:ip:1.2.3.4"
  max: number;
  windowSec: number;
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

async function hit({ key, max, windowSec }: Limit): Promise<boolean> {
  if (!sql) return true;
  // Count the window and record this hit in one round trip.
  const rows = (await sql`
    with recent as (
      select count(*)::int as n from rate_hits
      where bucket = ${key} and created_at > now() - make_interval(secs => ${windowSec})
    ), ins as (
      insert into rate_hits (bucket) select ${key} from recent where recent.n < ${max}
    )
    select n from recent`) as { n: number }[];
  return (rows[0]?.n ?? 0) < max;
}

/** Returns a 429 response if any limit is exceeded, otherwise null. */
export async function rateLimit(limits: Limit[]): Promise<NextResponse | null> {
  try {
    const results = await Promise.all(limits.map(hit));
    if (results.every(Boolean)) return null;
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  } catch (e) {
    console.error("[ratelimit] failed open", e);
    return null;
  }
}

// Occasional cleanup so the table stays tiny.
export async function pruneRateHits() {
  if (!sql || Math.random() > 0.02) return;
  try {
    await sql`delete from rate_hits where created_at < now() - interval '1 day'`;
  } catch {}
}
