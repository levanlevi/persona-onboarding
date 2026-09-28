"use client";

import type { OnboardingState } from "@/lib/types";

const TRIES = [
  "Decline the call, or let it ring out",
  "Hang up halfway through the call",
  "Block the microphone",
  "Give everything in one message",
  "Rename your assistant mid-way",
  "Refuse to connect Gmail",
  "Say “just let me in”",
  "Reload the page mid-call",
  "Go silent on the call",
];

export function SidePanel({
  state,
  onReset,
  onDisconnectGoogle,
}: {
  state: OnboardingState;
  onReset: () => void;
  onDisconnectGoogle: () => void;
}) {
  const slots: [string, string | null, string][] = [
    ["Assistant name", state.agentName, "collected by text"],
    ["Your name", state.userName, "call or text"],
    ["Needs help with", state.helpNeed, "call or text"],
    [
      "Gmail",
      state.gmail ? state.gmail.email : state.gmailDeclined ? "declined" : null,
      state.googleCardSent ? "link sent" : "call or text",
    ],
  ];

  return (
    <aside className="hidden w-[300px] shrink-0 text-[13px] text-neutral-600 lg:block">
      <div className="font-serif text-[28px] leading-tight text-neutral-900">Behind the scenes</div>
      <p className="mt-1 text-neutral-500">
        One shared state feeds both the text agent and the voice agent, so nothing is asked twice.
      </p>

      <div className="mt-5 divide-y divide-neutral-200 rounded-2xl bg-white/70 px-4">
        {slots.map(([label, value, hint]) => (
          <div key={label} className="flex items-start gap-3 py-2.5">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${value ? "bg-emerald-500" : "bg-neutral-300"}`} />
            <div className="min-w-0 flex-1">
              <div className="text-neutral-400">{label}</div>
              <div className="truncate text-neutral-900">{value ?? <span className="text-neutral-400">{hint}</span>}</div>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between py-2.5">
          <span className="text-neutral-400">Stage</span>
          <span className={state.phase === "graduated" ? "font-medium text-emerald-600" : "text-neutral-900"}>
            {state.phase === "graduated" ? "graduated 🎓" : "onboarding"}
          </span>
        </div>
        <div className="py-2.5">
          <div className="text-neutral-400">Calls ({state.callAttempts})</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {state.callOutcomes.length === 0 && <span className="text-neutral-400">none yet</span>}
            {state.callOutcomes.map((o, i) => (
              <span key={i} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px]">
                {o.replace("_", " ")}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 text-neutral-400">Try to break it</div>
      <ul className="mt-1 space-y-0.5">
        {TRIES.map((t) => (
          <li key={t}>· {t}</li>
        ))}
      </ul>

      <div className="mt-5 flex gap-2">
        <button onClick={onReset} className="rounded-full bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700">
          Restart demo
        </button>
        {state.gmail && (
          <button onClick={onDisconnectGoogle} className="rounded-full border border-neutral-300 px-4 py-2 hover:bg-white">
            Disconnect Google
          </button>
        )}
      </div>
    </aside>
  );
}
