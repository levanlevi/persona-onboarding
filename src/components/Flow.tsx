// Minimal flowchart primitives shared by /how-it-works and /flow.

export type Kind = "start" | "step" | "decision" | "event" | "end" | "voice" | "text";

export const KIND: Record<Kind, string> = {
  start: "bg-neutral-900 text-white border-neutral-900",
  step: "bg-white text-neutral-800 border-neutral-300",
  decision: "bg-amber-50 text-amber-900 border-amber-300 rounded-[999px]",
  event: "bg-rose-50 text-rose-900 border-rose-200 border-dashed",
  end: "bg-emerald-600 text-white border-emerald-600",
  voice: "bg-emerald-50 text-emerald-900 border-emerald-300",
  text: "bg-sky-50 text-sky-900 border-sky-300",
};

export function Node({ kind = "step", children, sub }: { kind?: Kind; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className={`mx-auto w-full max-w-[340px] rounded-xl border px-3.5 py-2.5 text-center text-[13px] leading-snug shadow-sm ${KIND[kind]}`}>
      <div className="font-medium">{children}</div>
      {sub && <div className="mt-0.5 text-[11.5px] opacity-70">{sub}</div>}
    </div>
  );
}

export function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-1 text-neutral-400">
      <div className="h-4 w-px bg-neutral-300" />
      {label && <div className="my-0.5 rounded bg-[#f6f5f2] px-1.5 text-[11px] text-neutral-500">{label}</div>}
      <div className="h-2 w-px bg-neutral-300" />
      <div className="-mt-0.5 text-[10px] leading-none">▼</div>
    </div>
  );
}

export function Branch({ children, cols }: { children: React.ReactNode; cols: number }) {
  return (
    <div
      className="grid gap-x-2 gap-y-2 rounded-2xl border border-dashed border-neutral-200 px-1.5 pb-3 sm:gap-x-3 sm:px-2"
      // Alternatives always sit side by side; stacking them would read as a sequence.
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

export function Lane({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <Arrow label={label} />
      {children}
    </div>
  );
}

