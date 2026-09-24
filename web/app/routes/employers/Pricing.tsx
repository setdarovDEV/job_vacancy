import { Check, Languages, ListChecks, MessageCircleQuestion, ScanSearch, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { useSession } from "~/shared/auth/session";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { band, est, postHref, SectionHead } from "./parts";

const aiItems = [
  { id: "rank", icon: ListChecks },
  { id: "search", icon: ScanSearch },
  { id: "write", icon: Languages },
  { id: "interview", icon: MessageCircleQuestion },
] as const;

/** The AI assistant (not in the MVP): a glass panel resting on the brand light, marked "soon". */
export function AiBlock() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="employers-ai" className={band} style={est(34)}>
      <Card radius="sheet" padding="none" className="relative isolate overflow-hidden p-3 sm:p-6 md:p-10">
        <div aria-hidden="true" className="aurora-hero pointer-events-none absolute inset-0 -z-10" />
        <div className="glass-panel grid gap-6 rounded-panel p-5 md:p-8 lg:grid-cols-2 lg:items-center lg:gap-10">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-control bg-lapis text-on-lapis shadow-2">
                <Sparkles className="size-5" />
              </span>
              <Badge tone="zafaron">{t("common.soon")}</Badge>
            </div>
            <h2 id="employers-ai" className="reveal mt-4 break-words font-display text-xl font-semibold tracking-heading text-ink md:text-2xl">
              {t("employersPage.ai.title")}
            </h2>
            <p className="mt-2 text-md text-ink-2 md:text-base">{t("employersPage.ai.body")}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {aiItems.map(({ id, icon: Icon }) => (
              <li key={id} className="flex min-w-0 items-center gap-3 text-md text-ink">
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-control bg-lapis-soft text-lapis-ink">
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0">{t(`employersPage.ai.${id}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </section>
  );
}

/** Plans: the free plan is live today; the paid one waits for payments (Payme/Click), so it is "soon". */
export function Pricing() {
  const { t } = useTranslation();
  const { user } = useSession();
  return (
    <section aria-labelledby="employers-pricing" className={band} style={est(44)}>
      <SectionHead id="employers-pricing" title={t("employersPage.pricing.title")} description={t("employersPage.pricing.body")} />
      <ul className="mt-8 grid gap-4 md:mt-10 md:grid-cols-2 md:gap-6">
        <Plan
          id="free"
          current
          badge={<Badge tone="firuza">{t("employersPage.pricing.now")}</Badge>}
          price={
            <span className="flex items-baseline gap-2">
              <span className="num font-display text-4xl font-semibold tracking-display text-ink">0</span>
              <span className="text-base text-ink-2">{t("salary.currency.UZS")}</span>
            </span>
          }
          action={
            <Button asChild size="lg" shape="pill" className="w-full">
              <LocalizedLink to={postHref(user)}>{t("nav.postVacancy")}</LocalizedLink>
            </Button>
          }
        />
        <Plan
          id="business"
          badge={<Badge tone="zafaron">{t("common.soon")}</Badge>}
          price={<span className="font-display text-xl font-semibold tracking-heading text-ink-2">{t("employersPage.pricing.business.price")}</span>}
          action={
            <Button type="button" size="lg" shape="pill" variant="secondary" className="w-full" disabled>
              {t("common.soon")}
            </Button>
          }
        />
      </ul>
    </section>
  );
}

function Plan({ id, current, badge, price, action }: {
  id: "free" | "business";
  current?: boolean;
  badge: ReactNode;
  price: ReactNode;
  action: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Card
      as="li"
      padding="lg"
      aria-labelledby={`plan-${id}`}
      // The live plan carries a lapis edge; the future one stays quiet.
      className={cn("reveal flex min-w-0 flex-col", current && "outline-2 -outline-offset-2 outline-lapis")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`plan-${id}`} className="font-display text-lg font-semibold tracking-heading text-ink">
          {t(`employersPage.pricing.${id}.name`)}
        </h3>
        {badge}
      </div>
      <p className="mt-4 flex min-h-13 items-end">{price}</p>
      <p className="mt-2 text-md text-ink-2">{t(`employersPage.pricing.${id}.body`)}</p>
      <ul className="mt-6 space-y-3 border-t border-line pt-6">
        {([1, 2, 3, 4] as const).map((n) => (
          <li key={n} className="flex gap-3 text-md text-ink">
            <Check aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-firuza-ink" />
            <span className="min-w-0">{t(`employersPage.pricing.${id}.f${n}`)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">{action}</div>
    </Card>
  );
}
