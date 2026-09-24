import {
  keepPreviousData, useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient,
  type InfiniteData, type QueryClient, type QueryKey,
} from "@tanstack/react-query";
import {
  Archive, Building2, CalendarClock, Check, ChevronRight, Clock, Eye, FilePen, Image as ImageIcon, Inbox, ListFilter,
  MoreHorizontal, PencilLine, Plus, RotateCcw, Send, ShieldAlert, Sparkles, Trash2, Users,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useViewTransitionState } from "react-router";

import { CompanySwitcher, EmployerOnly, VerifiedName } from "./EmployerOnly";
import { useMyCompany, type Company } from "./company-hook";
import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { localizedPath } from "~/shared/i18n/config";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { dayLabel, groupDigits } from "~/shared/lib/format";
import { ApiFailure, authed, authedPage, type Page } from "~/shared/query/query";
import { LoadMore } from "~/shared/query/LoadMore";
import { Badge, type BadgeTone } from "~/shared/ui/Badge";
import { Button, IconButton } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { useConfirm } from "~/shared/ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "~/shared/ui/DataTable";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from "~/shared/ui/Menu";
import { popoverItem } from "~/shared/ui/Popover";
import { Progress } from "~/shared/ui/Progress";
import { RelTime } from "~/shared/ui/RelTime";
import { PageHeader } from "~/shared/ui/Section";
import { SegmentedControl, segmentedPanelProps, type SegmentedOption } from "~/shared/ui/SegmentedControl";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";
import { StatCard } from "~/shared/ui/StatCard";
import { toast } from "~/shared/ui/toast-store";

type Vacancy = Schemas["VacancyCard"];
type Status = Schemas["VacancyStatus"];
type Tab = Status | "all";
type Stats = Partial<Record<Schemas["ApplicationStatus"], number>>;

const STATUSES: Status[] = ["published", "moderation", "draft", "rejected", "archived", "expired"];
const TONE: Record<Status, BadgeTone> = { draft: "neutral", moderation: "zafaron", published: "firuza", rejected: "anor", archived: "outline", expired: "outline" };
const SUBMITTABLE: Status[] = ["draft", "rejected", "archived", "expired"];
// Column ids (a constant, not literals: test/i18n-keys.mjs reads every `key: "…"` as a message key).
const COL = { title: "title", views: "views", apps: "apps", expires: "expires", actions: "actions" } as const;
// FN-04 warns employers 3 days before a vacancy expires; the dashboard uses the same horizon.
const EXPIRY_WARN_DAYS = 3;
const DAY = 86_400_000;

const kanbanPath = (v: Vacancy) => `/employer/vacancies/${v.id}/applications`;
const editPath = (v: Vacancy) => `/employer/vacancies/${v.id}/edit`;
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);

export default function Dashboard() {
  return <EmployerOnly><Page /></EmployerOnly>;
}

function Page() {
  const { t } = useTranslation();
  const my = useMyCompany();
  const loading = useSkeletonHold(my.isPending);
  if (loading) {
    return (
      <SkeletonDelay>
        <DashboardSkeleton />
      </SkeletonDelay>
    );
  }
  if (my.isError) {
    return (
      <Card padding="none">
        <ErrorState error={my.error} headingAs="h1" onRetry={() => my.refetch()} />
      </Card>
    );
  }
  if (!my.company) {
    return (
      <>
        <PageHeader title={t("employer.welcomeTitle")} description={t("employer.welcomeBody")} />
        <Onboarding company={null} total={0} />
      </>
    );
  }
  // Keyed: switching companies starts every list (tabs, pages) from scratch.
  return <Overview key={my.company.id} company={my.company} />;
}

/* ---- data ------------------------------------------------------------------------------- */

type OverviewData = { items: Vacancy[]; complete: boolean };
const OVERVIEW_PAGES = 4;

/**
 * Every vacancy of the company, for the KPIs, the status counts and "needs attention". The API has
 * no per-company totals, so they are counted here from at most 4 pages of 50; past that `complete`
 * is false and the numbers are shown as "200+" instead of a wrong exact value. Shares the
 * ["company-vacancies", id] prefix, so every edit elsewhere refreshes it too.
 */
function useOverview(companyId: string) {
  return useQuery({
    queryKey: ["company-vacancies", companyId, "overview"],
    staleTime: 15_000,
    queryFn: async (): Promise<OverviewData> => {
      const items: Vacancy[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await authedPage<Vacancy>(() =>
          api.GET("/companies/{company}/vacancies", { params: { path: { company: companyId }, query: { limit: 50, cursor } } }),
        );
        items.push(...page.data);
        cursor = page.meta.next_cursor ?? undefined;
      } while (cursor && ++pages < OVERVIEW_PAGES);
      return { items, complete: !cursor };
    },
  });
}

// "New" applications are the ones nobody on the team has opened yet ("sent"); only the per-vacancy
// kanban stats know them. Same cache key as the kanban header, so moves there show up here.
const STATS_CAP = 12;

