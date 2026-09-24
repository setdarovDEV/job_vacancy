import { BadgeCheck, Star } from "lucide-react";
import type { CSSProperties } from "react";
import { useViewTransitionState } from "react-router";

import type { Schemas } from "../api/client";
import { indexCatalog, nameOf, useCatalog, type Catalog } from "../catalog/catalog";
import { localizedPath } from "../i18n/config";
import { useLocale } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { salary } from "../lib/format";
import { useSpotlight } from "../lib/spotlight";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Card, CardLink } from "../ui/Card";
import { RelTime } from "../ui/RelTime";
import { Skeleton } from "../ui/Skeleton";
import { SaveButton } from "./SaveButton";

export type VacancyCard = Schemas["VacancyCard"];

// One lookup table per catalog, shared by every card (a list paints 20+ of them at once).
const indexes = new WeakMap<Catalog, ReturnType<typeof indexCatalog>>();
function useCatalogIndex() {
  const catalog = useCatalog();
  let idx = indexes.get(catalog);
  if (!idx) indexes.set(catalog, (idx = indexCatalog(catalog)));
  return idx;
}

// Staggered entrance only for the first rows of a freshly painted list (never appended pages).
const MAX_STAGGER = 8;

// The card lays itself out by its own width (container query), so the same component works in
// the full-width results list, in two-column grids and in narrow asides:
//   narrow: [logo · TOP · time · ♡] header row, then the title and the rest at full width;
//   ≥ 32rem: logo column on the left, everything else beside it, heart top-right.
const grid = "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 @lg:gap-x-4";
const body = "col-span-3 @lg:col-span-1 @lg:col-start-2";

/**
 * One vacancy in a list: a solid card whose title link is stretched over the whole card, with
 * the save heart above it. Job seekers scan title → company → salary → place, in that order.
 * `variant="plain"` drops the card surface for rows inside an already-divided container.
 */
export function VacancyRow({
  v, showStatus, index, priority, variant = "card", headingAs: Heading = "h3", className,
}: {
  v: VacancyCard;
  /** Show the status badge for non-published vacancies (saved lists). */
  showStatus?: boolean;
  /** Position in a freshly painted list: the first 8 rows fade up in turn. Omit for appended pages. */
  index?: number;
  /** Above the fold: the logo loads eagerly. */
  priority?: boolean;
  variant?: "card" | "plain";
  /** Title level for the page outline: h2 when the list sits right under the page's H1. */
  headingAs?: "h2" | "h3";
  className?: string;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const idx = useCatalogIndex();
  const to = `/vacancies/${v.slug}`;
  // Only the card being opened gets view-transition names: every name is a separate snapshot,
  // so naming all 20 cards would make each navigation slower.
  const morph = useViewTransitionState(localizedPath(locale, to));
  const region = nameOf(idx.regions.get(v.district_id ?? v.region_id)?.name ?? idx.regions.get(v.region_id)?.name, locale);
  const hasPay = v.salary != null && (v.salary.min != null || v.salary.max != null);
  const enter = index != null && index < MAX_STAGGER;
  const facts = [
    t(`enums.work_format.${v.work_format}`),
    t(`enums.experience.${v.experience}`),
    t(`enums.employment_type.${v.employment_type}`),
  ];

  const content = (
    <div className={grid}>
      <Avatar
        name={v.company.name}
        src={v.company.logo_url}
        square
        size="md"
        priority={priority}
        className="@lg:row-span-5 @lg:size-14 @lg:text-lg"
        style={morph ? { viewTransitionName: `vacancy-logo-${v.id}` } : undefined}
      />
      <div className="flex min-h-10 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 self-center @lg:min-h-0 @lg:self-start @lg:pt-0.5">
        {v.is_featured && (
          <Badge tone="zafaron" icon={<Star className="fill-current" />}>{t("common.featured")}</Badge>
        )}
        {showStatus && v.status !== "published" && <Badge tone="neutral">{t(`vacancyStatus.${v.status}`)}</Badge>}
        {v.published_at && <RelTime iso={v.published_at} className="text-sm text-ink-2" />}
      </div>
      <Heading
        className={cn(body, "mt-3 line-clamp-3 break-words text-lead font-semibold tracking-snug text-ink @lg:mt-1.5 @lg:line-clamp-2")}
        style={morph ? { viewTransitionName: `vacancy-title-${v.id}` } : undefined}
      >
        <CardLink to={to} prefetch="intent" viewTransition className="visited:text-ink-2">
          {v.title}
        </CardLink>
      </Heading>

      <p className={cn(body, "mt-1 flex min-w-0 items-center gap-1.5 text-md text-ink-2")}>
        <span className="truncate">{v.company.name}</span>
        {v.company.verified && (
          <>
            <BadgeCheck className="size-4.5 shrink-0 fill-firuza text-surface" aria-hidden="true" />
            <span className="sr-only">{t("common.verified")}</span>
          </>
        )}
        {region && (
          <>
            <span aria-hidden="true" className="text-ink-3">·</span>
            {/* When both don't fit, the place gives way first: the employer matters more. */}
            <span className="min-w-12 shrink-3 truncate">{region}</span>
          </>
        )}
      </p>

      {/* Money is firuza in the display face; "negotiable" isn't money, so it stays quiet. */}
      <p
        className={cn(
          body,
          "mt-3",
          hasPay ? "num font-display text-lg font-semibold tracking-heading text-firuza-ink" : "text-md font-medium text-ink-2",
        )}
      >
        {salary(v.salary, t, locale)}
      </p>

      {/* One line of facts: whatever doesn't fit wraps onto a clipped second line (no ragged rows). */}
      <ul className={cn(body, "mt-3 flex h-6 flex-wrap gap-1.5 overflow-hidden")}>
        {facts.map((f) => (
          <li key={f} className="flex max-w-full"><Badge>{f}</Badge></li>
        ))}
        {v.skills.slice(0, 4).map((s) => (
          <li key={s.id} className="flex max-w-full"><Badge tone="outline">{s.name}</Badge></li>
        ))}
      </ul>

      {/* Last in the DOM (the title link comes first for keyboard users), top-right on screen;
          pulled into the corner by the button's padding, above the stretched link. */}
      <div className="relative z-10 col-start-3 row-start-1 -mr-1.5 -mt-0.5 @lg:-mr-2 @lg:-mt-2">
        <SaveButton id={v.id} />
      </div>
    </div>
  );

  const style = enter ? ({ "--i": index } as CSSProperties) : undefined;

  if (variant === "plain") {
    return (
      <article
        style={style}
        className={cn(
          "@container relative p-4 transition-colors duration-150 hover:bg-sunken/60 sm:p-5",
          // The stretched link hides its own outline; the row shows the ring (inset: rows sit
          // edge to edge in a divided container).
          "has-[[data-card-link]:focus-visible]:outline-2 has-[[data-card-link]:focus-visible]:-outline-offset-2 has-[[data-card-link]:focus-visible]:outline-focus",
          enter && "anim-enter",
          className,
        )}
      >
        {content}
      </article>
    );
  }

  return (
    <Card
      as="article"
      interactive
      padding="none"
      style={style}
      className={cn("@container spotlight p-4 sm:p-5 md:p-6", enter && "anim-enter", className)}
    >
      {/* Featured: a za'faron hairline on its own layer, so it never fights the card's hover shadow. */}
      {v.is_featured && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-zafaron/45" />
      )}
      {content}
    </Card>
  );
}

