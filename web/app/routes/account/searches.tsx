import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellPlus, Search, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { SeekerOnly } from "./layout";
import { api } from "~/shared/api/client";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { groupDigits } from "~/shared/lib/format";
import { authed } from "~/shared/query/query";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { EmptyState } from "~/shared/ui/EmptyState";
import { PageHeader } from "~/shared/ui/Section";
import { Skeleton } from "~/shared/ui/Skeleton";
import { Switch } from "~/shared/ui/Toggle";

type SavedSearch = { id: string; name: string; params: string; notify: boolean; created_at: string };

export default function Searches() {
  return <SeekerOnly><List /></SeekerOnly>;
}

function List() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["saved-searches"], queryFn: () => authed<SavedSearch[]>(() => api.GET("/me/saved-searches")) });
  const update = useMutation({
    mutationFn: (s: SavedSearch) => authed(() => api.PUT("/me/saved-searches/{id}", { params: { path: { id: s.id } }, body: { name: s.name, notify: s.notify } })),
    onMutate: (s) => qc.setQueryData<SavedSearch[]>(["saved-searches"], (l) => l?.map((x) => (x.id === s.id ? s : x))),
    onSettled: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => authed(() => api.DELETE("/me/saved-searches/{id}", { params: { path: { id } } })),
    onMutate: (id) => qc.setQueryData<SavedSearch[]>(["saved-searches"], (l) => l?.filter((x) => x.id !== id)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
  const describe = useDescribe();

  return (
    <>
      <PageHeader title={t("account.searches")} description={t("searches.hint")} />
      {!q.data ? (
        <div className="flex flex-col gap-2"><Skeleton className="h-24 rounded-panel" /><Skeleton className="h-24 rounded-panel" /></div>
      ) : q.data.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface">
          <EmptyState icon={<BellPlus className="size-6" />} title={t("searches.emptyTitle")} body={t("searches.emptyBody")}
            action={<Button asChild><LocalizedLink to="/vacancies">{t("nav.vacancies")}</LocalizedLink></Button>} />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {q.data.map((s) => (
            <li key={s.id} className="rounded-panel border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{s.name}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {describe(s.params).map((d) => <Badge key={d} tone="neutral">{d}</Badge>)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button asChild variant="soft" size="sm" icon={<Search className="size-4" />}>
                    <LocalizedLink to={`/vacancies?${s.params}`}>{t("searches.run")}</LocalizedLink>
                  </Button>
                  <button type="button" aria-label={t("common.delete")} onClick={() => remove.mutate(s.id)} className="grid size-9 place-items-center rounded-control text-ink-3 hover:bg-sunken hover:text-anor-ink">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 border-t border-line pt-4">
                <Switch checked={s.notify} onCheckedChange={(v) => update.mutate({ ...s, notify: v })} label={t("jobs.notifyMe")} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Human-readable filter labels for a saved /vacancies query string. */
function useDescribe() {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  return (params: string) => {
    const sp = new URLSearchParams(params);
    const out: string[] = [];
    for (const [k, v] of sp) {
      if (k === "q") out.push(`«${v}»`);
      else if (k === "category_id") out.push(nameOf(idx.categories.get(Number(v))?.name, locale));
      else if (k === "region_id" || k === "district_id") out.push(nameOf(idx.regions.get(Number(v))?.name, locale));
      else if (["work_format", "employment_type", "experience", "schedule"].includes(k)) out.push(...v.split(",").map((x) => t(`enums.${k}.${x}`)));
      else if (k === "salary_from") out.push(t("salary.from", { amount: `${groupDigits(Number(v))} ${t("salary.currency.UZS")}` }));
      else if (k === "with_salary") out.push(t("jobs.filters.withSalary"));
    }
    return out.filter(Boolean).length ? out.filter(Boolean) : [t("jobs.title")];
  };
}
