import { BadgeCheck, ChevronRight, Languages, Mail, MessagesSquare, Send, ShieldCheck, SquareKanban, type LucideIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { StatusBadge } from "~/shared/application/status";
import { localeNames, locales } from "~/shared/i18n/config";
import { useTranslation } from "~/shared/i18n/i18n";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Card } from "~/shared/ui/Card";
import { band, est, SectionHead } from "./parts";

const pill = "inline-flex h-8 items-center rounded-pill border border-line bg-surface px-3 text-sm text-ink-2";

/**
 * Four value props as solid cards. Each ends in a small "well" drawn with the real UI pieces
 * (language pills, stage badges, channels, the verified mark), so it shows instead of tells.
 */
export function Features() {
  const { t } = useTranslation();
  const cards: { id: string; icon: LucideIcon; visual: ReactNode }[] = [
    {
      id: "languages",
      icon: Languages,
      visual: locales.map((l) => <span key={l} className={pill}>{localeNames[l]}</span>),
    },
    {
      id: "kanban",
      icon: SquareKanban,
      visual: (["viewed", "interview", "hired"] as const).map((s, i) => (
        <Fragment key={s}>
          {i > 0 && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3" />}
          <StatusBadge status={s} />
        </Fragment>
      )),
    },
    {
      id: "chat",
      icon: MessagesSquare,
      visual: ([["site", MessagesSquare], ["telegram", Send], ["email", Mail]] as const).map(([c, Icon]) => (
        <span key={c} className={pill}>
          <Icon aria-hidden="true" className="mr-1.5 size-4 text-lapis-ink" />
          {t(`employersPage.features.channels.${c}`)}
        </span>
      )),
    },
    {
      id: "verified",
      icon: ShieldCheck,
      visual: (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={t("employersPage.features.yourCompany")} square size="sm" />
          <span className="min-w-0 truncate text-md font-semibold text-ink">{t("employersPage.features.yourCompany")}</span>
          <BadgeCheck aria-hidden="true" className="size-4.5 shrink-0 fill-firuza text-surface" />
          <Badge tone="firuza" className="hidden lg:inline-flex">{t("common.verified")}</Badge>
        </span>
      ),
    },
  ];

  return (
    <section aria-labelledby="employers-features" className={band} style={est(56)}>
      <SectionHead id="employers-features" title={t("employersPage.features.title")} description={t("employersPage.features.body")} />
      <ul className="mt-8 grid gap-4 md:mt-10 md:grid-cols-2 md:gap-6">
        {cards.map(({ id, icon: Icon, visual }) => (
          <Card as="li" key={id} className="reveal flex min-w-0 flex-col md:p-8">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-control bg-lapis-soft text-lapis-ink">
                <Icon className="size-5" />
              </span>
              <h3 className="min-w-0 break-words text-lead font-semibold tracking-snug text-ink">{t(`employersPage.features.${id}.title`)}</h3>
            </div>
            <p className="mt-3 text-md text-ink-2">{t(`employersPage.features.${id}.body`)}</p>
            {/* Decorative: the heading and text above already say it. */}
            <div aria-hidden="true" className="mt-auto pt-5 md:pt-6">
              <div className="flex min-h-14 flex-wrap items-center gap-2 rounded-control bg-sunken/70 p-3">{visual}</div>
            </div>
          </Card>
        ))}
      </ul>
    </section>
  );
}

/** "How it works": three numbered steps on a dashed rail (vertical on phones, horizontal from md). */
export function Steps() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="employers-steps" className={band} style={est(34)}>
      <SectionHead id="employers-steps" title={t("employersPage.steps.title")} description={t("employersPage.steps.body")} />
      <div className="relative mt-8 md:mt-12">
        {/* One rail across the three markers from md; on phones each step draws its own segment down to the next marker. */}
        <div aria-hidden="true" className="absolute inset-x-1/6 top-6 hidden border-t border-dashed border-line-strong md:block" />
        <ol className="relative grid gap-8 md:grid-cols-3 md:gap-6">
          {[1, 2, 3].map((n) => (
            <li key={n} className="reveal group relative flex min-w-0 gap-4 md:flex-col md:items-center md:text-center">
              <span aria-hidden="true" className="absolute -bottom-8 left-6 top-12 border-l border-dashed border-line-strong group-last:hidden md:hidden" />
              <span
                aria-hidden="true"
                className="num grid size-12 shrink-0 place-items-center rounded-full bg-lapis font-display text-lg font-semibold text-on-lapis shadow-2 ring-8 ring-paper"
              >
                {n}
              </span>
              <div className="min-w-0 pt-2.5 md:pt-0">
                <h3 className="break-words text-lead font-semibold tracking-snug text-ink">{t(`employersPage.steps.s${n}`)}</h3>
                <p className="mt-1.5 text-md text-ink-2 md:mx-auto md:max-w-xs">{t(`employersPage.steps.s${n}body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
