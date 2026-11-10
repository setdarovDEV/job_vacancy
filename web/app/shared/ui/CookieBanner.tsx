import { useEffect, useState } from "react";
import { useTranslation } from "../i18n/i18n";
import { LocalizedLink } from "../i18n/hooks";
import { Button } from "./Button";

export type CookieConsent = "essential" | "all" | null;

const COOKIE_NAME = "jv_cookie_consent";
const ONE_YEAR = 60 * 60 * 24 * 365;

function parseConsent(cookie: string | null): CookieConsent {
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;)\\s*${COOKIE_NAME}=([^;]+)`));
  const value = match?.[1];
  if (value === "all" || value === "essential") return value;
  return null;
}

function setConsent(value: CookieConsent) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const expires = value ? `; Max-Age=${ONE_YEAR}` : "; Max-Age=0";
  document.cookie = `${COOKIE_NAME}=${value ?? ""}; Path=/; SameSite=Lax${secure}${expires}`;
  try {
    if (value) localStorage.setItem(COOKIE_NAME, value);
    else localStorage.removeItem(COOKIE_NAME);
  } catch {
    // ignore storage errors
  }
}

export function readCookieConsent(cookie: string | null): CookieConsent {
  return parseConsent(cookie);
}

export function CookieBanner({ initial }: { initial: CookieConsent }) {
  const { t } = useTranslation();
  const [consent, setLocalConsent] = useState<CookieConsent>(initial);

  // Sync with client-side cookie/localStorage on mount in case the user
  // already interacted on another tab or after the SSR shell was rendered.
  useEffect(() => {
    const client = parseConsent(document.cookie);
    if (client) setLocalConsent(client);
    else {
      try {
        const ls = localStorage.getItem(COOKIE_NAME);
        if (ls === "all" || ls === "essential") {
          setConsent(ls);
          setLocalConsent(ls);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  if (consent) return null;

  const accept = (value: CookieConsent) => {
    setConsent(value);
    setLocalConsent(value);
  };

  return (
    <div
      role="region"
      aria-label={t("cookieBanner.title")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line-strong bg-surface-solid p-4 shadow-[0_-12px_32px_-12px_rgb(0_0_0/0.25)] md:p-5"
    >
      <div className="container-page flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl text-sm text-ink-2">
          <p className="font-medium text-ink">{t("cookieBanner.title")}</p>
          <p className="mt-1">
            {t("cookieBanner.body")}{" "}
            <LocalizedLink to="/cookie-policy" className="text-lapis-ink underline hover:text-ink">
              {t("cookieBanner.policy")}
            </LocalizedLink>
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => accept("essential")}>
            {t("cookieBanner.essentialOnly")}
          </Button>
          <Button size="sm" onClick={() => accept("all")}>
            {t("cookieBanner.acceptAll")}
          </Button>
        </div>
      </div>
    </div>
  );
}
