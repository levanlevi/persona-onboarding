# Persona onboarding: voice + text

**Live:** https://levan-persona.vercel.app · **Decision tree:** [/flow](https://levan-persona.vercel.app/flow) · **How it works:** [/how-it-works](https://levan-persona.vercel.app/how-it-works)

A conversational onboarding for a personal AI assistant. It collects the assistant's name (by text), then tries a phone call (simulated in the browser, real voice) to get the user's name, what they need help with, and a connected Gmail. It's built to survive people who don't play by the rules.

> Best in desktop Chrome with a microphone. The side panel shows the live state and a "try to break it" list. **Restart demo** resets everything.

## Try to break it

Decline or ignore the call · hang up mid-sentence · go silent · reload mid-call · block the mic · give everything in one message · rename the assistant halfway · refuse Gmail, or untick the Gmail box on Google's screen · text during the call · say "just let me in".

Connecting Google shows an "unverified app" screen (Advanced → continue). The app requests read-only Gmail and hasn't been through Google's verification.

## How it works

```
             ┌──────────── shared onboarding state ────────────┐
 text  ◄──►  │ agentName · userName · helpNeed · gmail · phase │  ◄──►  voice
(gpt-5.5)    │ callOutcomes · textOnly · gmailDeclined         │     (gpt-realtime over WebRTC)
             └─────────────────────────────────────────────────┘
                  │ Google OAuth → Gmail (read-only) → first inbox insight
                  │ Neon: event log + rate limits
```

- **One brain, two channels.** The text agent and the voice agent read and write the same state. Anything learned on the call is instantly known in text, and the other way round, so nothing gets asked twice and a dropped call loses nothing.
- **Text agent** (`/api/chat`): every input goes through one queue: user messages (debounced, so bursts merge), plus app events like `call_ended`, `gmail_connected` and `nudge`. One structured-output call returns `messages` (1–3 short texts), `updates` (only what was learned) and one `action` (`start_call`, `send_google_card`, `graduate`). The current state goes in the system prompt as the source of truth.
- **Voice agent** (`/api/realtime/session` mints an ephemeral key, and the browser connects directly over WebRTC). The browser runs its tools: `save_user_name`, `save_help_need`, `rename_agent`, `send_google_link`, `check_google_connection`, `end_call`.
- **Every call ending is an event, not an error:** `completed`, `user_hangup`, `dropped` (network or reload), `silent`, `declined`, `missed`, `mic_denied`, `unavailable`. Each one becomes a call record with its transcript in the thread, plus an event for the text agent, which reacts honestly ("looks like we got cut off…") and continues with what's missing.
- **Gmail:** the card works mid-call (the call minimizes so you can tap it). After connecting, the app reads metadata for ~25 recent inbox emails and produces one specific, actionable observation tied to what the user said they need. That's the "first win". It shows in the thread and is also said out loud if you're on the call.
- **Graduation:** happens naturally once the key pieces are known, or immediately on "just let me in". Missing Gmail never blocks it.

## Product decisions

- **The goal is showing value, not filling fields.** Each of the four pieces is only asked for when it fits the conversation. Gmail is pitched in terms of the user's own need, and the payoff is a real insight from their inbox.
- **Voice is preferred, never forced.** It rings once on its own. After a decline, miss or drop it continues by text and only offers again if that would genuinely help. "Call me" works anytime.
- **Honesty over polish.** The text agent sees the real transcript and outcome, so it never pretends a call went better than it did. It won't invent inbox content or claim it did something it didn't.
- **Respect a "no".** Declining Gmail is remembered and mentioned at most once more. Declining calls sets text-only.
- **Audio is where real users fail.** The app avoids the iPhone Continuity mic by default and shows a live mic level meter. You can switch mic or speaker mid-call, it falls back when AirPods disconnect, and it shows a "can't hear?" hint after 6 seconds.

## Tradeoffs (because of the ~3h scope)

- **State lives in the browser (localStorage)**, not on a server. It's fast and survives reloads, but it's per-device.
- **Gmail access token in an encrypted HTTP-only cookie for one hour**, with no refresh token and no stored inbox data.
- **The Google app is unverified**, with a 100-user cap and a warning screen.
- **The call is a browser simulation of a phone call** (WebRTC), not PSTN.
- **Email snippets reach the models as untrusted text.** The inbox insight is built from snippets and then read into the voice call, so a crafted email could try to inject instructions. Fine for a demo. In production I'd isolate or sanitize that content and keep tools that act on it behind confirmation.

## Next steps

1. **Real telephony**: Twilio or SIP into the same realtime session, with SMS as the text channel.
2. **Server-side session state**, so a user can start on web, answer on their phone and continue on WhatsApp.
3. **An eval harness** over logged sessions (there's a start in `scripts/eval-text.mts`): replay real conversations after every prompt change and score for things like "asked twice", "pushed after a no" and "form-like".
4. **Funnel analytics** from the event log: where do people drop off, and how often do calls get answered, completed or cut off?
5. **Google verification**, refresh tokens and a "what I can see" privacy screen.
6. **Personalized first actions** beyond Gmail (calendar conflicts, a booking), chosen based on what the user needs help with.

## Run locally

```bash
pnpm install
cp .env.example .env   # fill in the keys
node scripts/migrate.mjs
pnpm dev               # http://localhost:3000
```

Environment variables: `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (redirect URI `<origin>/api/google/callback`), `DATABASE_URL` (Neon, optional: logging and rate limits turn off without it), `SESSION_SECRET`.

Text-agent scenario evals: `npx tsx --env-file=.env scripts/eval-text.mts`

## Map

| Path | What |
|---|---|
| `src/components/Onboarding.tsx` | Orchestration: state, text-agent queue, call lifecycle, Gmail flow |
| `src/hooks/useRealtimeCall.ts` | WebRTC voice session, tools, silence/drop detection, device switching |
| `src/lib/prompts.ts` | Text, voice and insight prompts |
| `src/app/api/*` | chat, realtime session, Google OAuth + insight, log |
| `src/lib/ratelimit.ts` | Sliding-window limits on Neon (fails open) |
| `src/proxy.ts` | Redirects all production aliases to the canonical host (OAuth + cookies) |
