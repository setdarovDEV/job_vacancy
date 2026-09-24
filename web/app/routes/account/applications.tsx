import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { BadgeCheck, ChevronRight, Inbox, ListFilter } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useViewTransitionState } from "react-router";

import { SeekerOnly, useApplicationCounts } from "./layout";
import { api, type Schemas } from "~/shared/api/client";
import { STATUSES, StatusBadge, type AppStatus } from "~/shared/application/status";
import { localizedPath } from "~/shared/i18n/config";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { useSpotlight } from "~/shared/lib/spotlight";
import { authedPage } from "~/shared/query/query";
import { LoadMore } from "~/shared/query/LoadMore";
import { Avatar } from "~/shared/ui/Avatar";
import { Button } from "~/shared/ui/Button";
import { Card, CardLink } from "~/shared/ui/Card";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { RelTime } from "~/shared/ui/RelTime";
import { PageHeader } from "~/shared/ui/Section";
import { SegmentedControl, type SegmentedOption } from "~/shared/ui/SegmentedControl";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";

type App = Schemas["Application"];
type Filter = AppStatus | "all";

export default function Applications() {
  return <SeekerOnly><List /></SeekerOnly>;
}

function List() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Filter>("all");
  const counts = useApplicationCounts();
  const q = useInfiniteQuery({
    queryKey: ["my-applications", status === "all" ? null : status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      authedPage<App>(() =>
        api.GET("/me/applications", { params: { query: { status: status === "all" ? undefined : status, cursor: pageParam } } }),
      ),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
    // Switching the filter keeps the previous list (dimmed) until the new one arrives.
    placeholderData: keepPreviousData,
  });
  const loading = useSkeletonHold(q.isPending);
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];

  // Stagger only the very first paint of the list: never on "Load more", refetches or filters.
  const entered = useRef(false);
  useEffect(() => {
    if (q.data) entered.current = true;
  }, [q.data]);
  const enter = !entered.current;

  const c = counts.data;
  const none = c?.complete && c.total === 0;
  // Exact counts only: with more applications than we count, the chips stay but lose numbers.
  const options: SegmentedOption<Filter>[] = [
    { value: "all", label: t("applications.all"), count: c?.complete ? c.total : undefined },
    ...STATUSES.filter((s) => !c?.complete || (c.by[s] ?? 0) > 0 || s === status).map((s) => ({
      value: s,
      label: t(`enums.application_status.${s}`),
      count: c?.complete ? (c.by[s] ?? 0) : undefined,
    })),
  ];

  return (
    <>
      <PageHeader title={t("nav.applications")} description={t("applications.hint")} />
      {!none && (
        <div className="mb-5 min-h-11">
          {counts.isPending ? (
            <Skeleton className="h-11 w-full max-w-md" />
          ) : (
            <SegmentedControl label={t("accountPage.statusFilter")} value={status} onChange={setStatus} options={options} className="max-w-full" />
          )}
        </div>
      )}
      {loading ? (
        <SkeletonDelay>
          <ApplicationSkeleton />
        </SkeletonDelay>
      ) : q.isError && !items.length ? (
        <Card padding="none">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Card>
      ) : items.length === 0 ? (
        <Card padding="none">
          {status === "all" ? (
            <EmptyState
              icon={<Inbox />}
              title={t("applications.emptyTitle")}
              body={t("applications.emptyBody")}
              action={<Button asChild><LocalizedLink to="/vacancies" prefetch="intent">{t("accountPage.findJobs")}</LocalizedLink></Button>}
            />
          ) : (
            <EmptyState
              icon={<ListFilter />}
              title={t("applications.emptyFiltered")}
              body={t("accountPage.emptyFilteredBody")}
              action={<Button variant="secondary" onClick={() => setStatus("all")}>{t("accountPage.showAll")}</Button>}
            />
          )}
        </Card>
      ) : (
        <AppList items={items} enter={enter} busy={q.isPlaceholderData} />
      )}
      <LoadMore hasNext={q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} loadedCount={items.length} className="mt-4" />
    </>
  );
}

// Own component so the spotlight listener binds when the list itself mounts (after loading).
function AppList({ items, enter, busy }: { items: App[]; enter: boolean; busy: boolean }) {
  const list = useSpotlight<HTMLUListElement>();
  return (
    <ul ref={list} aria-busy={busy || undefined} className={cn("flex flex-col gap-3 transition-opacity duration-200", busy && "opacity-60")}>
      {items.map((a, i) => (
        <ApplicationRow key={a.id} a={a} className={enter && i < 8 ? "anim-enter" : undefined} style={enter ? ({ "--i": i } as CSSProperties) : undefined} />
      ))}
    </ul>
  );
}

function ApplicationRow({ a, className, style }: { a: App; className?: string; style?: CSSProperties }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const v = a.vacancy;
  const to = `/me/applications/${a.id}`;
  // Name only the row being opened, so the title and logo morph into the detail header.
  const vt = useViewTransitionState(localizedPath(locale, to));
  const updated = a.status_changed_at ?? a.created_at;
  return (
    <li className={className} style={style}>
      <Card
        interactive
        padding="none"
        className="spotlight grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-2.5 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:p-5"
      >
        <Avatar
          name={v?.company.name ?? "?"}
          src={v?.company.logo_url}
          square
          size="md"
          style={vt && v ? { viewTransitionName: `vacancy-logo-${v.id}` } : undefined}
        />
        <div className="min-w-0">
          <h2 className="line-clamp-2 break-words text-lead font-semibold tracking-snug text-ink">
            <CardLink to={to} prefetch="intent" viewTransition style={vt && v ? { viewTransitionName: `vacancy-title-${v.id}` } : undefined}>
              {v?.title ?? t("accountPage.vacancyGone")}
            </CardLink>
          </h2>
          {v && (
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-ink-2">
              <span className="truncate">{v.company.name}</span>
              {v.company.verified && (
                <BadgeCheck className="size-4 shrink-0 text-firuza" aria-label={t("common.verified")} role="img" />
              )}
            </p>
          )}
        </div>
        <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:col-start-3 sm:flex-col sm:items-end sm:gap-1.5">
          <StatusBadge status={a.status ?? "sent"} />
          {updated && <RelTime iso={updated} template={(when) => t("resume.updated", { when })} className="text-sm text-ink-2" />}
        </div>
        <ChevronRight aria-hidden="true" className="hidden size-5 text-ink-3 sm:block" />
      </Card>
    </li>
  );
}

function ApplicationSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true" className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="surface-card grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:p-5">
            <Skeleton className="size-10 rounded-control" />
            <div className="flex min-w-0 flex-col gap-2 pt-0.5">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-4 w-2/5" />
            </div>
            <div className="col-start-2 flex items-center gap-3 sm:col-start-3 sm:flex-col sm:items-end sm:gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <span className="hidden size-5 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