function useFreshCounts(items: Vacancy[]) {
  const withApps = items.filter((v) => v.applications_count > 0);
  // Live vacancies first: that's where new applications arrive.
  const targets = [...withApps].sort((a, b) => Number(b.status === "published") - Number(a.status === "published")).slice(0, STATS_CAP);
  const results = useQueries({
    queries: targets.map((v) => ({
      queryKey: ["application-stats", v.id],
      staleTime: 30_000,
      queryFn: () => authed<Stats>(() => api.GET("/vacancies/{vacancy}/applications/stats", { params: { path: { vacancy: v.id } } })),
    })),
  });
  const by = new Map<string, number>();
  targets.forEach((v, i) => {
    const s = results[i]?.data;
    if (s) by.set(v.id, s.sent ?? 0);
  });
  let total = 0;
  by.forEach((n) => (total += n));
  return {
    by,
    total,
    pending: results.some((r) => r.isPending),
    failed: results.some((r) => r.isError),
    complete: withApps.length <= STATS_CAP,
  };
}
type Fresh = ReturnType<typeof useFreshCounts>;

/** Moderator's reasons for rejected vacancies (the list cards don't carry them). Same key as kanban. */
function useRejectReasons(items: Vacancy[]) {
  const rejected = items.filter((v) => v.status === "rejected").slice(0, 4);
  const results = useQueries({
    queries: rejected.map((v) => ({
      queryKey: ["vacancy", v.id],
      staleTime: 60_000,
      queryFn: () => authed<Schemas["VacancyDetail"]>(() => api.GET("/vacancies/{vacancy}", { params: { path: { vacancy: v.id } } })),
    })),
  });
  const by = new Map<string, string>();
  results.forEach((r) => r.data?.reject_reason && by.set(r.data.id, r.data.reject_reason));
  return by;
}

/* ---- optimistic list edits ----------------------------------------------------------------- */

type Snapshot = [QueryKey, unknown][];
const isOverview = (d: unknown): d is OverviewData => !!d && Array.isArray((d as OverviewData).items);

/**
 * Applies a status change (or a removal, `next = null`) to every cached list of the company: the
 * overview and each status tab. A row whose new status no longer matches its tab leaves that tab.
 */
function patchLists(qc: QueryClient, companyId: string, id: string, next: Status | null): Snapshot {
  const entries = qc.getQueriesData<unknown>({ queryKey: ["company-vacancies", companyId] });
  for (const [key, data] of entries) {
    if (!data) continue;
    const filter = key[2];
    const edit = (v: Vacancy): Vacancy[] => {
      if (v.id !== id) return [v];
      if (next === null) return [];
      if (typeof filter === "string" && filter !== "overview" && filter !== next) return [];
      return [{ ...v, status: next }];
    };
    if (isOverview(data)) {
      qc.setQueryData<OverviewData>(key, { ...data, items: data.items.flatMap(edit) });
    } else {
      const inf = data as InfiniteData<Page<Vacancy>>;
      qc.setQueryData(key, { ...inf, pages: inf.pages.map((p) => ({ ...p, data: p.data.flatMap(edit) })) });
    }
  }
  return entries;
}

/** Submit / archive / delete with an instant UI, rollback and an error toast on failure. */
function useVacancyActions(company: Company) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const listKey = ["company-vacancies", company.id];

  const begin = async (id: string, next: Status | null) => {
    await qc.cancelQueries({ queryKey: listKey });
    return patchLists(qc, company.id, id, next);
  };
  const rollback = (snap: Snapshot | undefined, e: Error) => {
    snap?.forEach(([k, d]) => qc.setQueryData(k, d));
    toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network") });
  };
  const settle = (v: Vacancy) => {
    void qc.invalidateQueries({ queryKey: listKey });
    void qc.invalidateQueries({ queryKey: ["vacancy", v.id] });
  };

  const submit = useMutation<Schemas["VacancyDetail"], Error, Vacancy, Snapshot>({
    mutationFn: (v) => authed(() => api.POST("/vacancies/{vacancy}/submit", { params: { path: { vacancy: v.id } } })),
    // Verified companies publish straight away; the rest go to moderation. The answer corrects it.
    onMutate: (v) => begin(v.id, company.verified ? "published" : "moderation"),
    onSuccess: (d, v) => {
      patchLists(qc, company.id, v.id, d.status);
      toast({ tone: "success", title: d.status === "published" ? t("employer.published") : t("employer.sentToModeration") });
    },
    onError: (e, _v, snap) => rollback(snap, e),
    onSettled: (_d, _e, v) => settle(v),
  });
  const archive = useMutation<unknown, Error, Vacancy, Snapshot>({
    mutationFn: (v) => authed(() => api.POST("/vacancies/{vacancy}/archive", { params: { path: { vacancy: v.id } } })),
    onMutate: (v) => begin(v.id, "archived"),
    onSuccess: () => toast({ tone: "success", title: t("dashboardPage.archived") }),
    onError: (e, _v, snap) => rollback(snap, e),
    onSettled: (_d, _e, v) => settle(v),
  });
  const remove = useMutation<unknown, Error, Vacancy, Snapshot>({
    mutationFn: (v) => authed(() => api.DELETE("/vacancies/{vacancy}", { params: { path: { vacancy: v.id } } })),
    onMutate: (v) => begin(v.id, null),
    onSuccess: () => toast({ tone: "success", title: t("dashboardPage.deleted") }),
    onError: (e, _v, snap) => rollback(snap, e),
    onSettled: (_d, _e, v) => settle(v),
  });

  return {
    dialog,
    submitting: (v: Vacancy) => submit.isPending && submit.variables?.id === v.id,
    submit: (v: Vacancy) => submit.mutate(v),
    archive: async (v: Vacancy) => {
      const ok = await confirm({ title: t("employer.archiveTitle"), body: t("employer.archiveBody"), confirmLabel: t("employer.archive") });
      if (ok) archive.mutate(v);
    },
    remove: async (v: Vacancy) => {
      const ok = await confirm({ title: t("employer.deleteTitle"), body: t("employer.deleteBody"), confirmLabel: t("common.delete"), tone: "danger" });
      if (ok) remove.mutate(v);
    },
  };
}
type Actions = ReturnType<typeof useVacancyActions>;

