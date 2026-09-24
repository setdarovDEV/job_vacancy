import { Bell, Check, MousePointer2 } from "lucide-react";
import { Fragment, type CSSProperties, type ReactNode } from "react";

import { useSession } from "~/shared/auth/session";
import { GirihPattern } from "~/shared/brand/GirihPattern";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation, type TFunction } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { groupDigits } from "~/shared/lib/format";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { postHref, SecondaryCta } from "./parts";

/** "Find the right *people* faster" → the starred word in lapis. The sentence stays one translation. */
function accent(text: string) {
  return text.split("*").map((part, i) => (
    <Fragment key={i}>{i % 2 ? <span className="text-lapis">{part}</span> : part}</Fragment>
  ));
}

/**
 * Hero: aurora + girih, H1, lead, CTAs and a live-looking product preview built from the real
 * UI pieces (badges, avatars, kanban cards). The text never fades in (it is the LCP); only the
 * decorative aurora and the floating notification animate.
 */
export function Hero() {
  const { t } = useTranslation();
  const { user } = useSession();

  return (
    <section aria-labelledby="employers-title" className="relative isolate">
      {/* Runs up under the header, which is clear at rest, so the page starts in colour. */}
      <div
        aria-hidden="true"
        className="aurora-hero aurora-fade anim-fade pointer-events-none absolute inset-x-0 -top-(--header-h) bottom-0 -z-10"
        style={{ animationDuration: "var(--dur-4)" }}
      />
      <GirihPattern className="-z-10" focus="ellipse 60% 70% at 25% 35%" />
      <div className="container-page grid items-center gap-10 pb-12 pt-8 sm:pt-14 md:pb-20 md:pt-24 lg:grid-cols-2 lg:gap-12">
        <div className="min-w-0">
          <p className="glass-panel mb-4 flex w-fit max-w-full items-center gap-2 rounded-pill px-3.5 py-1.5 text-sm font-medium text-ink-2 md:mb-6">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-firuza" />
            <span className="min-w-0">{t("employersPage.eyebrow")}</span>
          </p>
          <h1
            id="employers-title"
            className="max-w-2xl break-words font-display text-2xl font-semibold tracking-display text-ink sm:text-4xl md:text-5xl lg:text-4xl xl:text-5xl"
          >
            {accent(t("employersPage.title"))}
          </h1>
          <p className="mt-4 max-w-xl text-lead text-ink-2 md:mt-5">{t("employersPage.lead")}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row md:mt-9">
            <Button asChild size="lg" shape="pill">
              <LocalizedLink to={postHref(user)}>{t("nav.postVacancy")}</LocalizedLink>
            </Button>
            {/* Anonymous visitors (and the server render) get "sign in"; employers their cabinet. */}
            <SecondaryCta />
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
            {(["free", "languages", "telegram"] as const).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <Check aria-hidden="true" className="size-4 shrink-0 text-firuza-ink" />
                {t(`employersPage.trust.${k}`)}
              </li>
            ))}
          </ul>
        </div>
        <ProductMock />
      </div>
    </section>
  );
}

type Person = { id: "a" | "b" | "c" | "d" | "e" | "f"; exp: "1_3" | "3_6" | "6_plus"; hours: number };
const columns: { status: "sent" | "interview" | "hired"; count: number; people: Person[] }[] = [
  { status: "sent", count: 12, people: [{ id: "a", exp: "3_6", hours: 1 }, { id: "b", exp: "1_3", hours: 3 }, { id: "c", exp: "6_plus", hours: 5 }] },
  { status: "interview", count: 3, people: [{ id: "d", exp: "3_6", hours: 20 }, { id: "e", exp: "1_3", hours: 26 }] },
  { status: "hired", count: 1, people: [{ id: "f", exp: "6_plus", hours: 50 }] },
];

// Views over the last 14 days for the mini sparkline (viewBox 0 0 100 28).
const spark = "M0 22 L8 20 L15 21 L23 16 L31 18 L38 13 L46 15 L54 10 L62 12 L69 8 L77 9 L85 5 L92 6 L100 2";

/**
 * A crisp, text-based preview of the applications kanban (no screenshot to download or blur).
 * One image-like unit for assistive tech; the content is illustrative, so it is labelled as a
 * sample. Glass frame over the aurora, solid app surface inside (never glass in glass).
 */
