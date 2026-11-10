import { parseConsent, setConsent, useConsent, type CookieConsent } from "../consent/consent";
import { useTranslation } from "../i18n/i18n";
import { LocalizedLink } from "../i18n/hooks";
import { Button } from "./Button";

export type { CookieConsent };

export function readCookieConsent(cookie: string | null): CookieConsent {
  return parseConsent(cookie);
}

/** Asks once; "Cookie settings" in the footer clears the choice and brings it back. */
export function CookieBanner({ initial }: { initial: CookieConsent }) {
  const { t } = useTranslation();
  const consent = useConsent(initial);
  if (consent) return null;
  const accept = (value: CookieConsent) => setConsent(value);

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
