import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const url = readFileSync(new URL("../.env", import.meta.url), "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
const sql = neon(url);
await sql`create table if not exists onboarding_events (
  id bigserial primary key,
  session_id text not null,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
)`;
await sql`create index if not exists onboarding_events_session_idx on onboarding_events (session_id, created_at)`;
console.log("migrated");
await sql`create table if not exists rate_hits (
  bucket text not null,
  created_at timestamptz not null default now()
)`;
await sql`create index if not exists rate_hits_bucket_idx on rate_hits (bucket, created_at)`;
console.log("rate_hits ready");
