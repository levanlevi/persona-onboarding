import { neon } from "@neondatabase/serverless";
import { after } from "next/server";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

// Fire-and-forget event log. Never throws: a logging failure must not break onboarding.
export async function logEvent(sessionId: string, type: string, payload: unknown = {}) {
  if (!sql) return;
  try {
    await sql`insert into onboarding_events (session_id, type, payload) values (${sessionId}, ${type}, ${JSON.stringify(payload)}::jsonb)`;
  } catch (e) {
    console.error("[log] failed", e);
  }
}

/** Log after the response is sent (keeps the serverless function alive until the write lands). */
export function logLater(sessionId: string, type: string, payload: unknown = {}) {
  try {
    after(() => logEvent(sessionId, type, payload));
  } catch {
    // Outside a request (scripts/evals): just fire it.
    void logEvent(sessionId, type, payload);
  }
}

export { sql };
