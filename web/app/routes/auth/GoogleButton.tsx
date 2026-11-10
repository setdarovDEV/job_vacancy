import { useEffect, useRef } from "react";

import { api } from "~/shared/api/client";
import { signInResult, type TwoFactorChallenge } from "~/shared/auth/sign-in";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { loadScript } from "~/shared/lib/load-script";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window {
    google?: { accounts: { id: { initialize(o: object): void; renderButton(el: HTMLElement, o: object): void } } };
  }
}

/**
 * Google Identity Services button. Rendered only when VITE_GOOGLE_CLIENT_ID is set; the
 * script loads when the button mounts, not on every page.
 */
export function GoogleButton({ role, onDone, onError, onChallenge }: {
  role?: "seeker" | "employer";
  onDone: (isNew: boolean) => void;
  onError: (msg: string) => void;
  /** The account has two-factor sign-in on: continue with the code step. */
  onChallenge?: (c: TwoFactorChallenge) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const { t } = useTranslation();
  useEffect(() => {
    if (!clientId || !ref.current) return;
    const el = ref.current;
    const init = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }: { credential: string }) => {
          const r = signInResult(await api.POST("/auth/google", { body: { id_token: credential, role, locale } }));
          if (r.kind === "challenge") {
            if (onChallenge) onChallenge(r.challenge);
            else onError(t("twoFactor.loginHint"));
          } else if (r.kind === "session") onDone(r.isNewUser);
          else onError(t("apiErrors.invalid_google_token"));
        },
      });
      window.google?.accounts.id.renderButton(el, { theme: "outline", size: "large", width: el.clientWidth, text: "continue_with", locale });
    };
    if (window.google) return init();
    loadScript("https://accounts.google.com/gsi/client").then(init, () => onError(t("errors.network")));
  }, [role, locale, onDone, onError, onChallenge, t]);
  if (!clientId) return null;
  return (
    <>
      <div className="my-6 flex items-center gap-3 text-xs text-ink-3">
        <span className="h-px flex-1 bg-line" />{t("auth.or")}<span className="h-px flex-1 bg-line" />
      </div>
      <div ref={ref} className="flex h-11 justify-center" />
    </>
  );
}
