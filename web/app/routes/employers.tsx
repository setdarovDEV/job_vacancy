import { Check, Languages, MessagesSquare, Sparkles, SquareKanban, UsersRound } from "lucide-react";

import type { Route } from "./+types/employers";
import { useSession } from "~/shared/auth/session";
import { GirihPattern } from "~/shared/brand/GirihPattern";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { metaT } from "~/shared/seo/meta";
import { seo } from "~/shared/seo/seo";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";

export function meta({ matches, location }: Route.MetaArgs) {
  const { t } = metaT(matches);
  return seo({ title: `${t("employers.title")} | Job Vacancy`, description: t("employers.subtitle"), path: location.pathname });
}

export default function Employers() {
  const { t } = useTranslation();
  const { user } = useSession();
  const isEmployer = user?.role === "employer";
  const features = [
    { icon: Languages, title: t("employers.f1"), body: t("employers.f1body") },
    { icon: SquareKanban, title: t("employers.f2"), body: t("employers.f2body") },
    { icon: UsersRound, title: t("employers.f3"), body: t("employers.f3body") },
    { icon: MessagesSquare, title: t("employers.f4"), body: t("employers.f4body") },
  ];

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <GirihPattern className="-z-10" focus="ellipse 50% 80% at 90% 20%" />
        <div className="container-page pb-16 pt-14 md:pb-24 md:pt-24">
          <h1 className="max-w-[18ch] text-balance font-display text-[2.1rem] font-semibold leading-[1.08] tracking-[-0.035em] text-ink sm:text-4xl md:text-5xl">
            {t("employers.title")}
          </h1>
          <p className="mt-5 max-w-[38rem] text-lg text-ink-2">{t("employers.subtitle")}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <LocalizedLink to={isEmployer ? "/employer/vacancies/new" : "/register?role=employer"}>{t("employers.cta")}</LocalizedLink>
            </Button>
            {!user && (
              <Button size="lg" variant="secondary" asChild>
                <LocalizedLink to="/login?next=/employer">{t("employers.ctaSecondary")}</LocalizedLink>
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="container-page grid gap-x-12 gap-y-10 py-16 md:grid-cols-2">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-control bg-lapis-soft text-lapis-ink">
              <Icon className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold text-ink">{title}</h2>
              <p className="mt-1.5 max-w-[42ch] text-ink-2">{body}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="container-page pb-20">
        <div className="relative overflow-hidden rounded-sheet bg-lapis p-7 text-on-lapis md:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <Sparkles className="size-6 text-zafaron" />
            <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">{t("employers.aiTitle")}</h2>
            <Badge tone="zafaron">{t("common.soon")}</Badge>
          </div>
          <p className="mt-3 max-w-[52ch] opacity-85">{t("employers.aiBody")}</p>
        </div>

        <h2 className="mt-16 font-display text-2xl font-semibold tracking-[-0.03em] text-ink">{t("employers.pricingTitle")}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Plan name={t("employers.free")} body={t("employers.freeBody")} price="0" action={
            <Button asChild variant="secondary" className="w-full">
              <LocalizedLink to={isEmployer ? "/employer/vacancies/new" : "/register?role=employer"}>{t("employers.cta")}</LocalizedLink>
            </Button>
          } />
          <Plan name={t("employers.business")} body={t("employers.businessBody")} soon={t("common.soon")} action={
            <Button className="w-full" disabled>{t("common.soon")}</Button>
          } />
        </div>
      </section>
    </>
  );
}

function Plan({ name, body, price, soon, action }: { name: string; body: string; price?: string; soon?: string; action: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col rounded-panel border border-line bg-surface p-6">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-lg font-semibold text-ink">{name}</h3>
        {soon && <Badge tone="zafaron">{soon}</Badge>}
      </div>
      {price && <p className="num mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-ink">{price} <span className="text-base font-normal text-ink-3">{t("salary.currency.UZS")}</span></p>}
      <p className="mt-3 flex flex-1 items-start gap-2 text-ink-2"><Check className="mt-1 size-4 shrink-0 text-firuza" />{body}</p>
      <div className="mt-6">{action}</div>
    </div>
  );
}
