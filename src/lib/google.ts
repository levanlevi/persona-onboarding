import { cookies } from "next/headers";
import { unseal } from "./seal";

export const GOOGLE_COOKIE = "persona_google";
export const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export interface GoogleSession {
  accessToken: string;
  email: string;
  expiresAt: number;
}

export function redirectUri(origin: string) {
  return `${origin}/api/google/callback`;
}

export async function getGoogleSession(): Promise<GoogleSession | null> {
  const jar = await cookies();
  const s = await unseal<GoogleSession>(jar.get(GOOGLE_COOKIE)?.value);
  if (!s || s.expiresAt < Date.now()) return null;
  return s;
}
