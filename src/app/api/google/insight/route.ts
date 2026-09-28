import { after, NextResponse } from "next/server";
import { getGoogleSession } from "@/lib/google";
import { openai, TEXT_MODEL } from "@/lib/openai";
import { insightPrompt } from "@/lib/prompts";
import { logEvent } from "@/lib/db";

export const maxDuration = 30;

interface GmailHeader { name: string; value: string }
interface GmailMessage { snippet?: string; payload?: { headers?: GmailHeader[] } }

async function recentInbox(token: string) {
  const auth = { Authorization: `Bearer ${token}` };
  const list = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=" +
      encodeURIComponent("in:inbox newer_than:21d"),
    { headers: auth },
  );
  if (list.status === 403) return { error: "no_gmail_scope" as const };
  if (!list.ok) return { error: "gmail_error" as const };
  const { messages = [] } = (await list.json()) as { messages?: { id: string }[] };

  const details = await Promise.all(
    messages.map((m) =>
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: auth },
      )
        .then((r) => (r.ok ? (r.json() as Promise<GmailMessage>) : null))
        .catch(() => null),
    ),
  );

  const lines = details
    .filter((d): d is GmailMessage => Boolean(d))
    .map((d) => {
      const h = (n: string) => d.payload?.headers?.find((x) => x.name === n)?.value ?? "";
      return `- from: ${h("From")} | subject: ${h("Subject")} | date: ${h("Date")} | snippet: ${(d.snippet ?? "").slice(0, 140)}`;
    });
  return { lines };
}

export async function POST(req: Request) {
  const { sessionId, helpNeed, userName } = (await req.json()) as {
    sessionId: string;
    helpNeed: string | null;
    userName: string | null;
  };
  const s = await getGoogleSession();
  if (!s) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const inbox = await recentInbox(s.accessToken);
  if ("error" in inbox) {
    after(() => logEvent(sessionId, "insight_error", { error: inbox.error }));
    return NextResponse.json({ error: inbox.error }, { status: 400 });
  }

  const completion = await openai.chat.completions.create({
    model: TEXT_MODEL,
    reasoning_effort: "none",
    messages: [
      {
        role: "user",
        content: insightPrompt(helpNeed, userName, inbox.lines.join("\n") || "(inbox is empty for the last 3 weeks)"),
      },
    ],
  });
  const insight = completion.choices[0]?.message?.content?.trim() ?? "";
  // Only the count is logged; inbox content never goes to the database.
  after(() => logEvent(sessionId, "insight_ready", { emailsScanned: inbox.lines.length }));
  return NextResponse.json({ insight, emailsScanned: inbox.lines.length });
}
