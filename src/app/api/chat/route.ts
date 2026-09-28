import { after, NextResponse } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { openai, TEXT_MODEL } from "@/lib/openai";
import { textSystemPrompt } from "@/lib/prompts";
import { logEvent } from "@/lib/db";
import type { ChatMessage, OnboardingState, TextEvent, TextTurnResult } from "@/lib/types";

export const maxDuration = 30;

const nullableString = { type: ["string", "null"] };
const nullableBool = { type: ["boolean", "null"] };

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["messages", "updates", "action"],
  properties: {
    messages: { type: "array", items: { type: "string" } },
    updates: {
      type: "object",
      additionalProperties: false,
      required: ["agentName", "userName", "helpNeed", "textOnly", "gmailDeclined"],
      properties: {
        agentName: nullableString,
        userName: nullableString,
        helpNeed: nullableString,
        textOnly: nullableBool,
        gmailDeclined: nullableBool,
      },
    },
    action: { type: "string", enum: ["none", "start_call", "send_google_card", "graduate"] },
  },
} as const;

function toModelMessages(history: ChatMessage[]): ChatCompletionMessageParam[] {
  return history.slice(-40).map((m): ChatCompletionMessageParam => {
    if (m.kind === "text") return { role: m.role, content: m.text };
    if (m.kind === "card") return { role: "assistant", content: `[you sent the ${m.card} card]` };
    const lines = m.transcript.map((t) => `${t.who}: ${t.text}`).join("\n");
    return {
      role: "system",
      content: `[phone call, outcome=${m.outcome}, ${m.durationSec}s]\n${lines || "(nothing was said)"}`,
    };
  });
}

function eventNote(e: TextEvent): string | null {
  switch (e.type) {
    case "user_message":
      return null;
    case "call_ended":
      return `[call_ended outcome=${e.outcome}]\ntranscript:\n${e.transcript || "(nothing was said)"}`;
    case "gmail_connected":
      return `[gmail_connected email=${e.email}]`;
    case "gmail_failed":
      return `[gmail_failed reason=${e.reason}]`;
    case "insight_ready":
      return `[insight_ready] (already sent to the user)\n${e.insight}`;
    case "nudge":
      return "[nudge]";
  }
}

const clean = (v: string | null | undefined, max: number) => {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim().slice(0, max);
  return t.length ? t : undefined;
};

export async function POST(req: Request) {
  const { state, history, event } = (await req.json()) as {
    state: OnboardingState;
    history: ChatMessage[];
    event: TextEvent;
  };

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: textSystemPrompt(state) },
    ...toModelMessages(history),
  ];
  const note = eventNote(event);
  if (note) messages.push({ role: "system", content: note });

  try {
    const completion = await openai.chat.completions.create({
      model: TEXT_MODEL,
      reasoning_effort: "none",
      messages,
      response_format: { type: "json_schema", json_schema: { name: "turn", strict: true, schema } },
    });
    const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as TextTurnResult;

    const result: TextTurnResult = {
      messages: (raw.messages ?? []).map((m) => m.trim()).filter(Boolean).slice(0, 3),
      updates: {
        agentName: clean(raw.updates?.agentName, 40),
        userName: clean(raw.updates?.userName, 40),
        helpNeed: clean(raw.updates?.helpNeed, 200),
        textOnly: raw.updates?.textOnly ?? undefined,
        gmailDeclined: raw.updates?.gmailDeclined ?? undefined,
      },
      action: raw.action ?? "none",
    };

    after(() => logEvent(state.sessionId, "text_turn", { event, result }));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[chat]", err);
    after(() => logEvent(state.sessionId, "text_error", { event, error: String(err) }));
    return NextResponse.json({ error: "brain_unavailable" }, { status: 502 });
  }
}