/* ---- page ------------------------------------------------------------------------------------ */

function Header({ company }: { company: Company }) {
  const { t } = useTranslation();
  return (
    <PageHeader
      title={
        <>
          <VerifiedName name={company.name} verified={company.verified} iconClassName="size-6 md:size-7" />
          {/* Several companies: the title itself switches between them (Linear-style). */}
          <CompanySwitcher compact className="ml-1 align-middle" />
        </>
      }
      description={company.verified ? t("employer.dashboardHint") : t("employer.unverifiedHint")}
      actions={
        <Button asChild icon={<Plus className="size-4.5" />}>
          <LocalizedLink to="/employer/vacancies/new" prefetch="intent">{t("nav.postVacancy")}</LocalizedLink>
        </Button>
      }
    />
  );
}

function Overview({ company }: { company: Company }) {
  const overview = useOverview(company.id);
  const items = overview.data?.items ?? [];
  const fresh = useFreshCounts(items);
  const reasons = useRejectReasons(items);
  const act = useVacancyActions(company);
  // Started here, not in the table, so it loads in parallel with the overview.
  const [tab, setTab] = useState<Tab>("all");
  const list = useVacancyList(company.id, tab);
  // KPIs and "needs attention" arrive together on the first load, so nothing reshuffles when the
  // stats land; later refreshes keep the numbers on screen.
  const shown = useRef(false);
  const loading = useSkeletonHold(overview.isPending || (!shown.current && overview.isSuccess && fresh.pending));
  const empty = overview.data?.complete && items.length === 0;

  // Entrance stagger for the first paint of the numbers only (never on refetches).
  useEffect(() => {
    if (!loading && overview.data) shown.current = true;
  });
  const enter = !shown.current;

  return (
    <>
      <Header company={company} />
      {loading ? (
        <SkeletonDelay>
          <SummarySkeleton />
        </SkeletonDelay>
      ) : overview.isError ? (
        <Card padding="none" className="mb-8">
          <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
        </Card>
      ) : empty ? (
        <Onboarding company={company} total={0} />
      ) : (
        <div className="flex flex-col gap-8 md:gap-10">
          <Kpis data={overview.data!} fresh={fresh} enter={enter} />
          <Attention company={company} items={items} fresh={fresh} reasons={reasons} act={act} enter={enter} />
          <Vacancies list={list} tab={tab} onTab={setTab} overview={overview.data!} fresh={fresh} act={act} />
        </div>
      )}
      {act.dialog}
    </>
  );
}

// Section titles one step under the H1: in the cabinet's content column the page-level 2xl reads too loud.
const sectionTitle = "font-display text-lg font-semibold tracking-heading text-ink md:text-xl";

