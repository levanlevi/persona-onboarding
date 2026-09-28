// Shared onboarding state. Text agent, voice agent and UI all read/write this one object.

export type Phase = "onboarding" | "graduated";

// How the assistant sounds on calls; guessed from its name unless the user says otherwise.
export type AgentVoice = "masculine" | "feminine" | "neutral";

export type CallOutcome =
  | "completed" // agent wrapped up the call
  | "user_hangup" // user pressed hang up mid-call
  | "declined" // user declined the incoming call
  | "missed" // nobody answered
  | "dropped" // connection failed / network
  | "mic_denied" // browser mic permission refused
  | "silent"; // user never spoke, agent gave up

export interface OnboardingState {
  sessionId: string;
  phase: Phase;
  agentName: string | null;
  agentVoice: AgentVoice | null;
  userName: string | null;
  helpNeed: string | null;
  gmail: { email: string } | null;
  gmailDeclined: boolean;
  callAttempts: number;
  callOutcomes: CallOutcome[];
  textOnly: boolean; // user asked not to be called
  googleCardSent: boolean;
  insight: string | null; // first "win" produced from their inbox
}

export type CardKind = "contact" | "google" | "welcome";

export type ChatMessage =
  | { id: string; role: "user" | "assistant"; kind: "text"; text: string; at: number }
  | { id: string; role: "assistant"; kind: "card"; card: CardKind; at: number }
  | {
      id: string;
      role: "system";
      kind: "call";
      outcome: CallOutcome;
      durationSec: number;
      transcript: { who: "user" | "agent"; text: string }[];
      at: number;
    };

// What the text brain returns each turn (structured output).
export type TextAction =
  | "none"
  | "start_call"
  | "send_contact_card"
  | "send_google_card"
  | "graduate";

export interface TextTurnResult {
  messages: string[];
  updates: {
    agentName?: string | null;
    agentVoice?: AgentVoice | null;
    userName?: string | null;
    helpNeed?: string | null;
    textOnly?: boolean | null;
    gmailDeclined?: boolean | null;
  };
  action: TextAction;
}

// Events the client feeds to the text brain besides user messages.
export type TextEvent =
  | { type: "user_message" }
  | { type: "call_ended"; outcome: CallOutcome; transcript: string }
  | { type: "gmail_connected"; email: string }
  | { type: "gmail_failed"; reason: string }
  | { type: "insight_ready"; insight: string }
  | { type: "nudge" }; // user went idle for a while

export const initialState = (sessionId: string): OnboardingState => ({
  sessionId,
  phase: "onboarding",
  agentName: null,
  agentVoice: null,
  userName: null,
  helpNeed: null,
  gmail: null,
  gmailDeclined: false,
  callAttempts: 0,
  callOutcomes: [],
  textOnly: false,
  googleCardSent: false,
  insight: null,
});
