import { useEffect, useRef, useState } from "react";

import { api, apiError } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { signedIn } from "~/shared/auth/session";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { useTheme } from "~/shared/layout/Switchers";
import { Skeleton } from "~/shared/ui/Skeleton";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCRIPT_ID = "google-gsi";

declare global {
  interface Window {
    google?: { accounts: { id: { initialize(o: object): void; renderButton(el: HTMLElement, o: object): void } } };
  }
}

// Google wants initialize() once per page (it warns and keeps only the last call otherwise), so
// its callback goes through whichever button is mounted now (login ↔ register swap them).
let handler: ((credential: string) => void) | null = null;
let initialized = false;

// Google draws its button in an iframe, so only its own themes apply: pick the one for our theme.
function darkTheme() {
  const theme = document.documentElement.getAttribute("data-theme");
  return theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Google Identity Services button, placed first above the email form with an "or" divider under
 * it. Rendered only when VITE_GOOGLE_CLIENT_ID is set; the script loads when the button mounts,
 * not on every page. A skeleton holds the button's exact height while it loads (no layout shift),
 * and if the script can't load (offline, blocked) the whole block steps aside for the email form.
 */
export function GoogleButton({ role, consent, onDone, onError }: {
  role?: "seeker" | "employer";
  /** Register page: the consent box. A new account needs it (TZ FN-08); sign-in pages omit it. */
  consent?: boolean;
  onDone: (isNew: boolean) => void;
  /** `code` is the API error code, e.g. "consent_required" to point at the consent box. */
  onError: (msg: string, code?: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const [theme] = useTheme();
  const { t } = useTranslation();
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  // The latest props for the sign-in call, without re-rendering Google's button on every render.
  const latest = useRef({ role, consent, locale, onDone, onError, t });
  latest.current = { role, consent, locale, onDone, onError, t };

  useEffect(() => {
    handler = async (credential) => {
      const { role, consent, locale, onDone, onError, t } = latest.current;
      // Unticked on the register page: say so right away instead of a round trip that fails.
      if (consent === false) return onError(t("apiErrors.consent_required"), "consent_required");
      try {
        const res = await api.POST("/auth/google", { body: { id_token: credential, role, locale, consent } });
        if (res.data?.data) {
          signedIn(res.data.data as never);
          onDone(Boolean((res.data.data as { is_new_user?: boolean }).is_new_user));
        } else {
          // The API's own reason (blocked account, Google disabled, rate limit) beats a generic one.
          const e = apiError(res);
          onError(e ? errorText(t, e) : t("apiErrors.invalid_google_token"), e?.code);
        }
      } catch {
        onError(t("errors.network"));
      }
    };
    return () => {
      handler = null;
    };
  }, []);

  useEffect(() => {
    if (!clientId || !ref.current) return;
    const el = ref.current;
    const render = () => {
      if (!window.google) return setState("failed");
      if (!initialized) {
        window.google.accounts.id.initialize({ client_id: clientId, callback: ({ credential }: { credential: string }) => handler?.(credential) });
        initialized = true;
      }
      window.google.accounts.id.renderButton(el, {
        theme: darkTheme() ? "filled_black" : "outline",
        size: "large",
        shape: "pill",
        logo_alignment: "center",
        // Google caps the button at 400px.
        width: Math.min(el.clientWidth, 400),
        text: "continue_with",
        locale,
      });
      setState("ready");
    };
    // Re-rendered (not re-initialized) when the locale or our theme changes.
    if (window.google) return render();
    // One script per page, even when the effect re-runs before it loads.
    let s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      document.head.appendChild(s);
    }
    const fail = () => setState("failed");
    s.addEventListener("load", render);
    s.addEventListener("error", fail);
    // Never an endless skeleton: on a stalled connection the email form is the way in.
    const timer = setTimeout(() => !window.google && fail(), 10_000);
    return () => {
      clearTimeout(timer);
      s.removeEventListener("load", render);
      s.removeEventListener("error", fail);
    };
  }, [locale, theme]);

  if (!clientId || state === "failed") return null;
  return (
    <>
      <div className="relative h-11">
        {state === "loading" && <Skeleton className="absolute inset-x-0 top-0.5 h-10" />}
        <div ref={ref} className="flex h-11 items-center justify-center" />
      </div>
      <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-caps text-ink-3">
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
        {t("auth.or")}
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}
