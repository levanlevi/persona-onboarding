"use client";

import { useEffect, useRef, useState } from "react";
import type { CallOutcome, ChatMessage, OnboardingState } from "@/lib/types";

interface Props {
  state: OnboardingState;
  messages: ChatMessage[];
  typing: boolean;
  onSend: (text: string) => void;
  onConnectGoogle: () => void;
  onCall: () => void;
  onReset: () => void;
  callBar: { startedAt: number | null; onExpand: () => void; onHangup: () => void } | null;
}

export const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export function useTicker(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-b from-neutral-300 to-neutral-400 font-medium text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim().charAt(0).toUpperCase() || "P"}
    </div>
  );
}

export function Thread({ state, messages, typing, onSend, onConnectGoogle, onCall, onReset, callBar }: Props) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const agent = state.agentName ?? "Persona";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const submit = () => {
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <header className="relative z-10 flex items-center gap-3 border-b border-neutral-200/80 bg-white/90 px-4 pb-2 pt-4 backdrop-blur lg:pt-9">
        <button
          onClick={onReset}
          className="text-xs text-neutral-400 hover:text-neutral-700 lg:invisible"
          title="Restart the demo"
        >
          ↺
        </button>
        <div className="flex flex-1 flex-col items-center">
          <Avatar name={agent} size={40} />
          <div className="mt-1 text-[13px] font-medium text-neutral-900">{agent}</div>
          <div className="text-[11px] text-neutral-400">
            {state.phase === "graduated" ? "your personal assistant" : "setting up"}
          </div>
        </div>
        <button
          onClick={onCall}
          aria-label={`Call ${agent}`}
          className="grid h-9 w-9 place-items-center rounded-full text-[#0a84ff] hover:bg-neutral-100"
        >
          <PhoneIcon />
        </button>
      </header>

      {callBar && <CallBar agent={agent} {...callBar} />}

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        <div className="pb-2 text-center text-[11px] text-neutral-400">Today</div>
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const gap = prev && prev.role !== m.role ? "mt-3" : "";
          if (m.kind === "call") return <CallRecord key={m.id} m={m} agent={agent} />;
          if (m.kind === "card")
            return (
              <div key={m.id} className={`flex ${gap}`}>
                {m.card === "contact" && <ContactCard agent={agent} />}
                {m.card === "google" && <GoogleCard state={state} onConnect={onConnectGoogle} />}
                {m.card === "welcome" && <WelcomeCard state={state} onConnect={onConnectGoogle} />}
              </div>
            );
          const mine = m.role === "user";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} ${gap} animate-[pop_.18s_ease-out]`}>
              <div
                className={`max-w-[78%] whitespace-pre-wrap break-words rounded-[20px] px-3.5 py-2 text-[15px] leading-snug ${
                  mine ? "bg-[#0a84ff] text-white" : "bg-[#e9e9eb] text-neutral-900"
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="flex justify-start pt-1">
            <div className="flex gap-1 rounded-[20px] bg-[#e9e9eb] px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-neutral-400"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* composer */}
      <div className="border-t border-neutral-200/80 bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2 rounded-full border border-neutral-300 bg-white py-1 pl-4 pr-1"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message"
            maxLength={2000}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-neutral-400"
            autoFocus
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send"
            className="grid h-8 w-8 place-items-center rounded-full bg-[#0a84ff] text-white transition disabled:opacity-30"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

function CallBar({ agent, startedAt, onExpand, onHangup }: { agent: string } & NonNullable<Props["callBar"]>) {
  const now = useTicker(true);
  const sec = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
  return (
    <div className="flex items-center gap-2 bg-[#30d158] px-4 py-2 text-white">
      <button onClick={onExpand} className="flex flex-1 items-center gap-2 text-left text-[13px] font-medium">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
        {agent} · {fmtDuration(sec)} <span className="font-normal opacity-80">tap to return to call</span>
      </button>
      <button onClick={onHangup} className="rounded-full bg-[#ff3b30] px-3 py-1 text-xs font-medium">
        End
      </button>
    </div>
  );
}

const OUTCOME_LABEL: Record<CallOutcome, string> = {
  completed: "Call",
  user_hangup: "Call ended",
  declined: "Declined call",
  missed: "Missed call",
  dropped: "Call dropped",
  mic_denied: "Call failed: microphone blocked",
  silent: "Call ended: no audio",
};

