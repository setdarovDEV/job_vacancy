import { Check, Search, X } from "lucide-react";

import { useSession } from "~/shared/auth/session";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { money } from "~/shared/lib/format";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { band, est, SectionHead } from "./parts";

const people = [
  { id: "c", exp: "3_6", salary: 15_000_000, skills: ["React", "TypeScript"] },
  { id: "b", exp: "1_3", salary: 9_000_000, skills: ["Vue", "JavaScript"] },
  { id: "e", exp: "6_plus", salary: 22_000_000, skills: ["React", "Next.js"] },
] as const;

/**
 * Candidate search teaser. The real search sits behind an employer account, so the right side is
 * a labelled sample of its results (search field, applied filters, rows with Invite) built from
 * the same pieces; the CTA leads to the real page for employers and to sign-up for everyone else.
 */
export function CandidatesTeaser() {
  const { t } = useTranslation();
  const { user } = useSession();
  const cta = user?.role === "employer"
    ? { to: "/employer/candidates", label: t("account.candidates") }
    : { to: "/register?role=employer", label: t("employersPage.candidates.cta") };

  return (
    <section aria-labelledby="employers-candidates" className={band} style={est(48)}>
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="min-w-0">
          <SectionHead
            id="employers-candidates"
            eyebrow={t("employersPage.candidates.eyebrow")}
            title={t("employersPage.candidates.title")}
            description={t("employersPage.candidates.body")}
          />
          <ul className="mt-6 space-y-3">
            {(["b1", "b2", "b3"] as const).map((k) => (
              <li key={k} className="flex gap-3 text-md text-ink">
                <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-firuza-soft text-firuza-ink">
                  <Check className="size-3.5" />
                </span>
                <span className="min-w-0">{t(`employersPage.candidates.${k}`)}</span>
              </li>
            ))}
          </ul>
          <Button asChild size="lg" shape="pill" variant="secondary" className="mt-8 w-full sm:w-auto">
            <LocalizedLink to={cta.to} prefetch="intent">{cta.label}</LocalizedLink>
          </Button>
        </div>
        <SearchMock />
      </div>
    </section>
  );
}

function SearchMock() {
  const { t } = useTranslation();
  const locale = useLocale();
  const role = t("employersPage.candidates.query");
  const chips = [t("enums.experience.3_6"), t("employersPage.candidates.city"), t("employersPage.candidates.english")];
  return (
    <Card role="img" aria-label={t("employersPage.candidates.mockLabel")} radius="sheet" padding="none" className="reveal min-w-0 overflow-hidden shadow-3 lg:order-first">
      <div className="border-b border-line p-3 md:p-4">
        <div className="flex gap-2">
          <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-md text-ink">
            <Search aria-hidden="true" className="size-4.5 shrink-0 text-ink-3" />
            <span className="truncate">{role}</span>
          </div>
          <div className="grid h-11 shrink-0 place-items-center rounded-control bg-lapis px-4 text-md font-semibold text-on-lapis">
            {t("search.submit")}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span key={c} className="inline-flex h-8 items-center gap-1 rounded-pill bg-lapis-soft pl-3 pr-2 text-sm text-lapis-ink">
              {c}
              <X aria-hidden="true" className="size-3.5" />
            </span>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {people.map((p) => {
          const name = t(`employersPage.mock.people.${p.id}`);
          return (
            <li key={p.id} className="flex gap-3 p-3 md:p-4">
              <Avatar name={name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline justify-between gap-3">
                  <p className="truncate text-md font-semibold text-ink">{name}</p>
                  <p className="num shrink-0 font-display text-md font-semibold text-firuza-ink">{money(p.salary, "UZS", t, locale)}</p>
                </div>
                <p className="truncate text-sm text-ink-2">
                  {t("employersPage.candidates.meta", { role, experience: t(`enums.experience.${p.exp}`) })}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {p.skills.map((s) => <Badge key={s}>{s}</Badge>)}
                  <span className="ml-auto hidden h-9 shrink-0 items-center rounded-control border border-line-strong px-3 text-sm font-medium text-ink sm:inline-flex">
                    {t("candidates.invite")}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