function ProductMock() {
  const { t } = useTranslation();
  const vacancy = t("employersPage.mock.vacancy");
  return (
    <div role="img" aria-label={t("employersPage.mock.label")} className="relative min-w-0">
      <div className="glass-panel rounded-sheet p-2">
        {/* Fixed proportions: nothing inside can shift the page; wider (shorter) while it spans the full width. */}
        <div className="flex aspect-4/3 flex-col overflow-hidden rounded-inner border border-line bg-surface sm:aspect-video lg:aspect-4/3">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{vacancy}</p>
              <p className="num truncate text-xs text-ink-2">{t("employersPage.mock.applicants", { count: 24, n: 24 })}</p>
            </div>
            <Badge tone="firuza">{t("vacancyStatus.published")}</Badge>
          </div>
          <dl className="hidden grid-cols-3 divide-x divide-line border-b border-line sm:grid">
            <Kpi label={t("dashboardPage.kpi.views")} value={groupDigits(1284)}>
              <svg aria-hidden="true" viewBox="0 0 100 28" preserveAspectRatio="none" className="mt-1 block h-5 w-full text-lapis">
                <path d={spark} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
            </Kpi>
            <Kpi label={t("dashboardPage.kpi.fresh")} value={groupDigits(12)} tone="text-lapis-ink" />
            <Kpi label={t("dashboardPage.kpi.applications")} value={groupDigits(24)} />
          </dl>
          {/* Phones get two roomier columns; the "hired" one joins from sm. The bottom fades out (aurora-fade is
              a plain bottom mask), so the board reads as continuing below the frame. */}
          <div className="grid min-h-0 flex-1 aurora-fade grid-cols-2 gap-2 p-2 sm:grid-cols-3 sm:gap-3 sm:p-3">
            {columns.map((col, ci) => (
              <div key={col.status} className={cn("min-w-0 flex-col gap-2 rounded-control bg-sunken/70 p-1.5 sm:p-2", ci === 2 ? "hidden sm:flex" : "flex")}>
                <div className="flex min-w-0 items-center justify-between gap-1 px-1">
                  <span className="truncate text-xs font-semibold text-ink-2">{t(`enums.application_status.${col.status}`)}</span>
                  <span className="num rounded-pill bg-surface px-1.5 text-2xs font-semibold text-ink-2">{col.count}</span>
                </div>
                {col.people.map((p, pi) => (
                  <MockCard key={p.id} person={p} t={t} lifted={ci === 1 && pi === 0} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* The "new application" toast: depth for the preview on tablets and up; it springs in once. */}
      <div
        aria-hidden="true"
        className="surface-card anim-enter absolute -bottom-6 -left-3 hidden w-72 items-center gap-3 p-3 shadow-3 sm:flex"
        style={{ "--i": 6 } as CSSProperties}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-control bg-firuza-soft text-firuza-ink">
          <Bell className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{t("employersPage.mock.newTitle")}</p>
          <p className="truncate text-xs text-ink-2">
            {t("employersPage.mock.newBody", { name: t("employersPage.mock.people.a"), vacancy })}
          </p>
        </div>
        <span className="ml-auto shrink-0 self-start text-2xs text-ink-2">{t("time.justNow")}</span>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = "text-ink", children }: { label: string; value: string; tone?: string; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col px-4 py-3">
      <dt className="truncate text-xs text-ink-2">{label}</dt>
      <dd className={cn("num font-display text-lg font-semibold tracking-heading", tone)}>
        {value}
        {children}
      </dd>
    </div>
  );
}

function MockCard({ person, t, lifted }: { person: Person; t: TFunction; lifted?: boolean }) {
  const name = t(`employersPage.mock.people.${person.id}`);
  return (
    <div
      className={cn(
        "relative min-w-0 rounded-control border border-line bg-surface p-2 shadow-1",
        // The card being dragged to the next stage: tilted, lifted, lapis edge (as in the real kanban).
        lifted && "rotate-1 border-lapis shadow-3",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Avatar name={name} size="xs" />
        <span className="min-w-0 truncate text-xs font-semibold text-ink">{name}</span>
      </div>
      <p className="mt-1 truncate text-2xs text-ink-2">{t(`enums.experience.${person.exp}`)}</p>
      <p className="hidden truncate text-2xs text-ink-2 sm:block">{t("time.hours", { count: person.hours })}</p>
      {lifted && <MousePointer2 aria-hidden="true" className="absolute -bottom-2 right-1 size-5 fill-ink text-surface" />}
    </div>
  );
}
