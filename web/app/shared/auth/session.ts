import { useSyncExternalStore } from "react";

import { api, setTokenGetter, type Schemas } from "../api/client";

export type User = Schemas["User"];
type Status = "loading" | "anon" | "authed";
type State = {
  status: Status;
  user: User | null;
  /**
   * With status "anon": a session probably exists (marker cookie) but couldn't be restored
   * because the network or the API is down. Private pages offer a retry instead of the login.
   */
  offline?: boolean;
};

// Session state for the browser. The access token (15 min) is kept only in memory, the
// refresh token in an HttpOnly cookie the API sets. A readable marker cookie (jv_auth=1)
// just says "a session probably exists": it spares anonymous visitors a pointless refresh
// call and lets the server render the signed-in header without a flash.
const MARKER = "jv_auth";

let state: State = { status: "loading", user: null };
let token: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let inflight: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

setTokenGetter(() => token);

const hasMarker = () => document.cookie.split("; ").some((c) => c === `${MARKER}=1`);

function setMarker(on: boolean) {
  document.cookie = on
    ? `${MARKER}=1; Path=/; Max-Age=2592000; SameSite=Lax`
    : `${MARKER}=; Path=/; Max-Age=0; SameSite=Lax`;
}

type AuthPayload = { user: User; access_token: string; access_token_expires_at: string };

/** Store the result of login/register/refresh and schedule the next silent refresh. */
export function signedIn(p: AuthPayload) {
  token = p.access_token;
  setMarker(true);
  clearTimeout(refreshTimer);
  const ms = new Date(p.access_token_expires_at).getTime() - Date.now() - 60_000;
  refreshTimer = setTimeout(() => void refresh(), Math.max(ms, 5_000));
  set({ status: "authed", user: p.user });
}

function signedOutLocally() {
  token = null;
  if (state.status === "authed") void import("../realtime/socket").then((rt) => rt.disconnect());
  clearTimeout(refreshTimer);
  setMarker(false);
  set({ status: "anon", user: null });
}

/** Rotate the refresh token. Concurrent callers share one request. */
export function refresh(): Promise<boolean> {
  inflight ??= (async () => {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await api.POST("/auth/refresh", { body: {} });
        if (res.data?.data) {
          signedIn(res.data.data as AuthPayload);
          return true;
        }
        // Another tab rotated the cookie a moment ago: retry with the fresh one.
        const code = (res.error as { error?: { code?: string } } | undefined)?.error?.code;
        if (code !== "refresh_race") break;
        await new Promise((r) => setTimeout(r, 300));
      }
      signedOutLocally();
      return false;
    } catch {
      // Network failure: keep what we have; the next request will try again. Not the same as
      // signed out: without a token yet, say so (offline) instead of sending people to log in.
      if (!token) set({ status: "anon", user: null, offline: hasMarker() });
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

let booted = false;
/** Called once in the browser at startup. */
export function bootstrapSession() {
  if (booted) return;
  booted = true;
  if (hasMarker()) void refresh();
  else set({ status: "anon", user: null });
}

export async function signOut() {
  try {
    await api.POST("/auth/logout");
  } finally {
    signedOutLocally();
  }
}

export function updateUser(user: User) {
  if (state.status === "authed") set({ status: "authed", user });
}

export function getToken() {
  return token;
}

/**
 * Runs an authenticated call; on 401 refreshes once and retries. Use for every request
 * that needs a signed-in user.
 */
export async function withAuth<R extends { response: Response }>(call: () => Promise<R>): Promise<R> {
  if (!token && state.status === "loading") await (inflight ?? refresh());
  const res = await call();
  if (res.response.status === 401 && (await refresh())) return call();
  return res;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const serverState: State = { status: "loading", user: null };

export function useSession(): State {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}
