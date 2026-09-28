"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CallOutcome, OnboardingState } from "@/lib/types";

export type CallStatus = "idle" | "connecting" | "active" | "ending";

interface Options {
  onTool: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onTranscript: (who: "user" | "agent", text: string) => void;
  onEnd: (outcome: CallOutcome) => void;
  onDebug?: (type: string, payload?: Record<string, unknown>) => void;
}

const SILENCE_CHECK_MS = 14_000; // ask "you there?"
const SILENCE_GIVE_UP_MS = 32_000; // hang up and fall back to text
const WRAP_UP_MS = 4 * 60_000;
const MAX_CALL_MS = 5 * 60_000;

type ServerEvent = {
  type: string;
  transcript?: string;
  response?: { output?: { type: string; name?: string; call_id?: string; arguments?: string }[] };
  error?: { message?: string };
};

export function useRealtimeCall({ onTool, onTranscript, onEnd, onDebug }: Options) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(true);
  const lastActivityRef = useRef(0);
  const startedAtRef = useRef(0);
  const userSpokeRef = useRef(false);
  const checkedInRef = useRef(false);
  const wrapUpSentRef = useRef(false);
  const agentSpeakingRef = useRef(false);
  const pendingEndRef = useRef(false);

  // Keep latest callbacks without re-creating the connection handlers.
  const cb = useRef({ onTool, onTranscript, onEnd, onDebug });
  useEffect(() => {
    cb.current = { onTool, onTranscript, onEnd, onDebug };
  });
  const debug = (type: string, payload: Record<string, unknown> = {}) => {
    console.debug(`[call] ${type}`, payload);
    cb.current.onDebug?.(type, payload);
  };
  const firstAudioRef = useRef(false);

  const send = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (dc?.readyState === "open") dc.send(JSON.stringify(event));
  }, []);

  const teardown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    dcRef.current?.close();
    pcRef.current?.close();
    micRef.current?.getTracks().forEach((t) => t.stop());
    if (audioRef.current) audioRef.current.srcObject = null;
    dcRef.current = null;
    pcRef.current = null;
    micRef.current = null;
    agentSpeakingRef.current = false;
    setAgentSpeaking(false);
    setMuted(false);
  }, []);

  const finish = useCallback(
    (outcome: CallOutcome) => {
      if (endedRef.current) return;
      endedRef.current = true;
      teardown();
      setStatus("idle");
      cb.current.onEnd(outcome);
    },
    [teardown],
  );

  /** Inject an app notice (e.g. "gmail connected") and let the agent react out loud. */
  const sendNotice = useCallback(
    (text: string) => {
      send({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
      });
      send({ type: "response.create" });
    },
    [send],
  );

  const handleFunctionCalls = useCallback(
    async (calls: { name?: string; call_id?: string; arguments?: string }[]) => {
      let ending = false;
      for (const call of calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.arguments || "{}");
        } catch {}
        let output: Record<string, unknown>;
        try {
          output = await cb.current.onTool(call.name ?? "", args);
        } catch (e) {
          output = { ok: false, error: String(e) };
        }
        if (call.name === "end_call") ending = true;
        send({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(output) },
        });
      }
      if (ending) {
        // Let the goodbye finish playing before hanging up.
        pendingEndRef.current = true;
        setStatus("ending");
        const deadline = Date.now() + 7000;
        const waitForSilence = () => {
          if (endedRef.current) return;
          if (!agentSpeakingRef.current || Date.now() > deadline) setTimeout(() => finish("completed"), 400);
          else setTimeout(waitForSilence, 250);
        };
        setTimeout(waitForSilence, 600);
      } else {
        send({ type: "response.create" });
      }
    },
    [finish, send],
  );

  const onServerEvent = useCallback(
    (ev: ServerEvent) => {
      if (ev.type !== "response.output_audio_transcript.delta") console.debug("[rt]", ev.type);
      switch (ev.type) {
        case "session.created":
          debug("rt_session_created");
          break;
        case "input_audio_buffer.speech_started":
          lastActivityRef.current = Date.now();
          userSpokeRef.current = true;
          checkedInRef.current = false;
          break;
        case "conversation.item.input_audio_transcription.completed":
          lastActivityRef.current = Date.now();
          if (ev.transcript?.trim()) cb.current.onTranscript("user", ev.transcript.trim());
          break;
        case "response.output_audio_transcript.done":
          if (ev.transcript?.trim()) cb.current.onTranscript("agent", ev.transcript.trim());
          break;
        case "output_audio_buffer.started":
          if (!firstAudioRef.current) {
            firstAudioRef.current = true;
            debug("rt_agent_audio_started", { paused: audioRef.current?.paused ?? null });
          }
          agentSpeakingRef.current = true;
          setAgentSpeaking(true);
          break;
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared":
          agentSpeakingRef.current = false;
          setAgentSpeaking(false);
          lastActivityRef.current = Date.now();
          break;
        case "response.done": {
          const calls = (ev.response?.output ?? []).filter((o) => o.type === "function_call");
          if (calls.length) void handleFunctionCalls(calls);
          break;
        }
        case "error":
          console.warn("[realtime] error", ev.error?.message);
          debug("rt_error", { message: ev.error?.message ?? "unknown" });
          break;
      }
    },
    [handleFunctionCalls],
  );

  const start = useCallback(
    async (state: OnboardingState) => {
      if (!endedRef.current) return;
      endedRef.current = false;
      pendingEndRef.current = false;
      userSpokeRef.current = false;
      checkedInRef.current = false;
      wrapUpSentRef.current = false;
      setStatus("connecting");

      let mic: MediaStream;
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (e) {
        debug("mic_error", { name: (e as Error)?.name });
        return finish("mic_denied");
      }
      if (endedRef.current) return mic.getTracks().forEach((t) => t.stop());
      micRef.current = mic;
      firstAudioRef.current = false;
      debug("mic_ready", { device: mic.getAudioTracks()[0]?.label ?? "unknown" });

      try {
        const tokenRes = await fetch("/api/realtime/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        });
        if (!tokenRes.ok) throw new Error("mint failed");
        const { value } = (await tokenRes.json()) as { value: string };
        if (endedRef.current) return;

        const pc = new RTCPeerConnection();
        pcRef.current = pc;
        if (!audioRef.current) {
          // Attached to the DOM: some browsers won't route a detached element's MediaStream to the speakers.
          const el = document.createElement("audio");
          el.autoplay = true;
          el.setAttribute("playsinline", "");
          el.style.display = "none";
          document.body.appendChild(el);
          audioRef.current = el;
        }
        pc.ontrack = (e) => {
          const el = audioRef.current;
          if (!el) return;
          el.srcObject = e.streams[0];
          el.play()
            .then(() => debug("audio_playing"))
            .catch((err) => debug("audio_play_blocked", { name: (err as Error)?.name }));
        };
        pc.addTrack(mic.getAudioTracks()[0], mic);
        pc.onconnectionstatechange = () => {
          if (pcRef.current !== pc) return;
          if (pc.connectionState === "failed") finish("dropped");
          // "disconnected" can recover on flaky networks; give it a few seconds.
          if (pc.connectionState === "disconnected")
            setTimeout(() => pcRef.current === pc && pc.connectionState !== "connected" && finish("dropped"), 4000);
        };

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
        dc.onmessage = (m) => {
          try {
            onServerEvent(JSON.parse(m.data));
          } catch {}
        };
        dc.onopen = () => {
          debug("rt_channel_open");
          startedAtRef.current = Date.now();
          lastActivityRef.current = Date.now();
          setStatus("active");
          send({ type: "response.create" }); // agent speaks first
          timerRef.current = setInterval(() => {
            if (endedRef.current || pendingEndRef.current) return;
            const now = Date.now();
            if (now - startedAtRef.current > MAX_CALL_MS) return finish("completed");
            if (!wrapUpSentRef.current && now - startedAtRef.current > WRAP_UP_MS) {
              wrapUpSentRef.current = true;
              sendNotice("[the call is running long. wrap up now: quick recap, goodbye, then end_call.]");
              return;
            }
            if (agentSpeakingRef.current) return;
            const idle = now - lastActivityRef.current;
            if (idle > SILENCE_GIVE_UP_MS) return finish("silent");
            if (idle > SILENCE_CHECK_MS && !checkedInRef.current) {
              checkedInRef.current = true;
              sendNotice(
                "[the user has been silent for a while. check if they're still there, in a light way. if they stay silent, it's fine: you'll continue over text.]",
              );
            }
          }, 1000);
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          body: offer.sdp,
          headers: { Authorization: `Bearer ${value}`, "Content-Type": "application/sdp" },
        });
        if (!sdpRes.ok) {
          debug("sdp_failed", { status: sdpRes.status, body: (await sdpRes.text()).slice(0, 300) });
          throw new Error("sdp failed");
        }
        if (endedRef.current) return;
        await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
      } catch (e) {
        console.warn("[realtime] connect failed", e);
        debug("connect_failed", { error: String(e) });
        finish("dropped");
      }
    },
    [finish, onServerEvent, send, sendNotice],
  );

  const hangup = useCallback(() => {
    finish(pendingEndRef.current ? "completed" : "user_hangup");
  }, [finish]);

  const toggleMute = useCallback(() => {
    const track = micRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  return { status, muted, agentSpeaking, start, hangup, toggleMute, sendNotice };
}
