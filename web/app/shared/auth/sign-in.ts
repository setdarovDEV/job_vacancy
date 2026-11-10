import type { Schemas } from "../api/client";
import { signedIn, type User } from "./session";

/** A 202 from /auth/login or /auth/google carries this instead of a session. */
export type TwoFactorChallenge = { challenge_token: string; expires_in: number };

export type SignInResult =
  | { kind: "session"; user: User; isNewUser: boolean }
  | { kind: "challenge"; challenge: TwoFactorChallenge }
  | { kind: "invalid" };

type Session = { user: User; access_token: string; access_token_expires_at: string; is_new_user?: boolean };

function isSession(d: unknown): d is Session {
  const s = d as Partial<Session> | undefined;
  return Boolean(s?.user && typeof s.access_token === "string" && typeof s.access_token_expires_at === "string");
}

/**
 * Reads a successful sign-in response (login, register, Google, two-factor verify): a
 * session is stored right away; a 202 hands back the second-factor challenge.
 */
export function signInResult(res: { response: Response; data?: unknown }): SignInResult {
  const data = (res.data as { data?: Schemas["Auth"]["data"] | TwoFactorChallenge } | undefined)?.data;
  if (res.response.status === 202) {
    const c = data as Partial<TwoFactorChallenge> | undefined;
    return typeof c?.challenge_token === "string"
      ? { kind: "challenge", challenge: { challenge_token: c.challenge_token, expires_in: c.expires_in ?? 300 } }
      : { kind: "invalid" };
  }
  if (!isSession(data)) return { kind: "invalid" };
  signedIn(data);
  return { kind: "session", user: data.user, isNewUser: Boolean(data.is_new_user) };
}