function Kpis({ data, fresh, enter }: { data: OverviewData; fresh: Fresh; enter: boolean }) {
  const { t } = useTranslation();
  const { items, complete } = data;
  const count = (s: Status) => items.filter((v) => v.status === s).length;
  const sum = (f: (v: Vacancy) => number) => items.reduce((a, v) => a + f(v), 0);
  // Lower bounds get a "+": partial numbers are never shown as exact ones.
  const n = (value: number, exact = complete) => `${groupDigits(value)}${exact ? "" : "+"}`;
  const moderation = count("moderation");
  const cards = [
    {
      label: t("dashboardPage.kpi.active"),
      value: n(count("published")),
      hint: moderation ? t("dashboardPage.kpi.inModeration", { count: moderation, n: groupDigits(moderation) }) : t("dashboardPage.kpi.activeHint"),
    },
    {
      label: t("dashboardPage.kpi.fresh"),
      value: fresh.failed ? "—" : n(fresh.total, complete && fresh.complete),
      hint: fresh.failed ? t("dashboardPage.kpi.unavailable") : t("dashboardPage.kpi.freshHint"),
      tone: fresh.total > 0 ? ("lapis" as const) : undefined,
    },
    { label: t("dashboardPage.kpi.applications"), value: n(sum((v) => v.applications_count)), hint: t("dashboardPage.kpi.allVacancies") },
    { label: t("dashboardPage.kpi.views"), value: n(sum((v) => v.views_count)), hint: t("dashboardPage.kpi.viewsHint") },
  ];
  return (
    <section aria-labelledby="kpi-title">
      <h2 id="kpi-title" className="sr-only">{t("dashboardPage.kpi.title")}</h2>
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {cards.map((c, i) => (
          <div key={i} className={cn("min-w-0", enter && "anim-enter")} style={enter ? ({ "--i": i } as CSSProperties) : undefined}>
            <StatCard className="h-full" label={c.label} value={c.value} hint={c.hint} tone={c.tone} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---- needs attention ---------------------------------------------------------------------- */

type AttnTone = "lapis" | "anor" | "zafaron" | "neutral";
type AttnItem = {
  id: string;
  tone: AttnTone;
  icon: ReactNode;
  title: string;
  body: ReactNode;
  cta: string;
  to?: string;
  onClick?: () => void;
  busy?: boolean;
};
const tiles: Record<AttnTone, string> = {
  lapis: "bg-lapis-soft text-lapis-ink",
  anor: "bg-anor-soft text-anor-ink",
  zafaron: "bg-zafaron-soft text-zafaron-ink",
  neutral: "bg-sunken text-ink-2",
};
const ATTN_MAX = 6;

/** What needs the employer first (Linear's lesson: what needs you comes before what describes you). */
function Attention({ company, items, fresh, reasons, act, enter }: {
  company: Company; items: Vacancy[]; fresh: Fresh; reasons: Map<string, string>; act: Actions; enter: boolean;
}) {
  const { t } = useTranslation();
  const list: AttnItem[] = [];
  for (const v of items) {
    const n = fresh.by.get(v.id) ?? 0;
    if (n > 0) {
      list.push({
        id: `new-${v.id}`, tone: "lapis", icon: <Inbox />, title: v.title, to: kanbanPath(v), cta: t("dashboardPage.attn.review"),
        body: t("dashboardPage.attn.fresh", { count: n, n: groupDigits(n) }),
      });
    }
  }
  for (const v of items.filter((x) => x.status === "rejected")) {
    const reason = reasons.get(v.id);
    list.push({
      id: `rej-${v.id}`, tone: "anor", icon: <ShieldAlert />, title: v.title, to: editPath(v), cta: t("dashboardPage.attn.fix"),
      body: reason ? t("dashboardPage.attn.rejectedReason", { reason }) : t("dashboardPage.attn.rejected"),
    });
  }
  for (const v of items) {
    if (v.status === "published" && v.expires_at) {
      const d = daysLeft(v.expires_at);
      if (d <= EXPIRY_WARN_DAYS) {
        list.push({
          id: `exp-${v.id}`, tone: "zafaron", icon: <CalendarClock />, title: v.title, to: kanbanPath(v), cta: t("employer.applications"),
          body: d <= 0 ? t("dashboardPage.attn.expiresToday") : t("dashboardPage.attn.expiresIn", { count: d, n: groupDigits(d) }),
        });
      }
    }
    if (v.status === "expired") {
      list.push({
        id: `exd-${v.id}`, tone: "zafaron", icon: <Clock />, title: v.title, body: t("dashboardPage.attn.expired"),
        cta: t("dashboardPage.attn.republish"), onClick: () => act.submit(v), busy: act.submitting(v),
      });
    }
  }
  for (const v of items.filter((x) => x.status === "draft")) {
    list.push({
      id: `draft-${v.id}`, tone: "neutral", icon: <FilePen />, title: v.title, to: editPath(v), cta: t("dashboardPage.attn.continue"),
      body: <RelTime iso={v.created_at} template={(when) => t("dashboardPage.attn.draft", { when })} />,
    });
  }
  if (company.my_role !== "recruiter" && !(company.about?.trim() && company.industry_id && company.region_id)) {
    list.push({
      id: "profile", tone: "neutral", icon: <Building2 />, title: t("dashboardPage.attn.profile"), body: t("dashboardPage.attn.profileBody"),
      to: "/employer/company", cta: t("dashboardPage.steps.fill"),
    });
  }
  if (!company.logo_url && company.my_role !== "recruiter") {
    list.push({
      id: "logo", tone: "neutral", icon: <ImageIcon />, title: t("dashboardPage.attn.noLogo"), body: t("dashboardPage.attn.noLogoBody"),
      to: "/employer/company#logo", cta: t("dashboardPage.attn.upload"),
    });
  }
  const shown = list.slice(0, ATTN_MAX);
  const rest = list.length - shown.length;

  return (
    <section aria-labelledby="attention-title">
      <div className="mb-4 flex items-center gap-3">
        <h2 id="attention-title" className={sectionTitle}>{t("dashboardPage.attention")}</h2>
        {list.length > 0 && (
          <span className="num grid h-6 min-w-6 place-items-center rounded-pill bg-lapis-soft px-2 text-xs font-semibold text-lapis-ink">
            {groupDigits(list.length)}
          </span>
        )}
      </div>
      <Card padding="none" className="overflow-hidden">
        {shown.length === 0 ? (
          <div className="flex items-center gap-4 p-5 md:px-6">
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-control bg-firuza-soft text-firuza-ink">
              <Check className="size-5" strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="text-md font-semibold text-ink">{t("dashboardPage.allClear")}</p>
              <p className="text-sm text-ink-2">{t("dashboardPage.allClearBody")}</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((a, i) => (
              <AttentionRow key={a.id} a={a} className={enter && i < 8 ? "anim-enter" : undefined} style={enter ? ({ "--i": i + 4 } as CSSProperties) : undefined} />
            ))}
          </ul>
        )}
        {rest > 0 && (
          <p className="border-t border-line px-5 py-3 text-sm text-ink-2 md:px-6">{t("dashboardPage.attn.more", { count: rest, n: groupDigits(rest) })}</p>
        )}
      </Card>
    </section>
  );
}

function AttentionRow({ a, className, style }: { a: AttnItem; className?: string; style?: CSSProperties }) {
  const bodyId = useId();
  return (
    <li
      className={cn(
        // Grid: on phones a row's button drops under the text instead of squeezing it.
        "relative grid min-h-18 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:gap-x-4 sm:px-5 md:px-6",
        a.to && "transition-colors duration-150 hover:bg-sunken/60 active:bg-sunken",
        "has-[a:focus-visible]:bg-sunken/60 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-focus",
        className,
      )}
      style={style}
    >
      <span aria-hidden="true" className={cn("grid size-10 shrink-0 place-items-center rounded-control [&_svg]:size-5", tiles[a.tone])}>{a.icon}</span>
      <div className="min-w-0">
        <p className="truncate text-md font-semibold text-ink">
          {a.to ? (
            // The title is the link (a meaningful name); the whole row is its target.
            <LocalizedLink to={a.to} prefetch="intent" aria-describedby={bodyId} className="after:absolute after:inset-0 focus-visible:outline-none">
              {a.title}
            </LocalizedLink>
          ) : a.title}
        </p>
        <p id={bodyId} className="line-clamp-2 break-words text-sm text-ink-2">{a.body}</p>
      </div>
      {a.to ? (
        <span aria-hidden="true" className="flex shrink-0 items-center gap-1 text-sm font-medium text-lapis-ink">
          <span className="hidden sm:inline">{a.cta}</span>
          <ChevronRight className="size-4.5" />
        </span>
      ) : (
        <Button type="button" variant="secondary" size="sm" className="relative z-10 max-sm:col-span-2 max-sm:col-start-2 max-sm:justify-self-start" loading={a.busy} icon={<RotateCcw className="size-4" />} onClick={a.onClick}>
          {a.cta}
        </Button>
      )}
    </li>
  );
}

/* ---- vacancies table ------------------------------------------------------------------------ */

function useVacancyList(companyId: string, tab: Tab) {
  const status = tab === "all" ? null : tab;
  return useInfiniteQuery({
    queryKey: ["company-vacancies", companyId, status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => authedPage<Vacancy>(() =>
      api.GET("/companies/{company}/vacancies", { params: { path: { company: companyId }, query: { status: status ?? undefined, cursor: pageParam } } })),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
    // Switching tabs keeps the previous rows (dimmed) until the new ones arrive.
    placeholderData: keepPreviousData,
  });
}

function Vacancies({ list: q, tab, onTab: setTab, overview, fresh, act }: {
  list: ReturnType<typeof useVacancyList>; tab: Tab; onTab: (t: Tab) => void; overview: OverviewData; fresh: Fresh; act: Actions;
}) {
  const { t } = useTranslation();
  const status = tab === "all" ? null : tab;
  const loading = useSkeletonHold(q.isPending);
  const rows = q.data?.pages.flatMap((p) => p.data) ?? [];

  // Exact counts only; with a partial overview the tabs keep their labels without numbers.
  const by = (s: Status) => overview.items.filter((v) => v.status === s).length;
  const exact = overview.complete;
  const options: SegmentedOption<Tab>[] = [
    { value: "all", label: t("applications.all"), count: exact ? overview.items.length : undefined },
    ...STATUSES.filter((s) => !exact || by(s) > 0 || s === tab).map((s) => ({
      value: s,
      label: t(`vacancyStatus.${s}`),
      count: exact ? by(s) : undefined,
    })),
  ];

  const columns: DataTableColumn<Vacancy>[] = [
    { key: COL.title, header: t("dashboardPage.vacancy"), cell: (v) => <TitleCell v={v} /> },
    { key: COL.views, header: t("dashboardPage.views"), align: "end", className: "w-24", cell: (v) => groupDigits(v.views_count) },
    { key: COL.apps, header: t("dashboardPage.applicants"), align: "end", className: "w-32", cell: (v) => <Applicants v={v} fresh={fresh.by.get(v.id)} /> },
    { key: COL.expires, header: t("dashboardPage.expires"), className: "w-32", cell: (v) => <Expiry v={v} /> },
    {
      key: COL.actions,
      header: <span className="sr-only">{t("dashboardPage.actions")}</span>,
      align: "end",
      className: "w-16",
      cell: (v) => <RowMenu v={v} act={act} />,
    },
  ];

  return (
    <section aria-labelledby="vacancies-title">
      <h2 id="vacancies-title" className={cn(sectionTitle, "mb-4")}>{t("dashboardPage.vacancies")}</h2>
      <SegmentedControl
        label={t("dashboardPage.statusTabs")}
        value={tab}
        onChange={setTab}
        options={options}
        tabs={{ idPrefix: "vac" }}
        // Dense like the table it filters; grows to 44px on touch screens.
        size="sm"
        className="mb-4 max-w-full"
      />
      <div {...segmentedPanelProps("vac", tab)} className="rounded-panel focus-visible:outline-offset-4">
        {loading ? (
          <SkeletonDelay>
            <DataTable rows={[]} rowKey={(v) => v.id} columns={columns} loading caption={t("dashboardPage.tableCaption")} />
          </SkeletonDelay>
        ) : q.isError && rows.length === 0 ? (
          <Card padding="none">
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          </Card>
        ) : (
          <DataTable
            rows={rows}
            rowKey={(v) => v.id}
            columns={columns}
            caption={t("dashboardPage.tableCaption")}
            loading={q.isPlaceholderData}
            mobileCard={(v) => <MobileRow v={v} fresh={fresh.by.get(v.id)} act={act} />}
            empty={
              status ? (
                <EmptyState
                  icon={<ListFilter />}
                  title={t("employer.noneInStatus")}
                  body={t("dashboardPage.noneInStatusBody")}
                  action={<Button variant="secondary" onClick={() => setTab("all")}>{t("accountPage.showAll")}</Button>}
                />
              ) : (
                <EmptyState
                  icon={<Sparkles />}
                  title={t("employer.noVacancies")}
                  body={t("employer.noVacanciesBody")}
                  action={
                    <Button asChild icon={<Plus className="size-4.5" />}>
                      <LocalizedLink to="/employer/vacancies/new" prefetch="intent">{t("nav.postVacancy")}</LocalizedLink>
                    </Button>
                  }
                />
              )
            }
          />
        )}
      </div>
      <LoadMore hasNext={q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} loadedCount={rows.length} className="mt-4" />
    </section>
  );
}

function StatusLine({ v }: { v: Vacancy }) {
  const { t } = useTranslation();
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink-2">
      <Badge tone={TONE[v.status]}>{t(`vacancyStatus.${v.status}`)}</Badge>
      <RelTime
        iso={v.published_at ?? v.created_at}
        template={(when) => (v.published_at ? t("jobs.posted", { when }) : t("dashboardPage.created", { when }))}
      />
    </div>
  );
}

/**
 * Only the row being opened gets the shared name, so its title can morph into the applications
 * page header (vacancy-title-{id}, the same name the public vacancy page uses).
 */
function useMorph(v: Vacancy) {
  const locale = useLocale();
  const opening = useViewTransitionState(localizedPath(locale, kanbanPath(v)));
  return opening ? { viewTransitionName: `vacancy-title-${v.id}` } : undefined;
}

function TitleCell({ v }: { v: Vacancy }) {
  const morph = useMorph(v);
  return (
    <div className="min-w-0">
      <LocalizedLink
        to={kanbanPath(v)}
        prefetch="intent"
        viewTransition
        style={morph}
        className="line-clamp-2 break-words text-md font-semibold text-ink transition-colors duration-150 hover:text-lapis-ink"
      >
        {v.title}
      </LocalizedLink>
      <StatusLine v={v} />
    </div>
  );
}

// Table counts skip `num`: Onest's tabular "1" is so wide that "17" reads as "1 7" (the gate
// dropped it from Pagination for the same reason); the column is right-aligned anyway.
function Applicants({ v, fresh }: { v: Vacancy; fresh?: number }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {groupDigits(v.applications_count)}
      {!!fresh && <Badge tone="lapis">{t("dashboardPage.newCount", { count: fresh, n: groupDigits(fresh) })}</Badge>}
    </span>
  );
}

function Expiry({ v }: { v: Vacancy }) {
  const { t } = useTranslation();
  const locale = useLocale();
  if (v.status !== "published" || !v.expires_at) return <span className="text-ink-3">—</span>;
  const soon = daysLeft(v.expires_at) <= EXPIRY_WARN_DAYS;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", soon ? "font-medium text-zafaron-ink" : "text-ink-2")}>
      {/* Phones: the card's fact label already has a calendar icon, and the column is narrow. */}
      {soon && <Clock aria-hidden="true" className="size-4 shrink-0 max-md:hidden" />}
      {dayLabel(v.expires_at, t, locale)}
      {soon && <span className="sr-only">{t("dashboardPage.expiresSoon")}</span>}
    </span>
  );
}

function MobileRow({ v, fresh, act }: { v: Vacancy; fresh?: number; act: Actions }) {
  const { t } = useTranslation();
  const morph = useMorph(v);
  return (
    <div className="relative">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {/* Stretched over the whole card (its p-4 included): the card opens the applications. */}
          <LocalizedLink
            to={kanbanPath(v)}
            prefetch="intent"
            viewTransition
            style={morph}
            className="line-clamp-2 break-words text-md font-semibold text-ink after:absolute after:-inset-4"
          >
            {v.title}
          </LocalizedLink>
          <StatusLine v={v} />
        </div>
        <div className="relative z-10 -mr-2 -mt-2 shrink-0">
          <RowMenu v={v} act={act} />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3">
        <MobileFact icon={<Eye />} label={t("dashboardPage.views")}>{groupDigits(v.views_count)}</MobileFact>
        <MobileFact icon={<Users />} label={t("dashboardPage.applicants")}>
          {groupDigits(v.applications_count)}
          {!!fresh && <span className="ml-1.5 text-sm font-semibold text-lapis-ink">{t("dashboardPage.newCount", { count: fresh, n: groupDigits(fresh) })}</span>}
        </MobileFact>
        <MobileFact icon={<CalendarClock />} label={t("dashboardPage.expires")}><Expiry v={v} /></MobileFact>
      </dl>
    </div>
  );
}

function MobileFact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 truncate text-xs text-ink-2 [&_svg]:size-3.5 [&_svg]:shrink-0">
        <span aria-hidden="true" className="flex">{icon}</span>
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-md font-medium text-ink">{children}</dd>
    </div>
  );
}

