import { ArrowRight, ChevronDown } from "lucide-react";

import { useSession } from "~/shared/auth/session";
import { htmlLang } from "~/shared/i18n/config";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { band, est, postHref, SecondaryCta, SectionHead } from "./parts";

const QUESTIONS = ["free", "moderation", "duration", "verified", "contacts", "team"] as const;

/**
 * FAQ on native <details>: keyboard and screen-reader support for free, every answer in the
 * server HTML, and the `disclosure` utility eases the panel open where the browser can animate
 * to auto height. FAQPage JSON-LD mirrors the visible text.
 */
export function Faq() {
  const { t } = useTranslation();
  const locale = useLocale();
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: htmlLang[locale],
    mainEntity: QUESTIONS.map((id) => ({
      "@type": "Question",
      name: t(`employersPage.faq.${id}.q`),
      acceptedAnswer: { "@type": "Answer", text: t(`employersPage.faq.${id}.a`) },
    })),
  };
  return (
    <section aria-labelledby="employers-faq" className={band} style={est(44)}>
      {/* "<" is escaped so no string can ever close the script tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <div className="grid gap-8 lg:grid-cols-3 lg:gap-12">
        <div className="min-w-0">
          <SectionHead id="employers-faq" title={t("employersPage.faq.title")} description={t("employersPage.faq.body")} />
          <LocalizedLink
            to="/contacts"
            prefetch="intent"
            className="-mx-3 mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-pill px-3 text-md font-medium text-lapis-ink transition-colors hover:bg-lapis-soft"
          >
            {t("employersPage.faq.contact")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </LocalizedLink>
        </div>
        <Card padding="none" className="divide-y divide-line lg:col-span-2">
          {QUESTIONS.map((id, i) => (
            <details key={id} open={i === 0} className="disclosure group">
              <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-panel px-5 py-4 text-md font-semibold text-ink transition-colors hover:text-lapis-ink focus-visible:-outline-offset-2 md:px-6 md:text-base">
                <span className="min-w-0 break-words">{t(`employersPage.faq.${id}.q`)}</span>
                <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-ink-2 transition-transform duration-300 ease-spring group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-5 text-md text-ink-2 md:px-6 md:text-base">{t(`employersPage.faq.${id}.a`)}</p>
            </details>
          ))}
        </Card>
      </div>
    </section>
  );
}

/** Closing band on the brand light. */
export function FinalCta() {
  const { t } = useTranslation();
  const { user } = useSession();
  return (
    <section aria-labelledby="employers-final" className={band} style={est(26)}>
      <Card radius="sheet" padding="none" className="relative isolate overflow-hidden px-5 py-10 text-center sm:px-8 md:py-16">
        <div aria-hidden="true" className="aurora-hero pointer-events-none absolute inset-0 -z-10" />
        <h2 id="employers-final" className="reveal mx-auto max-w-2xl break-words font-display text-2xl font-semibold tracking-heading text-ink md:text-3xl">
          {t("employersPage.final.title")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-lead text-ink-2">{t("employersPage.final.body")}</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" shape="pill">
            <LocalizedLink to={postHref(user)}>{t("nav.postVacancy")}</LocalizedLink>
          </Button>
          <SecondaryCta />
        </div>
      </Card>
    </section>
  );
}