function CallRecord({ m, agent }: { m: Extract<ChatMessage, { kind: "call" }>; agent: string }) {
  return (
    <div className="my-3 flex flex-col items-center">
      <details className="group w-full max-w-[85%] text-center">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-[12px] text-neutral-500 [&::-webkit-details-marker]:hidden">
          <PhoneIcon size={12} />
          {OUTCOME_LABEL[m.outcome]}
          {m.durationSec > 0 && ` · ${fmtDuration(m.durationSec)}`}
          {m.transcript.length > 0 && <span className="text-neutral-400 group-open:hidden"> · transcript</span>}
        </summary>
        {m.transcript.length > 0 && (
          <div className="mt-2 space-y-1 rounded-2xl bg-neutral-50 p-3 text-left text-[12px] leading-snug text-neutral-600">
            {m.transcript.map((t, i) => (
              <p key={i}>
                <span className="font-medium text-neutral-800">{t.who === "agent" ? agent : "You"}:</span> {t.text}
              </p>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}

function ContactCard({ agent }: { agent: string }) {
  return (
    <div className="flex w-[220px] items-center justify-between rounded-2xl bg-[#e9e9eb] px-4 py-3">
      <div>
        <div className="text-[14px] font-semibold">{agent}</div>
        <div className="text-[12px] text-neutral-500">Persona</div>
      </div>
      <div className="flex items-center gap-1 text-neutral-400">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-lg font-medium text-neutral-800">
          {agent.charAt(0).toUpperCase()}
        </div>
        ›
      </div>
    </div>
  );
}

function Misty({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[150px] overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,#f4f3ef,#d9dcd6_45%,#aab3ab_80%,#8a958c)] p-4">
      <div className="absolute -bottom-6 left-0 right-0 h-16 bg-[radial-gradient(ellipse_at_20%_100%,#6f7d72,transparent_60%),radial-gradient(ellipse_at_75%_100%,#7d8a7f,transparent_55%)] opacity-70" />
      <div className="relative">{children}</div>
    </div>
  );
}

function GoogleCard({ state, onConnect }: { state: OnboardingState; onConnect: () => void }) {
  const connected = Boolean(state.gmail);
  return (
    <div className="w-[270px] overflow-hidden rounded-2xl bg-[#e9e9eb]">
      <Misty>
        <div className="text-[12px] font-medium text-neutral-700">◎ Persona</div>
        <div className="mt-2 text-[24px] font-semibold leading-[1.05] tracking-tight text-neutral-800">
          One tap to a<br />
          quieter life
        </div>
      </Misty>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{connected ? "Google connected" : "Connect your Google account"}</div>
          <div className="truncate text-[11px] text-neutral-500">
            {connected ? state.gmail!.email : "read-only · disconnect anytime"}
          </div>
        </div>
        <button
          onClick={onConnect}
          disabled={connected}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium shadow-sm transition hover:shadow disabled:opacity-60"
        >
          {connected ? "✓ Done" : <><GoogleG /> Connect</>}
        </button>
      </div>
    </div>
  );
}

function WelcomeCard({ state, onConnect }: { state: OnboardingState; onConnect: () => void }) {
  const rows: [string, React.ReactNode][] = [
    ["Assistant", state.agentName ?? "Persona"],
    ["You", state.userName ?? "—"],
    ["Focus", state.helpNeed ?? "we'll figure it out together"],
    [
      "Gmail",
      state.gmail ? (
        state.gmail.email
      ) : (
        <button onClick={onConnect} className="text-[#0a84ff]">
          Connect
        </button>
      ),
    ],
  ];
  return (
    <div className="my-2 w-[280px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <Misty>
        <div className="text-[12px] font-medium text-neutral-700">◎ Persona</div>
        <div className="mt-2 font-serif text-[26px] leading-tight text-neutral-800">You&apos;re all set</div>
      </Misty>
      <div className="divide-y divide-neutral-100 px-4 py-1 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 py-2">
            <span className="text-neutral-400">{k}</span>
            <span className="text-right text-neutral-800">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PhoneIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z" />
    </svg>
  );
}

function GoogleG() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
