"use client";

import type { CallStatus } from "@/hooks/useRealtimeCall";
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
}

export function CallScreen(p: Props) {
  const now = useTicker(p.mode === "live");
  const sec = p.startedAt ? Math.max(0, Math.round((now - p.startedAt) / 1000)) : 0;

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
