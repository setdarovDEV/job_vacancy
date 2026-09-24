import { useEffect, useRef, useState } from "react";

import { api } from "~/shared/api/client";
import { signedIn } from "~/shared/auth/session";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { Skeleton } from "~/shared/ui/Skeleton";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCRIPT_ID = "google-gsi";

declare global {
  interface Window {
    google?: { accounts: { id: { initialize(o: object): void; renderButton(el: HTMLElement, o: object): void } } };
  }
}

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
export function GoogleButton({ role, onDone, onError }: { role?: "seeker" | "employer"; onDone: (isNew: boolean) => void; onError: (msg: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const { t } = useTranslation();
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  // Latest callbacks without re-rendering Google's button on every parent render.
  const cb = useRef({ onDone, onError, t });
  cb.current = { onDone, onError, t };

  useEffect(() => {
    if (!clientId || !ref.current) return;
    const el = ref.current;
    const init = () => {
      if (!window.google) return setState("failed");
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }: { credential: string }) => {
          const res = await api.POST("/auth/google", { body: { id_token: credential, role, locale } });
          if (res.data?.data) {
            signedIn(res.data.data as never);
            cb.current.onDone(Boolean((res.data.data as { is_new_user?: boolean }).is_new_user));
          } else cb.current.onError(cb.current.t("apiErrors.invalid_google_token"));
        },
      });
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
    if (window.google) return init();
    // One script per page, even when the effect re-runs (role or locale change) before it loads.
    let s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      document.head.appendChild(s);
    }
    const fail = () => setState("failed");
    s.addEventListener("load", init);
    s.addEventListener("error", fail);
    // Never an endless skeleton: on a stalled connection the email form is the way in.
    const timer = setTimeout(() => !window.google && fail(), 10_000);
    return () => {
      clearTimeout(timer);
      s.removeEventListener("load", init);
      s.removeEventListener("error", fail);
    };
  }, [role, locale]);

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
