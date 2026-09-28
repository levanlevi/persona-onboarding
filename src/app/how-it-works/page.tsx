import Link from "next/link";
import { Arrow, Branch, KIND, Lane, Node, type Kind } from "@/components/Flow";

export const metadata = { title: "How it works · Persona Onboarding" };

function Section({ n, title, lead, children }: { n: number; title: string; lead: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-[#fbfaf8] p-5 sm:p-8">
      <div className="text-[12px] font-medium uppercase tracking-wider text-neutral-400">0{n}</div>
      <h2 className="mt-1 font-serif text-[30px] leading-tight text-neutral-900">{title}</h2>
      <p className="mt-2 max-w-2xl text-[14px] text-neutral-600">{lead}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Legend() {
  const items: [Kind, string][] = [
    ["text", "text agent"],
    ["voice", "voice agent"],
    ["decision", "user choice"],
    ["event", "failure → event"],
    ["end", "graduated"],
  ];
  return (
    <div className="flex flex-wrap gap-2 text-[12px]">
      {items.map(([k, l]) => (
        <span key={k} className={`rounded-full border px-2.5 py-0.5 ${KIND[k]}`}>
          {l}
        </span>
      ))}
    </div>
  );
}

export default function HowItWorks() {
  return (
    <main className="min-h-dvh bg-[#eceae6] px-4 py-10 text-neutral-800 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-3">
          <Link href="/" className="text-[13px] text-neutral-500 hover:text-neutral-900">
            ← back to the demo
          </Link>
          <h1 className="font-serif text-[44px] leading-[1.05] text-neutral-900 sm:text-[56px]">How the onboarding behaves</h1>
          <p className="max-w-2xl text-[15px] text-neutral-600">
            The goal isn&apos;t to fill four fields. It&apos;s to show the user their assistant is useful as fast as
            possible, while quietly picking up what we need along the way: the agent&apos;s name (text only), the
            user&apos;s name, what they need help with, and a connected Gmail.
          </p>
          <Legend />
        </header>

        {/* 1. Architecture */}
        <Section
          n={1}
          title="One brain, two channels"
          lead="Text and voice are two front-ends onto the same state. Whatever is learned on the call is instantly true in the thread, and the reverse, so nothing is asked twice and a dropped call loses nothing."
        >
          <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1.1fr_auto_1fr]">
            <div className="space-y-2">
              <Node kind="text" sub="gpt-5.5 · structured output: messages + updates + one action">
                Text agent <code className="text-[11px]">/api/chat</code>
              </Node>
              <Node kind="voice" sub="gpt-realtime-2.1 over WebRTC, browser runs its tools">
                Voice agent <code className="text-[11px]">/api/realtime/session</code>
              </Node>
            </div>
            <div className="hidden items-center text-neutral-400 md:flex">⇄</div>
            <div className="rounded-2xl border-2 border-neutral-900 bg-white p-4 text-[13px]">
              <div className="text-center font-medium">Shared onboarding state</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[12px] text-neutral-600">
                {["agentName", "userName", "helpNeed", "gmail", "phase", "callOutcomes[]", "textOnly", "gmailDeclined"].map((f) => (
                  <code key={f} className="rounded bg-neutral-100 px-1.5 py-0.5 text-center">
                    {f}
                  </code>
                ))}
              </div>
              <div className="mt-2 text-center text-[11.5px] text-neutral-500">
                persisted in the browser, so a reload resumes exactly where you were
              </div>
            </div>
            <div className="hidden items-center text-neutral-400 md:flex">⇄</div>
            <div className="space-y-2">
              <Node sub="read-only scope, token in an encrypted HTTP-only cookie">Google OAuth → Gmail</Node>
              <Node sub="every call outcome, tool call and turn, never email content">Neon event log</Node>
            </div>
          </div>
        </Section>

        {/* 2. Main flow */}
        <Section
          n={2}
          title="The happy path, and every way off it"
          lead="The call is the preferred path for everything except the agent's name. At any point the user can skip ahead: missing pieces never block them, they get gently picked up later."
        >
          <div className="mx-auto max-w-3xl">
            <Node kind="start" sub="scripted, instant: capabilities + first question">
              Intro texts
            </Node>
            <Arrow />
            <Node kind="text" sub="accepts messy answers (“Levi - Assistante” → Levi), suggests one if they don't care">
              “what do you want to call me?”
            </Node>
            <Arrow label="name set → contact card" />
            <Node kind="decision">Did the user say they can&apos;t talk / text only?</Node>
            <Branch cols={2}>
              <Lane label="no">
                <Node kind="text" sub="“i'll give you a quick call, it's faster than texting”">Phone rings</Node>
                <Arrow />
                <Node kind="decision">Incoming call</Node>
                <Branch cols={2}>
                  <Lane label="accept">
                    <Node kind="voice" sub="greets by name, one question at a time">
                      Intro call
                    </Node>
                  </Lane>
                  <Lane label="decline / 25s no answer">
                    <Node kind="event" sub="continue by text, don't ring again uninvited">
                      declined · missed
                    </Node>
                  </Lane>
                </Branch>
              </Lane>
              <Lane label="yes">
                <Node kind="text" sub="textOnly = true, reassures, carries on">
                  Stay in text
                </Node>
              </Lane>
            </Branch>

            <Arrow label="on the call or by text, in any order" />
            <div className="grid gap-2 sm:grid-cols-3">
              <Node kind="voice" sub="save_user_name">
                Your name
              </Node>
              <Node kind="voice" sub="save_help_need: short, in their words; offers ideas if vague">
                What you need help with
              </Node>
              <Node kind="voice" sub="send_google_link → card lands in the thread, call keeps going">
                Connect Google
              </Node>
            </div>
            <Arrow label="gmail connected" />
            <Node kind="text" sub="reads 25 recent inbox emails (metadata), finds one specific actionable thing tied to their need">
              First win: an inbox insight
            </Node>
            <Arrow />
            <Node kind="voice" sub="recap, “text or call me anytime”, end_call after the goodbye finishes playing">
              Wrap up the call
            </Node>
            <Arrow />
            <Node kind="end" sub="summary card: assistant, you, focus, gmail">
              Graduated: “you&apos;re all set”
            </Node>

            <div className="mt-6 rounded-2xl border border-dashed border-emerald-400 bg-emerald-50/60 p-4 text-[13px] text-emerald-900">
              <span className="font-medium">Early graduation, from any step:</span> “just let me in”, clear impatience,
              or the user already knows what they want → graduate immediately. Missing Gmail is never a blocker; the
              assistant mentions it at most once later, when it&apos;s relevant.
            </div>
          </div>
        </Section>

        {/* 3. Call failures */}
        <Section
          n={3}
          title="Every call ending is an event, not an error"
          lead="Each way a call can end becomes a record in the thread (with transcript) plus an event for the text agent, which reacts honestly and continues with whatever is still missing."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["completed", "agent called end_call", "short recap + next step"],
              ["user_hangup", "you pressed End mid-call", "“looks like we got cut off” + what it heard"],
              ["dropped", "network failed, or page reloaded mid-call", "same as a hang-up, picks up by text"],
              ["silent", "no speech: check-in at 14s, gives up at 32s", "“couldn't hear you”, continues by text"],
              ["declined", "you tapped Decline (or texted “busy”)", "no big deal, continues by text"],
              ["missed", "rang 25s with no answer", "continues by text, may offer once later"],
              ["mic_denied", "browser mic permission blocked", "“your mic seems blocked, texting works too”"],
              ["running long", "4 min: wrap-up notice · 5 min: hard stop", "keeps the intro call short"],
            ].map(([o, when, then]) => (
              <div key={o} className="rounded-xl border border-rose-200 bg-white p-3 text-[12.5px]">
                <code className="rounded bg-rose-50 px-1.5 py-0.5 text-[11.5px] text-rose-900">{o}</code>
                <div className="mt-2 text-neutral-500">{when}</div>
                <div className="mt-1 text-neutral-800">→ {then}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
            <div className="rounded-xl bg-white p-3">
              <span className="font-medium">Texting during the call</span> is forwarded to the voice agent as a notice,
              so “can&apos;t talk, text me” mid-call ends the call politely.
            </div>
            <div className="rounded-xl bg-white p-3">
              <span className="font-medium">Audio devices:</span> avoids the iPhone Continuity mic by default, live mic
              meter, mic/speaker picker mid-call, falls back when AirPods disconnect, “can&apos;t hear?” hint after 6s.
            </div>
          </div>
        </Section>

        {/* 4. Gmail */}
        <Section
          n={4}
          title="Connecting Gmail"
          lead="The card works the same whether it was sent by the voice agent mid-call or by the text agent. What changes is who reacts: the voice (out loud) or the text agent (in the thread)."
        >
          <div className="mx-auto max-w-3xl">
            <Node sub="popup; if blocked (mobile) → full redirect, state survives the round trip">Tap “Connect”</Node>
            <Arrow />
            <Node kind="decision">Google consent screen</Node>
            <Branch cols={3}>
              <Lane label="allowed">
                <Node kind="text" sub="on call → voice thanks you · in text → brief ack">
                  connected ✓
                </Node>
                <Arrow />
                <Node kind="text" sub="texted to the thread; on a call the voice also says the gist">
                  inbox insight
                </Node>
              </Lane>
              <Lane label="unticked the Gmail box">
                <Node kind="event" sub="explains it can't read the inbox, offers to reconnect">
                  signed in, no Gmail scope
                </Node>
              </Lane>
              <Lane label="cancelled / error">
                <Node kind="event" sub="reassures, offers retry or skip; never pushes twice">
                  gmail_failed
                </Node>
              </Lane>
            </Branch>
            <div className="mt-4 text-center text-[12.5px] text-neutral-500">
              “no way i&apos;m giving an AI my email” → <code>gmailDeclined</code>, respected, and onboarding still
              completes.
            </div>
          </div>
        </Section>

        {/* 5. Text brain loop */}
        <Section
          n={5}
          title="The text agent's loop"
          lead="Every input, whether a message or an app event, goes through one queue. One model call returns what to say, what it learned and at most one action, so the conversation never feels like a form."
        >
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1.2fr_auto_1fr] md:items-center">
            <div className="space-y-1.5 text-[12.5px]">
              {[
                "user messages (900ms debounce, bursts merge)",
                "[call_ended outcome + transcript]",
                "[gmail_connected] / [gmail_failed]",
                "[insight_ready]",
                "[nudge] after 45s idle, max 2",
              ].map((e) => (
                <div key={e} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5">
                  {e}
                </div>
              ))}
            </div>
            <div className="text-center text-neutral-400">→</div>
            <Node kind="text" sub="system prompt carries the current state as the source of truth; history is last 40 items">
              one queued model call
            </Node>
            <div className="text-center text-neutral-400">→</div>
            <div className="space-y-1.5 text-[12.5px]">
              <div className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5">
                <code>messages</code>: 1–3 short texts, lowercase, human
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5">
                <code>updates</code>: only what was learned or corrected
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5">
                <code>action</code>: none · start_call · send_google_card · graduate
              </div>
            </div>
          </div>
          <p className="mt-4 text-[12.5px] text-neutral-500">
            Guardrails: user text is never treated as instructions, off-topic gets a brief real answer then a gentle
            steer, ignored questions are rephrased later instead of repeated, and a failed model call retries once
            before a graceful “say that again?”.
          </p>
        </Section>

        <footer className="pb-6 text-center text-[13px] text-neutral-500">
          <Link href="/" className="underline">
            Try the demo
          </Link>{" "}
          · built by Levan Khunjgurua for Persona
        </footer>
      </div>
    </main>
  );
}