function RowMenu({ v, act }: { v: Vacancy; act: Actions }) {
  const { t } = useTranslation();
  const canSubmit = SUBMITTABLE.includes(v.status);
  const linkIcon = "size-4 shrink-0 text-ink-3";
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton size="sm" label={t("dashboardPage.actionsFor", { title: v.title })} loading={act.submitting(v)}>
          <MoreHorizontal className="size-5" />
        </IconButton>
      </MenuTrigger>
      <MenuContent className="w-60">
        <MenuItem asChild>
          <LocalizedLink to={kanbanPath(v)} prefetch="intent" className={popoverItem}><Users aria-hidden="true" className={linkIcon} />{t("employer.applications")}</LocalizedLink>
        </MenuItem>
        <MenuItem asChild>
          <LocalizedLink to={editPath(v)} prefetch="intent" className={popoverItem}><PencilLine aria-hidden="true" className={linkIcon} />{t("common.edit")}</LocalizedLink>
        </MenuItem>
        {v.status === "published" && (
          <MenuItem asChild>
            <LocalizedLink to={`/vacancies/${v.slug}`} className={popoverItem}><Eye aria-hidden="true" className={linkIcon} />{t("employer.viewPublic")}</LocalizedLink>
          </MenuItem>
        )}
        {(canSubmit || v.status === "published" || v.status === "draft") && <MenuSeparator />}
        {canSubmit && (
          <MenuItem icon={v.status === "draft" ? <Send className="size-4" /> : <RotateCcw className="size-4" />} onSelect={() => act.submit(v)}>
            {v.status === "draft" ? t("employer.publish") : v.status === "rejected" ? t("dashboardPage.resubmit") : t("dashboardPage.attn.republish")}
          </MenuItem>
        )}
        {v.status === "published" && (
          <MenuItem icon={<Archive className="size-4" />} onSelect={() => void act.archive(v)}>{t("employer.archive")}</MenuItem>
        )}
        {v.status === "draft" && (
          <MenuItem tone="danger" icon={<Trash2 className="size-4" />} onSelect={() => void act.remove(v)}>{t("common.delete")}</MenuItem>
        )}
      </MenuContent>
    </MenuRoot>
  );
}

