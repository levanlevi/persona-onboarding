import { after, NextResponse } from "next/server";
import { REALTIME_MODEL } from "@/lib/openai";
import { voiceInstructions } from "@/lib/prompts";
import { logEvent } from "@/lib/db";
import type { AgentVoice, OnboardingState } from "@/lib/types";

const VOICE_IDS: Record<AgentVoice, string> = { masculine: "cedar", feminine: "marin", neutral: "marin" };

const tools = [
  {
    type: "function",
    name: "save_user_name",
    description: "Save what the user wants to be called. Call again if they correct it.",
    parameters: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    type: "function",
    name: "save_help_need",
    description: "Save a short summary, in the user's terms, of one concrete thing they want help with.",
    parameters: {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"],
    },
  },
  {
    type: "function",
    name: "rename_agent",
    description:
      "The user wants to call you something else. Also pass the voice that fits the new name (or the one they asked for); it takes effect from the next call.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        voice: { type: "string", enum: ["masculine", "feminine", "neutral"] },
      },
      required: ["name"],
    },
  },
  {
    type: "function",
    name: "send_google_link",
    description:
      "Text the user a 'Connect with Google' link so they can connect Gmail while on the call. Returns whether it was sent.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "check_google_connection",
    description: "Check whether the user has finished connecting their Google account.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "end_call",
    description:
      "Hang up. Use after wrapping up, or right away if the user is busy or wants to continue over text. Say goodbye BEFORE calling this.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", enum: ["done", "user_busy", "user_prefers_text", "other"] },
      },
      required: ["reason"],
    },
  },
];

export async function POST(req: Request) {
  const { state } = (await req.json()) as { state: OnboardingState };

  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 120 },
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions: voiceInstructions(state),
        audio: {
          input: {
            transcription: { model: "gpt-4o-mini-transcribe" },
            turn_detection: { type: "semantic_vad", eagerness: "high" },
            noise_reduction: { type: "near_field" },
          },
          output: { voice: VOICE_IDS[state.agentVoice ?? "feminine"] ?? "marin" },
        },
        tools,
        tool_choice: "auto",
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[realtime] mint failed", res.status, detail);
    after(() => logEvent(state.sessionId, "realtime_mint_error", { status: res.status, detail }));
    return NextResponse.json({ error: "voice_unavailable" }, { status: 502 });
  }

  const data = (await res.json()) as { value: string };
  after(() => logEvent(state.sessionId, "call_started", { attempt: state.callAttempts }));
  return NextResponse.json({ value: data.value });
}
