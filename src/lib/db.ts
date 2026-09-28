import { neon } from "@neondatabase/serverless";

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

export { sql };