/* ---- onboarding --------------------------------------------------------------------------- */

type StepId = "profile" | "logo" | "vacancy" | "verify";

/** First-run checklist: company profile → logo → first vacancy → verification (done by moderators). */
function Onboarding({ company, total }: { company: Company | null; total: number }) {
  const { t } = useTranslation();
  const steps: { id: StepId; done: boolean; to?: string; cta?: string }[] = [
    {
      id: "profile",
      done: !!company && !!company.about?.trim() && !!company.industry_id && !!company.region_id,
      to: "/employer/company",
      cta: company ? t("dashboardPage.steps.fill") : t("employer.createCompany"),
    },
    { id: "logo", done: !!company?.logo_url, to: "/employer/company#logo", cta: t("dashboardPage.steps.upload") },
    { id: "vacancy", done: total > 0, to: "/employer/vacancies/new", cta: t("nav.postVacancy") },
    { id: "verify", done: !!company?.verified },
  ];
  const done = steps.filter((s) => s.done).length;
  const current = steps.find((s) => !s.done && s.to)?.id;
  const readOnly = company?.my_role === "recruiter";

  return (
    <Card as="section" aria-labelledby="setup-title" padding="none" radius="sheet" className="overflow-hidden">
      <div className="border-b border-line p-5 md:p-7">
        <span aria-hidden="true" className="mb-4 grid size-12 place-items-center rounded-panel bg-lapis-soft text-lapis-ink">
          <Building2 className="size-6" />
        </span>
        <h2 id="setup-title" className={sectionTitle}>{t("dashboardPage.setupTitle")}</h2>
        <p className="mt-1.5 max-w-xl text-md text-ink-2">{t("dashboardPage.setupBody")}</p>
        <Progress
          value={Math.round((done / steps.length) * 100)}
          label={t("dashboardPage.setupProgress", { done, total: steps.length })}
          showValue
          size="sm"
          tone={done === steps.length ? "firuza" : "lapis"}
          className="mt-5 max-w-md"
        />
      </div>
      <ol className="divide-y divide-line">
        {steps.map((s, i) => {
          const locked = !company && s.id !== "profile";
          const isCurrent = s.id === current;
          return (
            <li key={s.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center md:px-7">
              <span
                aria-hidden="true"
                className={cn(
                  "num grid size-9 place-items-center rounded-full text-sm font-semibold",
                  s.done ? "bg-firuza-soft text-firuza-ink" : isCurrent ? "bg-lapis text-on-lapis" : "border border-line-strong text-ink-2",
                )}
              >
                {s.done ? <Check className="size-4.5" strokeWidth={2.5} /> : i + 1}
              </span>
              <div className="min-w-0">
                <h3 className={cn("text-md font-semibold", s.done ? "text-ink-2" : "text-ink")}>
                  {t(`dashboardPage.steps.${s.id}`)}
                  {s.done && <span className="sr-only">, {t("dashboardPage.steps.done")}</span>}
                </h3>
                <p className="mt-0.5 break-words text-sm text-ink-2">{t(`dashboardPage.steps.${s.id}Body`)}</p>
              </div>
              <div className="col-start-2 sm:col-start-3">
                {s.done ? (
                  <Badge tone="firuza" icon={<Check />}>{t("dashboardPage.steps.done")}</Badge>
                ) : s.id === "verify" ? (
                  <Badge tone={locked ? "outline" : "zafaron"}>{locked ? t("dashboardPage.steps.later") : t("dashboardPage.steps.pending")}</Badge>
                ) : locked ? (
                  <span className="text-sm text-ink-2">{t("dashboardPage.steps.locked")}</span>
                ) : readOnly && s.id !== "vacancy" ? (
                  <span className="text-sm text-ink-2">{t("dashboardPage.steps.ownerOnly")}</span>
                ) : (
                  <Button asChild size="sm" variant={isCurrent ? "primary" : "secondary"}>
                    <LocalizedLink to={s.to!} prefetch="intent">{s.cta}</LocalizedLink>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ---- skeletons ---------------------------------------------------------------------------- */

function KpiSkeleton() {
  return (
    <div className="surface-card p-4 md:p-5">
      <div className="flex h-lh items-center text-sm"><Skeleton className="h-3.5 w-24" /></div>
      <div className="mt-2 flex h-lh items-center font-display text-2xl"><Skeleton className="h-6 w-16 rounded-control" /></div>
      <div className="mt-2 flex h-lh items-center text-sm"><Skeleton className="h-3.5 w-28" /></div>
    </div>
  );
}

function AttentionSkeleton() {
  return (
    <div>
      <Skeleton className="mb-4 h-7 w-56 rounded-control" />
      <div className="surface-card divide-y divide-line overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex min-h-18 items-center gap-4 px-4 py-3 sm:px-5 md:px-6">
            <Skeleton className="size-10 shrink-0 rounded-control" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** KPIs + "needs attention" while the overview loads (the table has its own skeleton). */
function SummarySkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true" className="flex flex-col gap-8 md:gap-10">
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)}
        </div>
        <AttentionSkeleton />
      </div>
    </div>
  );
}

/** Whole page while the company itself is loading. */
function DashboardSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
          <div className="flex min-w-0 flex-1 basis-72 flex-col gap-3">
            <Skeleton className="h-8 w-2/3 max-w-sm rounded-control md:h-9" />
            <Skeleton className="h-4 w-4/5 max-w-md" />
          </div>
          <Skeleton className="h-11 w-full rounded-control sm:w-44" />
        </div>
        <div className="flex flex-col gap-8 md:gap-10">
          <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)}
          </div>
          <AttentionSkeleton />
        </div>
      </div>
    </div>
  );
}
