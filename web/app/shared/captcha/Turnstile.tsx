import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useLocale } from "../i18n/hooks";
import { useRuntime } from "../runtime/runtime";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window { turnstile?: TurnstileApi }
}

let loading: Promise<TurnstileApi> | null = null;

/** Cloudflare's script, fetched only on pages that show the widget. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    s.onerror = () => { loading = null; reject(new Error("turnstile")); };
    document.head.appendChild(s);
  });
  return loading;
}

const turnstileLang: Record<string, string> = { uz: "uz", "uz-Cyrl": "uz", ru: "ru", en: "en" };

export type Captcha = {
  /** The widget to place above the submit button (null when Turnstile is off). */
  widget: ReactNode;
  /** True once a submit may go out (always true when Turnstile is off). */
  ready: boolean;
  /** Headers for the API call; the token is single-use, so the widget re-arms itself. */
  take: () => Record<string, string>;
};

/**
 * Turnstile for a form. Off unless the server has TURNSTILE_SITE_KEY; the API checks
 * the token (X-Turnstile-Token) with TURNSTILE_SECRET_KEY.
 */
export function useCaptcha(): Captcha {
  const { turnstileSiteKey } = useRuntime();
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!turnstileSiteKey || !ref.current) return;
    const el = ref.current;
    let live = true;
    void loadTurnstile().then((ts) => {
      if (!live) return;
      widgetId.current = ts.render(el, {
        sitekey: turnstileSiteKey,
        language: turnstileLang[locale] ?? "auto",
        appearance: "interaction-only",
        callback: (t: string) => setToken(t),
        "expired-callback": () => setToken(null),
        "error-callback": () => setToken(null),
      });
    }).catch(() => {});
    return () => {
      live = false;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [turnstileSiteKey, locale]);

  const take = useCallback(() => {
    if (!turnstileSiteKey || !token) return {} as Record<string, string>;
    const headers = { "X-Turnstile-Token": token };
    setToken(null);
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
    return headers;
  }, [turnstileSiteKey, token]);

  return {
    widget: turnstileSiteKey ? <div ref={ref} className="min-h-0 empty:hidden [&_iframe]:max-w-full" data-testid="turnstile" /> : null,
    ready: !turnstileSiteKey || Boolean(token),
    take,
  };
}
