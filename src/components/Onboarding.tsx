"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeCall } from "@/hooks/useRealtimeCall";
import { startRingtone, stopRingtone } from "@/lib/ringtone";
import {
  initialState,
  type CallOutcome,
  type CardKind,
  type ChatMessage,
  type OnboardingState,
  type TextEvent,
  type TextTurnResult,
} from "@/lib/types";
import { Thread } from "./Thread";
import { CallScreen } from "./CallScreen";
import { SidePanel } from "./SidePanel";

const STORAGE_KEY = "persona-onboarding-v1";
const NUDGE_AFTER_MS = 45_000;
const MAX_NUDGES = 2;
const MISSED_CALL_MS = 25_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = () => crypto.randomUUID();
const cleanName = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 40) : "");

type CallUi = "none" | "incoming" | "live";
type GoogleResult = { type: "persona-google"; ok: boolean; email?: string; gmailScope?: boolean; reason?: string };

const INTRO = [
  "hey! i'm your new personal assistant",
  "you can text me or call me anytime and i can help with:\n📞 calling places on your behalf\n💻 browsing the web\n🛍️ shopping for you\n✉️ managing your email and calendar\n🚗 finding DoorDash or Uber options",
  "first things first: what do you want to call me?",
];

export function Onboarding() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [callUi, setCallUi] = useState<CallUi>("none");
  const [minimized, setMinimized] = useState(false);
  const [captions, setCaptions] = useState<{ who: "user" | "agent"; text: string }[]>([]);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);

  const stateRef = useRef<OnboardingState>(null!);
  const msgsRef = useRef<ChatMessage[]>([]);
  const callUiRef = useRef<CallUi>("none");
  const transcriptRef = useRef<{ who: "user" | "agent"; text: string }[]>([]);
  const callStartRef = useRef(0);
  const missedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<TextEvent[]>([]);
  const busyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(0);
  const nudgesRef = useRef(0);
  const lastGoogleRef = useRef(0);
  const introRunningRef = useRef(false);
  const ringRef = useRef<() => void>(() => {});
  const bootedRef = useRef(false);
  const callRef = useRef<ReturnType<typeof useRealtimeCall> | null>(null);

  // ---------- state helpers (refs mirror state so async callbacks never see stale values) ----------
  const patch = useCallback((p: Partial<OnboardingState>) => {
    stateRef.current = { ...stateRef.current, ...p };
    setState(stateRef.current);
  }, []);

  const push = useCallback((m: ChatMessage) => {
    msgsRef.current = [...msgsRef.current, m];
    setMessages(msgsRef.current);
    lastActivityRef.current = Date.now();
  }, []);

  const say = useCallback((text: string) => push({ id: uid(), role: "assistant", kind: "text", text, at: Date.now() }), [push]);
  const card = useCallback((c: CardKind) => push({ id: uid(), role: "assistant", kind: "card", card: c, at: Date.now() }), [push]);

  const setCall = useCallback((v: CallUi) => {
    callUiRef.current = v;
    setCallUi(v);
  }, []);

  const log = useCallback((type: string, payload: unknown = {}) => {
    const sessionId = stateRef.current?.sessionId;
    if (!sessionId) return;
    void fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, type, payload }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  // ---------- text brain ----------
  const applyResult = useCallback(
    async (r: TextTurnResult) => {
      const prev = stateRef.current;
      const u = r.updates;
      const p: Partial<OnboardingState> = {};
      if (u.agentName) p.agentName = u.agentName;
      if (u.userName) p.userName = u.userName;
      if (u.helpNeed) p.helpNeed = u.helpNeed;
      if (typeof u.textOnly === "boolean") p.textOnly = u.textOnly;
      if (typeof u.gmailDeclined === "boolean") p.gmailDeclined = u.gmailDeclined;
      if (Object.keys(p).length) patch(p);

      for (let i = 0; i < r.messages.length; i++) {
        if (i > 0) {
          setTyping(true);
          await sleep(Math.min(1400, 450 + r.messages[i].length * 12));
          setTyping(false);
        }
        say(r.messages[i]);
      }

      if (!prev.agentName && stateRef.current.agentName) {
        await sleep(350);
        card("contact");
      }

      switch (r.action) {
        case "start_call":
          if (callUiRef.current === "none") setTimeout(() => ringRef.current(), 1500);
          break;
        case "send_google_card":
          if (!stateRef.current.gmail) {
            await sleep(300);
            card("google");
            patch({ googleCardSent: true });
          }
          break;
        case "graduate":
          if (stateRef.current.phase === "onboarding") {
            patch({ phase: "graduated" });
            await sleep(400);
            card("welcome");
            log("graduated", { state: stateRef.current });
          }
          break;
      }
    },
    [card, log, patch, say],
  );

  const think = useCallback(
    async (event: TextEvent) => {
      // Several quick user messages collapse into one turn: history already contains all of them.
      if (event.type === "user_message" && queueRef.current.some((e) => e.type === "user_message")) return;
      queueRef.current.push(event);
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        while (queueRef.current.length) {
          const ev = queueRef.current.shift()!;
          setTyping(true);
          let result: TextTurnResult | null = null;
          for (let attempt = 0; attempt < 2 && !result; attempt++) {
            try {
              const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: stateRef.current, history: msgsRef.current, event: ev }),
              });
              if (res.ok) result = await res.json();
            } catch {}
          }
          setTyping(false);
          if (result) await applyResult(result);
          else if (ev.type === "user_message") say("sorry, my brain blanked for a sec. mind saying that again?");
        }
      } finally {
        busyRef.current = false;
        setTyping(false);
      }
    },
    [applyResult, say],
  );

  // ---------- calls ----------
  const onCallEnded = useCallback(
    (outcome: CallOutcome) => {
      stopRingtone();
      if (missedTimerRef.current) clearTimeout(missedTimerRef.current);
      setCall("none");
      setMinimized(false);
      setCallStartedAt(null);
      const transcript = transcriptRef.current;
      transcriptRef.current = [];
      const durationSec = callStartRef.current ? Math.round((Date.now() - callStartRef.current) / 1000) : 0;
      callStartRef.current = 0;
      push({ id: uid(), role: "system", kind: "call", outcome, durationSec, transcript, at: Date.now() });
      patch({ callOutcomes: [...stateRef.current.callOutcomes, outcome] });
      log("call_ended", { outcome, durationSec, turns: transcript.length });
      void think({
        type: "call_ended",
        outcome,
        transcript: transcript.map((t) => `${t.who}: ${t.text}`).join("\n"),
      });
    },
    [log, patch, push, setCall, think],
  );

  const handleGoogleConnected = useCallback(
    async (email: string) => {
      if (stateRef.current.gmail?.email === email) return;
      patch({ gmail: { email }, gmailDeclined: false });
      log("gmail_connected");
      const onCall = callUiRef.current === "live";
      if (onCall) {
        say(`connected ✓ ${email}`);
        callRef.current?.sendNotice(
          `[the user just connected their google account (${email}) while on the call. thank them in a few words. you're now taking a quick look at their inbox; you'll get another notice with what you found, keep the conversation going meanwhile.]`,
        );
      } else {
        await think({ type: "gmail_connected", email });
      }

      try {
        const res = await fetch("/api/google/insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: stateRef.current.sessionId,
            helpNeed: stateRef.current.helpNeed,
            userName: stateRef.current.userName,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { insight } = (await res.json()) as { insight: string };
        const parts = insight.split(/\n\s*---\s*\n/).map((s) => s.trim()).filter(Boolean);
        for (const [i, part] of parts.entries()) {
          if (i) await sleep(900);
          say(part);
        }
        patch({ insight });
        if (callUiRef.current === "live") {
          callRef.current?.sendNotice(
            `[you just texted them this from their inbox: "${insight.replace(/\n\s*---\s*\n/g, " ")}". mention the gist out loud in one short sentence, then continue.]`,
          );
        } else {
          await think({ type: "insight_ready", insight });
        }
      } catch (e) {
        console.warn("[insight]", e);
        if (callUiRef.current !== "live") void think({ type: "gmail_failed", reason: "connected, but reading the inbox failed" });
      }
    },
    [log, patch, say, think],
  );

  const onTool = useCallback(
    async (name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> => {
      log("voice_tool", { name, args: name === "save_help_need" ? { summary: args.summary } : args });
      switch (name) {
        case "save_user_name": {
          const v = cleanName(args.name);
          if (v) patch({ userName: v });
          return { ok: Boolean(v) };
        }
        case "save_help_need": {
          const v = typeof args.summary === "string" ? args.summary.trim().slice(0, 200) : "";
          if (v) patch({ helpNeed: v });
          return { ok: Boolean(v) };
        }
        case "rename_agent": {
          const v = cleanName(args.name);
          if (v) patch({ agentName: v });
          return { ok: Boolean(v), note: "you now go by this name" };
        }
        case "send_google_link": {
          if (stateRef.current.gmail) return { already_connected: true, email: stateRef.current.gmail.email };
          card("google");
          patch({ googleCardSent: true });
          setMinimized(true); // show the thread so they can tap it without hanging up
          return { sent: true, note: "the link is now in their messages; the call keeps going while they tap it" };
        }
        case "check_google_connection": {
          if (stateRef.current.gmail) return { connected: true, email: stateRef.current.gmail.email };
          try {
            const s = (await fetch("/api/google/status").then((r) => r.json())) as { connected: boolean; email?: string };
            if (s.connected && s.email) {
              void handleGoogleConnected(s.email);
              return { connected: true, email: s.email };
            }
          } catch {}
          return { connected: false };
        }
        case "end_call":
          return { ok: true };
        default:
          return { ok: false, error: "unknown tool" };
      }
    },
    [card, handleGoogleConnected, log, patch],
  );

  const onTranscript = useCallback((who: "user" | "agent", text: string) => {
    transcriptRef.current.push({ who, text });
    setCaptions((c) => [...c.slice(-3), { who, text }]);
  }, []);

  const call = useRealtimeCall({ onTool, onTranscript, onEnd: onCallEnded, onDebug: log });
  useEffect(() => {
    callRef.current = call;
  });

  const ring = useCallback(() => {
    if (callUiRef.current !== "none") return;
    patch({ callAttempts: stateRef.current.callAttempts + 1 });
    setCall("incoming");
    startRingtone();
    log("call_ringing");
    missedTimerRef.current = setTimeout(() => {
      if (callUiRef.current === "incoming") onCallEnded("missed");
    }, MISSED_CALL_MS);
  }, [log, onCallEnded, patch, setCall]);
  useEffect(() => {
    ringRef.current = ring;
  }, [ring]);

  const goLive = useCallback(() => {
    stopRingtone();
    if (missedTimerRef.current) clearTimeout(missedTimerRef.current);
    transcriptRef.current = [];
    setCaptions([]);
    callStartRef.current = Date.now();
    setCallStartedAt(Date.now());
    setMinimized(false);
    setCall("live");
    void callRef.current?.start(stateRef.current);
  }, [setCall]);

  const accept = useCallback(() => {
    log("call_accepted");
    goLive();
  }, [goLive, log]);

  const decline = useCallback(() => {
    if (callUiRef.current !== "incoming") return;
    callStartRef.current = 0;
    onCallEnded("declined");
  }, [onCallEnded]);

  // User taps the phone icon: they're calling us.
  const callNow = useCallback(() => {
    if (callUiRef.current !== "none") return;
    if (!stateRef.current.agentName) {
      say("happy to hop on a call! just tell me what you want to call me first");
      return;
    }
    patch({ callAttempts: stateRef.current.callAttempts + 1, textOnly: false });
    log("call_user_initiated");
    goLive();
  }, [goLive, log, patch, say]);

  // ---------- user input ----------
  const send = useCallback(
    (text: string) => {
      const t = text.trim().slice(0, 2000);
      if (!t) return;
      push({ id: uid(), role: "user", kind: "text", text: t, at: Date.now() });
      nudgesRef.current = 0;
      log("user_message", { chars: t.length });
      if (callUiRef.current === "live") {
        // Texting mid-call (e.g. "can't talk, text me"): the voice agent should hear about it.
        callRef.current?.sendNotice(`[the user just texted you during the call: "${t}"]`);
        return;
      }
      if (callUiRef.current === "incoming" && /\b(no|can'?t|busy|later|text)\b/i.test(t)) decline();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void think({ type: "user_message" }), 900);
    },
    [decline, log, push, think],
  );

  // ---------- google ----------
  const onGoogleResult = useCallback(
    (r: GoogleResult) => {
      if (Date.now() - lastGoogleRef.current < 3000) return; // popup + BroadcastChannel both deliver
      lastGoogleRef.current = Date.now();
      if (r.ok && r.email && r.gmailScope) {
        void handleGoogleConnected(r.email);
        return;
      }
      const reason = !r.ok
        ? r.reason === "denied"
          ? "the user cancelled on google's screen"
          : `google error: ${r.reason}`
        : "they signed in but unticked the gmail permission box, so you can't read their inbox";
      log("gmail_failed", { reason });
      if (callUiRef.current === "live") callRef.current?.sendNotice(`[google connection didn't work: ${reason}. reassure them, it's optional.]`);
      else void think({ type: "gmail_failed", reason });
    },
    [handleGoogleConnected, log, think],
  );

  const connectGoogle = useCallback(() => {
    log("gmail_link_tapped");
    const w = 500,
      h = 640;
    const popup = window.open(
      "/api/google/start",
      "persona-google",
      `width=${w},height=${h},left=${window.screenX + (window.outerWidth - w) / 2},top=${window.screenY + 60}`,
    );
    if (!popup) {
      // Popup blocked (common on mobile): full redirect; state is persisted and resumes on return.
      window.location.href = "/api/google/start";
    }
  }, [log]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "persona-google") onGoogleResult(e.data);
    };
    window.addEventListener("message", onMsg);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("persona-google");
      bc.onmessage = (e) => e.data?.type === "persona-google" && onGoogleResult(e.data);
    } catch {}
    return () => {
      window.removeEventListener("message", onMsg);
      bc?.close();
    };
  }, [onGoogleResult]);

  // ---------- boot: restore or start fresh ----------
  useEffect(() => {
    // Strict Mode mounts effects twice in dev; boot (intro script, logging) must run once.
    if (bootedRef.current) return;
    bootedRef.current = true;
    let saved: { state: OnboardingState; messages: ChatMessage[]; callUi: CallUi } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    } catch {}

    if (saved?.state?.sessionId) {
      stateRef.current = saved.state;
      msgsRef.current = saved.messages ?? [];
      // Hydrating from localStorage can only happen after mount (no storage during SSR).
      setState(saved.state);
      setMessages(msgsRef.current);
      // Reloaded mid-call: the call is gone, so treat it as dropped and let the text agent pick up.
      if (saved.callUi === "live") {
        log("resumed_after_reload_mid_call");
        onCallEnded("dropped");
      }
    } else {
      lastActivityRef.current = Date.now();
      stateRef.current = initialState(uid());
      setState(stateRef.current);
      log("session_started", { ua: navigator.userAgent });
      introRunningRef.current = true;
      (async () => {
        for (const [i, line] of INTRO.entries()) {
          setTyping(true);
          await sleep(i === 0 ? 700 : 1100);
          setTyping(false);
          say(line);
        }
        introRunningRef.current = false;
      })();
    }

    // Returning from the full-page Google redirect (popup was blocked).
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (g) {
      window.history.replaceState(null, "", "/");
      if (g === "ok") {
        fetch("/api/google/status")
          .then((r) => r.json())
          .then((s: { connected: boolean; email?: string }) => {
            if (s.connected && s.email) void handleGoogleConnected(s.email);
          })
          .catch(() => {});
      } else {
        onGoogleResult({ type: "persona-google", ok: false, reason: "denied" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist everything so a reload resumes exactly where the user was.
  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, messages, callUi }));
    } catch {}
  }, [state, messages, callUi]);

  // Gentle nudge when the user goes quiet mid-onboarding.
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      if (!s || s.phase !== "onboarding" || callUiRef.current !== "none") return;
      if (busyRef.current || introRunningRef.current || nudgesRef.current >= MAX_NUDGES) return;
      const last = msgsRef.current.at(-1);
      if (!last || last.role === "user") return;
      if (Date.now() - lastActivityRef.current < NUDGE_AFTER_MS * (nudgesRef.current + 1)) return;
      nudgesRef.current += 1;
      void think({ type: "nudge" });
    }, 5000);
    return () => clearInterval(id);
  }, [think]);

  const reset = useCallback(async () => {
    callRef.current?.hangup();
    stopRingtone();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    await fetch("/api/google/disconnect", { method: "POST" }).catch(() => {});
    window.location.href = "/";
  }, []);

  const disconnectGoogle = useCallback(async () => {
    await fetch("/api/google/disconnect", { method: "POST" }).catch(() => {});
    patch({ gmail: null });
    log("gmail_disconnected");
    say("done, i've disconnected your google account. you can reconnect anytime.");
  }, [log, patch, say]);

  if (!state) return <div className="min-h-dvh bg-neutral-100" />;

  return (
    <div className="min-h-dvh w-full bg-[#eceae6] lg:flex lg:h-dvh lg:items-center lg:justify-center lg:gap-10 lg:p-6">
      <div className="relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-white lg:h-[clamp(640px,calc(100dvh-3rem),860px)] lg:rounded-[48px] lg:border-[10px] lg:border-neutral-900 lg:shadow-2xl">
        <Thread
          state={state}
          messages={messages}
          typing={typing}
          onSend={send}
          onConnectGoogle={connectGoogle}
          onCall={callNow}
          onReset={reset}
          callBar={
            callUi === "live" && minimized
              ? { startedAt: callStartedAt, onExpand: () => setMinimized(false), onHangup: call.hangup }
              : null
          }
        />
        {(callUi === "incoming" || (callUi === "live" && !minimized)) && (
          <CallScreen
            mode={callUi === "incoming" ? "incoming" : "live"}
            agentName={state.agentName ?? "Persona"}
            status={call.status}
            startedAt={callStartedAt}
            muted={call.muted}
            agentSpeaking={call.agentSpeaking}
            captions={captions}
            onAccept={accept}
            onDecline={decline}
            onHangup={call.hangup}
            onToggleMute={call.toggleMute}
            onMinimize={() => setMinimized(true)}
            devices={call.devices}
            micLevel={call.micLevel}
            audioIssue={call.audioIssue}
            onSwitchInput={call.switchInput}
            onSwitchOutput={call.switchOutput}
            onRetryAudio={call.retryAudio}
          />
        )}
      </div>
      <SidePanel state={state} onReset={reset} onDisconnectGoogle={disconnectGoogle} />
    </div>
  );
}