/**
 * The standard vacancy list: cards with a gap, one pointer-spotlight listener for all of them.
 * `enter` = how many leading items belong to a fresh first paint (they stagger in; pass 0 or
 * omit it for lists that shouldn't animate). Key the list by its query to replay on new results.
 */
export function VacancyList({
  items, showStatus, enter = 0, headingAs, className,
}: {
  items: VacancyCard[];
  showStatus?: boolean;
  enter?: number;
  headingAs?: "h2" | "h3";
  className?: string;
}) {
  const list = useSpotlight<HTMLUListElement>();
  return (
    <ul ref={list} className={cn("flex flex-col gap-3", className)}>
      {items.map((v, i) => (
        <li key={v.id} className="min-w-0">
          <VacancyRow v={v} showStatus={showStatus} index={i < enter ? i : undefined} priority={i < 3} headingAs={headingAs} />
        </li>
      ))}
    </ul>
  );
}

/** Placeholder shaped exactly like VacancyRow (same padding, grid and line heights). */
export function VacancyRowSkeleton({ variant = "card", className }: { variant?: "card" | "plain"; className?: string } = {}) {
  return (
    <div
      aria-hidden="true"
      className={cn("@container p-4 sm:p-5", variant === "card" && "surface-card md:p-6", className)}
    >
      <div className={grid}>
        <Skeleton className="size-10 rounded-control @lg:row-span-5 @lg:size-14" />
        <div className="flex min-h-10 items-center @lg:min-h-0 @lg:pt-0.5">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className={cn(body, "mt-3 flex h-6.5 items-center @lg:mt-1.5")}>
          <Skeleton className="h-4.5 w-3/4" />
        </div>
        <div className={cn(body, "mt-1 flex h-5.5 items-center")}>
          <Skeleton className="h-3.5 w-1/2" />
        </div>
        <div className={cn(body, "mt-3 flex h-7 items-center")}>
          <Skeleton className="h-5 w-36" />
        </div>
        <div className={cn(body, "mt-3 flex h-6 gap-1.5")}>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
        {/* The heart's box, with the same pull into the corner. */}
        <div className="col-start-3 row-start-1 -mr-1.5 -mt-0.5 size-10 pointer-coarse:size-11 @lg:-mr-2 @lg:-mt-2" />
      </div>
    </div>
  );
}

/** A loading list of `count` skeleton cards, announced once as "Loading". */
export function VacancyListSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" className={cn("flex flex-col gap-3", className)}>
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: count }, (_, i) => <VacancyRowSkeleton key={i} />)}
    </div>
  );
}
