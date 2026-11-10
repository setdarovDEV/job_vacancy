import { useSyncExternalStore } from "react";

/** Cookie consent: "all" allows analytics, "essential" doesn't, null = not asked yet. */
export type CookieConsent = "essential" | "all" | null;

const COOKIE_NAME = "jv_cookie_consent";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function parseConsent(cookie: string | null | undefined): CookieConsent {
  const value = cookie?.match(new RegExp(`(?:^|;)\\s*${COOKIE_NAME}=([^;]+)`))?.[1];
  return value === "all" || value === "essential" ? value : null;
}

let current: CookieConsent | undefined;
const listeners = new Set<() => void>();

function read(): CookieConsent {
  if (current !== undefined) return current;
  let v = parseConsent(document.cookie);
  if (!v) {
    try {
      const ls = localStorage.getItem(COOKIE_NAME);
      if (ls === "all" || ls === "essential") v = ls;
    } catch {
      // storage blocked
    }
  }
  current = v;
  return v;
}

/** Store the choice (null asks again: the banner comes back and analytics stop). */
export function setConsent(value: CookieConsent) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const expires = value ? `; Max-Age=${ONE_YEAR}` : "; Max-Age=0";
  document.cookie = `${COOKIE_NAME}=${value ?? ""}; Path=/; SameSite=Lax${secure}${expires}`;
  try {
    if (value) localStorage.setItem(COOKIE_NAME, value);
    else localStorage.removeItem(COOKIE_NAME);
  } catch {
    // storage blocked
  }
  current = value;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

/** The visitor's choice; `initial` (from the request cookie) is used while rendering on the server. */
export function useConsent(initial: CookieConsent): CookieConsent {
  return useSyncExternalStore(subscribe, read, () => initial);
}
