import { lazy, Suspense, useState } from "react";

import { setConsent } from "~/shared/consent/consent";
import { useTranslation } from "~/shared/i18n/i18n";

import { LogoMark } from "../brand/Logo";
import { LocalizedLink } from "../i18n/hooks";

const FeedbackDialog = lazy(() => import("../feedback/FeedbackDialog"));

export function SiteFooter() {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState(false);
  const links = [
    { to: "/about", key: "footer.about" },
    { to: "/contacts", key: "footer.contacts" },
    { to: "/privacy", key: "footer.privacy" },
    { to: "/terms", key: "footer.terms" },
    { to: "/cookie-policy", key: "footer.cookiePolicy" },
    { to: "/public-offer", key: "footer.publicOffer" },
    { to: "/content-rules", key: "footer.contentRules" },
  ] as const;
  return (
    <footer className="mt-24 border-t border-line">
      <div className="container-page flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <LogoMark className="size-6" />
          <p className="text-sm text-ink-2">{t("brand.tagline")}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
          {links.map((l) => (
            <LocalizedLink key={l.to} to={l.to} className="hover:text-ink">{t(l.key)}</LocalizedLink>
          ))}
          <button type="button" className="hover:text-ink" onClick={() => setConsent(null)}>{t("footer.cookieSettings")}</button>
          <button type="button" className="font-medium text-lapis-ink hover:underline" onClick={() => setFeedback(true)}>{t("feedback.title")}</button>
        </nav>
        {feedback && (
          <Suspense fallback={null}>
            <FeedbackDialog open onOpenChange={setFeedback} />
          </Suspense>
        )}
      </div>
      <div className="container-page pb-10 text-xs text-ink-3">{t("footer.rights", { year: new Date().getFullYear() })}</div>
    </footer>
  );
}
