import Link from "next/link";
import { Node, type Kind } from "@/components/Flow";

export const metadata = { title: "Decision tree · Persona Onboarding" };

// Main path runs down the left column; each "way off it" exits to the right.
const ROW = "grid grid-cols-[minmax(0,1.15fr)_56px_minmax(0,1fr)] items-center sm:grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)]";

function Main({ kind = "step", children, sub }: { kind?: Kind; children: React.ReactNode; sub?: string }) {
  return (
    <div className={ROW}>
      <Node kind={kind} sub={sub}>
        {children}
      </Node>
    </div>
  );
}

function Decision({ q, exitLabel, exit, exitSub }: { q: string; exitLabel: string; exit: string; exitSub?: string }) {
  return (
    <div className={ROW}>
      <Node kind="decision">{q}</Node>
      <div className="flex flex-col items-center px-1 text-center text-[10.5px] leading-tight text-neutral-500">
        <span>{exitLabel}</span>
        <span className="mt-0.5 flex w-full items-center text-neutral-400">
          <span className="h-px flex-1 bg-neutral-300" />▶
        </span>
      </div>
      <Node kind="event" sub={exitSub}>
        {exit}
      </Node>
    </div>
  );
}

function Down({ label }: { label?: string }) {
  return (
    <div className={ROW}>
      <div className="flex flex-col items-center py-1 text-neutral-400">
        <div className="h-3 w-px bg-neutral-300" />
        {label && <div className="my-0.5 rounded bg-[#f6f5f2] px-1.5 text-[11px] text-neutral-500">{label}</div>}
        <div className="h-2 w-px bg-neutral-300" />
        <div className="-mt-0.5 text-[10px] leading-none">▼</div>
      </div>
    </div>
  );
}

export default function Flow() {
  return (
    <main className="min-h-dvh bg-[#eceae6] px-4 py-10 text-neutral-800 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-[13px] text-neutral-500 hover:text-neutral-900">
          ← back to the demo
        </Link>
        <h1 className="mt-3 font-serif text-[40px] leading-[1.05] text-neutral-900 sm:text-[48px]">
          The happy path, and every way off it
        </h1>
        <p className="mt-2 text-[14px] text-neutral-600">
          Every exit on the right continues by text and rejoins the main path. Nothing missing ever blocks the user.
        </p>

        <div className="mt-8 rounded-3xl border border-neutral-200 bg-[#fbfaf8] p-4 sm:p-8">
          <div className={`${ROW} mb-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400`}>
            <div className="text-center">happy path</div>
            <div />
            <div className="text-center">way off it</div>
          </div>

          <Main kind="start">Intro texts</Main>
          <Down />
          <Main kind="text">“what do you want to call me?”</Main>
          <Down label="agent named" />
          <Decision q="Can they talk?" exitLabel="no" exit="Stay in text" />
          <Down label="yes" />
          <Main kind="text">Phone rings</Main>
          <Down />
          <Decision q="Pick up?" exitLabel="decline · no answer · mic blocked" exit="“no worries, let’s text”" />
          <Down label="accept" />
          <Main kind="voice" sub="name · what they need · Google link">
            Intro call
          </Main>
          <Down />
          <Decision q="Call ends well?" exitLabel="hang-up · drop · silence" exit="“we got cut off”" exitSub="recap, continue by text" />
          <Down label="yes" />
          <Main kind="voice">Recap + goodbye</Main>
          <Down label="anything missing → asked by text" />
          <Decision q="Connect Gmail?" exitLabel="no · cancelled" exit="Respect it" exitSub="mention once later" />
          <Down label="yes" />
          <Main kind="text">Inbox insight (first win)</Main>
          <Down />
          <Main kind="end">Graduated: “you’re all set”</Main>

          <div className="mt-6 rounded-2xl border border-dashed border-emerald-400 bg-emerald-50/60 p-3 text-center text-[13px] text-emerald-900">
            <span className="font-medium">Shortcut from any step:</span> “just let me in” → graduated
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] text-neutral-500">
          More detail:{" "}
          <Link href="/how-it-works" className="underline">
            how it works
          </Link>
        </p>
      </div>
    </main>
  );
}
