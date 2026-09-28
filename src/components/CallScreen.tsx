"use client";

import { useState } from "react";
import type { AudioDevices, AudioIssue, CallStatus } from "@/hooks/useRealtimeCall";
import { canPickSpeaker, shortLabel } from "@/lib/audioDevices";
import { Avatar, fmtDuration, PhoneIcon, useTicker } from "./Thread";

interface Props {
  mode: "incoming" | "live";
  agentName: string;
  status: CallStatus;
  startedAt: number | null;
  muted: boolean;
  agentSpeaking: boolean;
  captions: { who: "user" | "agent"; text: string }[];
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onMinimize: () => void;
  devices: AudioDevices;
  micLevel: number;
  audioIssue: AudioIssue;
  onSwitchInput: (id: string) => void;
  onSwitchOutput: (id: string) => void;
  onRetryAudio: () => void;
}

export function CallScreen(p: Props) {
  const now = useTicker(p.mode === "live");
  const sec = p.startedAt ? Math.max(0, Math.round((now - p.startedAt) / 1000)) : 0;
  const [showAudio, setShowAudio] = useState(false);
  const live = p.mode === "live";
  const input = p.devices.inputs.find((d) => d.deviceId === p.devices.inputId);
  const output = p.devices.outputs.find((d) => d.deviceId === p.devices.outputId);

  const statusLine =
    p.mode === "incoming"
      ? "Persona · incoming call…"
      : p.status === "connecting"
        ? "connecting…"
        : p.status === "ending"
          ? "ending call…"
          : fmtDuration(sec);

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center bg-[radial-gradient(ellipse_at_50%_0%,#5b6b66,#2a3331_55%,#161b1a)] px-6 pb-12 pt-20 text-white animate-[fade_.25s_ease-out]">
      <div className="relative">
        {(p.agentSpeaking || p.mode === "incoming") && (
          <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
        )}
        <Avatar name={p.agentName} size={96} />
      </div>
      <div className="mt-5 text-[28px] font-light">{p.agentName}</div>
      <div className="mt-1 text-[15px] text-white/60">{statusLine}</div>

      {live && p.audioIssue === "blocked" && (
        <button onClick={p.onRetryAudio} className="mt-4 rounded-full bg-white px-4 py-2 text-[13px] font-medium text-neutral-900">
          🔈 Tap to turn on sound
        </button>
      )}
      {live && p.audioIssue === "no_audio" && !showAudio && (
        <button onClick={() => setShowAudio(true)} className="mt-4 rounded-full bg-white/15 px-4 py-2 text-[13px]">
          Can&apos;t hear {p.agentName}? Check your audio
        </button>
      )}

      {/* live captions */}
      <div className="mt-8 flex min-h-[120px] w-full flex-1 flex-col justify-end gap-2 overflow-hidden text-[14px] leading-snug">
        {p.mode === "live" &&
          p.captions.slice(-2).map((c, i) => (
            <p key={i} className={c.who === "agent" ? "text-white/90" : "text-right text-white/50"}>
              {c.text}
            </p>
          ))}
        {p.mode === "live" && p.status === "active" && p.captions.length === 0 && (
          <p className="text-center text-white/40">say hi 👋</p>
        )}
      </div>

      {live && (
        <div className="mt-4 w-full">
          <button
            onClick={() => setShowAudio((v) => !v)}
            className="mx-auto flex max-w-full items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px] text-white/70"
          >
            <LevelBars level={p.muted ? 0 : p.micLevel} />
            <span className="truncate">
              {input ? shortLabel(input.label) : "Microphone"}
              {output && ` · ${shortLabel(output.label)}`}
            </span>
            <span className="text-white/40">{showAudio ? "▴" : "▾"}</span>
          </button>
          {showAudio && (
            <div className="mt-2 space-y-2 rounded-2xl bg-black/30 p-3 text-[12px]">
              <DeviceSelect
                label="Microphone"
                value={p.devices.inputId}
                devices={p.devices.inputs}
                onChange={p.onSwitchInput}
              />
              {canPickSpeaker() && p.devices.outputs.length > 0 && (
                <DeviceSelect
                  label="Speaker"
                  value={p.devices.outputId}
                  devices={p.devices.outputs}
                  onChange={p.onSwitchOutput}
                />
              )}
              <p className="text-white/40">
                Bars should move when you talk. AirPods can switch to your phone when a call starts; pick them here
                again if that happens.
              </p>
            </div>
          )}
        </div>
      )}

      {p.mode === "incoming" ? (
        <div className="mt-8 flex w-full justify-between px-4">
          <RoundButton label="Decline" color="bg-[#ff3b30]" onClick={p.onDecline}>
            <span className="rotate-[135deg]">
              <PhoneIcon size={30} />
            </span>
          </RoundButton>
          <RoundButton label="Accept" color="bg-[#30d158]" onClick={p.onAccept}>
            <PhoneIcon size={30} />
          </RoundButton>
        </div>
      ) : (
        <div className="mt-8 flex w-full justify-between px-2">
          <RoundButton label={p.muted ? "Unmute" : "Mute"} color={p.muted ? "bg-white text-neutral-900" : "bg-white/15"} onClick={p.onToggleMute}>
            <MicIcon off={p.muted} />
          </RoundButton>
          <RoundButton label="Messages" color="bg-white/15" onClick={p.onMinimize}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.6 3.4 6.1L4.5 21l4.3-2.3c1 .2 2.1.3 3.2.3 5.5 0 10-3.6 10-8s-4.5-8-10-8z" />
            </svg>
          </RoundButton>
          <RoundButton label="End" color="bg-[#ff3b30]" onClick={p.onHangup}>
            <span className="rotate-[135deg]">
              <PhoneIcon size={30} />
            </span>
          </RoundButton>
        </div>
      )}
    </div>
  );
}

function RoundButton({
  label,
  color,
  onClick,
  children,
}: {
  label: string;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2">
      <span className={`grid h-[72px] w-[72px] place-items-center rounded-full transition active:scale-95 ${color}`}>
        {children}
      </span>
      <span className="text-[13px] text-white/80">{label}</span>
    </button>
  );
}

function MicIcon({ off }: { off: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0014 0M12 18v3" />
      {off && <path d="M4 4l16 16" strokeWidth="2.5" />}
    </svg>
  );
}

function LevelBars({ level }: { level: number }) {
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden>
      {[0.1, 0.25, 0.45, 0.65, 0.85].map((t, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-sm transition-all ${level > t ? "bg-[#30d158]" : "bg-white/25"}`}
          style={{ height: `${4 + i * 2}px` }}
        />
      ))}
    </span>
  );
}

function DeviceSelect({
  label,
  value,
  devices,
  onChange,
}: {
  label: string;
  value: string;
  devices: MediaDeviceInfo[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-white/50">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 truncate rounded-lg bg-white/10 px-2 py-1.5 text-white outline-none"
      >
        {!devices.some((d) => d.deviceId === value) && <option value="">System default</option>}
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId} className="text-neutral-900">
            {shortLabel(d.label)}
          </option>
        ))}
      </select>
    </label>
  );
}
