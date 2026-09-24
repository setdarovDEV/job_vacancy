import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellPlus, BriefcaseBusiness, Building2, Clock, LayoutGrid, MapPin, Search, SlidersHorizontal, Trash2, Wallet, type LucideIcon } from "lucide-react";
import { useMemo, type CSSProperties } from "react";

import { SeekerOnly } from "./layout";
import { api } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation, type TFunction } from "~/shared/i18n/i18n";
import { money } from "~/shared/lib/format";
import { ApiFailure, authed } from "~/shared/query/query";
import { Badge } from "~/shared/ui/Badge";
import { Button, IconButton } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { RelTime } from "~/shared/ui/RelTime";
import { PageHeader } from "~/shared/ui/Section";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";
import { Switch } from "~/shared/ui/Toggle";

type SavedSearch = { id: string; name: string; params: string; notify: boolean; created_at: string };
const KEY = ["saved-searches"];

const failText = (t: TFunction, e: unknown) => (e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network"));

export default function Searches() {
  return <SeekerOnly><List /></SeekerOnly>;
}

function List() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: () => authed<SavedSearch[]>(() => api.GET("/me/saved-searches")) });
  const loading = useSkeletonHold(q.isPending);
  const bump = (d: number) =>
    qc.setQueryData<{ searches: number | null }>(["account-summary"], (s) => (s && s.searches != null ? { ...s, searches: Math.max(0, s.searches + d) } : s));

  // Both mutations are optimistic: the switch / card change at once and roll back on failure.
  const update = useMutation({
    mutationFn: (s: SavedSearch) => authed(() => api.PUT("/me/saved-searches/{id}", { params: { path: { id: s.id } }, body: { name: s.name, notify: s.notify } })),
    onMutate: async (s) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<SavedSearch[]>(KEY);
      qc.setQueryData<SavedSearch[]>(KEY, (l) => l?.map((x) => (x.id === s.id ? s : x)));
      return { prev };
    },
    onError: (e, _s, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
      toast({ tone: "error", title: failText(t, e) });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  // Undo re-creates the search with the same name, filters and alert setting.
  const restore = useMutation({
    mutationFn: (s: SavedSearch) => authed(() => api.POST("/me/saved-searches", { body: { name: s.name, params: s.params, notify: s.notify } })),
    onSuccess: () => bump(1),
    onError: (e) => toast({ tone: "error", title: failText(t, e) }),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const remove = useMutation({
    mutationFn: (s: SavedSearch) => authed(() => api.DELETE("/me/saved-searches/{id}", { params: { path: { id: s.id } } })),
    onMutate: async (s) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<SavedSearch[]>(KEY);
      qc.setQueryData<SavedSearch[]>(KEY, (l) => l?.filter((x) => x.id !== s.id));
      return { prev };
    },
    onError: (e, _s, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
      toast({ tone: "error", title: failText(t, e) });
    },
    onSuccess: (_r, s) => {
      bump(-1);
      toast({ tone: "info", title: t("accountPage.searchDeleted"), body: s.name, action: { label: t("accountPage.undo"), onClick: () => restore.mutate(s) } });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return (
    <>
      <PageHeader
        title={t("account.searches")}
        description={t("searches.hint")}
        actions={
          q.data?.length ? (
            <Button asChild variant="secondary" icon={<Search className="size-4.5" />}>
              <LocalizedLink to="/vacancies" prefetch="intent">{t("accountPage.newSearch")}</LocalizedLink>
            </Button>
          ) : undefined
        }
      />
      {loading ? (
        <SkeletonDelay>
          <SearchSkeleton />
        </SkeletonDelay>
      ) : q.isError && !q.data ? (
        <Card padding="none">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Card>
      ) : !q.data?.length ? (
        <Card padding="none">
          <EmptyState
            icon={<BellPlus />}
            title={t("searches.emptyTitle")}
            body={t("searches.emptyBody")}
            action={<Button asChild><LocalizedLink to="/vacancies" prefetch="intent">{t("accountPage.findJobs")}</LocalizedLink></Button>}
          />
        </Card>
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {q.data.map((s, i) => (
            <SearchCard
              key={s.id}
              s={s}
              onNotify={(notify) => update.mutate({ ...s, notify })}
              onDelete={() => remove.mutate(s)}
              style={{ "--i": i } as CSSProperties}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function SearchCard({ s, onNotify, onDelete, style }: { s: SavedSearch; onNotify: (v: boolean) => void; onDelete: () => void; style?: CSSProperties }) {
  const { t } = useTranslation();
  const describe = useDescribe();
  const filters = describe(s.params);
  return (
    <Card as="li" padding="none" className="anim-enter flex min-w-0 flex-col" style={style}>
      <div className="flex flex-1 flex-col p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-control bg-lapis-soft text-lapis-ink">
            <SlidersHorizontal className="size-5" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="break-words text-lead font-semibold tracking-snug text-ink">{s.name}</h2>
            <RelTime iso={s.created_at} template={(when) => t("accountPage.savedAgo", { when })} className="mt-0.5 block text-sm text-ink-2" />
          </div>
          <IconButton label={t("accountPage.deleteSearch", { name: s.name })} size="sm" className="-mr-2 -mt-1 text-ink-2 hover:text-anor-ink" onClick={onDelete}>
            <Trash2 className="size-4.5" />
          </IconButton>
        </div>
        <ul aria-label={t("common.filters")} className="mt-4 flex flex-wrap gap-1.5">
          {filters.map((f, i) => (
            <li key={i} className="min-w-0 max-w-full">
              <Badge tone={f.q ? "lapis" : "neutral"} icon={<f.Icon />}>{f.label}</Badge>
            </li>
          ))}
        </ul>
        {/* Bottom of the body, so the actions line up across a row of cards. */}
        <div className="mt-auto pt-5">
          <Button asChild variant="soft" size="sm" icon={<Search className="size-4" />} className="max-sm:w-full">
            <LocalizedLink to={`/vacancies?${s.params}`} prefetch="intent">{t("accountPage.runSearch")}</LocalizedLink>
          </Button>
        </div>
      </div>
      <div className="border-t border-line px-5 py-2 md:px-6">
        <Switch checked={s.notify} onCheckedChange={onNotify} label={t("jobs.notifyMe")} />
      </div>
    </Card>
  );
}

function SearchSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true" className="grid gap-4 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="surface-card">
            <div className="p-5 md:p-6">
              <div className="flex items-start gap-3">
                <Skeleton className="size-10 shrink-0 rounded-control" />
                <div className="flex flex-1 flex-col gap-2 pt-1"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-1/3" /></div>
              </div>
              <div className="mt-4 flex gap-1.5"><Skeleton className="h-6 w-24" /><Skeleton className="h-6 w-20" /><Skeleton className="h-6 w-28" /></div>
              <Skeleton className="mt-5 h-9 w-44 rounded-control max-sm:w-full" />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-4 md:px-6">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-6 w-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type Filter = { label: string; Icon: LucideIcon; q?: boolean };

/** Human-readable filter labels (with an icon per kind) for a saved /vacancies query string. */
function useDescribe() {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const icons: Record<string, LucideIcon> = { work_format: Building2, employment_type: BriefcaseBusiness, experience: BriefcaseBusiness, schedule: Clock };
  return (params: string): Filter[] => {
    const sp = new URLSearchParams(params);
    const out: Filter[] = [];
    for (const [k, v] of sp) {
      if (k === "q") out.push({ label: `«${v}»`, Icon: Search, q: true });
      else if (k === "category_id") out.push({ label: nameOf(idx.categories.get(Number(v))?.name, locale), Icon: LayoutGrid });
      else if (k === "region_id" || k === "district_id") out.push({ label: nameOf(idx.regions.get(Number(v))?.name, locale), Icon: MapPin });
      else if (k in icons) out.push(...v.split(",").map((x) => ({ label: t(`enums.${k}.${x}`), Icon: icons[k] })));
      else if (k === "salary_from") out.push({ label: t("salary.from", { amount: money(Number(v), "UZS", t, locale) }), Icon: Wallet });
      else if (k === "with_salary") out.push({ label: t("jobs.filters.withSalary"), Icon: Wallet });
    }
    const named = out.filter((f) => f.label);
    return named.length ? named : [{ label: t("jobs.title"), Icon: Search }];
  };
}
