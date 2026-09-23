import { useInfiniteQuery } from "@tanstack/react-query";
import { MapPin, Search, Send, UsersRound } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { EmployerOnly } from "./EmployerOnly";
import { api, type Schemas } from "~/shared/api/client";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { experienceText, groupDigits, money, relativeTime } from "~/shared/lib/format";
import { authedPage } from "~/shared/query/query";
import { LoadMore } from "~/shared/query/LoadMore";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Chip } from "~/shared/ui/Chip";
import { EmptyState } from "~/shared/ui/EmptyState";
import { PageHeader } from "~/shared/ui/Section";
import { Select } from "~/shared/ui/Select";
import { Skeleton } from "~/shared/ui/Skeleton";
import { Checkbox } from "~/shared/ui/Toggle";

const InviteDialog = lazy(() => import("./InviteDialog"));
type Resume = Schemas["ResumeCard"];
type Meta = { next_cursor?: string | null; total?: number; total_capped?: boolean; fuzzy?: boolean };
const KEYS = ["q", "category_id", "region_id", "with_relocate", "experience", "work_format", "salary_to", "language", "sort"] as const;
const LANGS = ["uz", "ru", "en", "tr", "ko", "de", "zh"];

export default function Candidates() {
  return <EmployerOnly><Page /></EmployerOnly>;
}

function Page() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { categories, regions } = useCatalog();
  const [sp, setSp] = useSearchParams();
  const query = useMemo(() => Object.fromEntries(KEYS.map((k) => [k, sp.get(k) ?? ""]).filter(([, v]) => v)) as Record<string, string>, [sp]);
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v); else next.delete(k);
    setSp(next, { replace: true, preventScrollReset: true });
  };
  const toggleMulti = (k: string, v: string) => {
    const cur = (query[k] ?? "").split(",").filter(Boolean);
    set(k, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(","));
  };
  const [invite, setInvite] = useState<Resume | null>(null);

  const q = useInfiniteQuery({
    queryKey: ["candidates", query],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const page = await authedPage<Resume>(() => api.GET("/resumes", { params: { query: { ...(query as Record<string, never>), cursor: pageParam } } }));
      return page as typeof page & { meta: Meta };
    },
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  const meta = q.data?.pages[0]?.meta as Meta | undefined;

  return (
    <>
      <PageHeader title={t("account.candidates")} description={t("candidates.hint")} />
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); set("q", (new FormData(e.currentTarget).get("q") as string).trim() || null); }}
      >
        <label className="flex h-11 flex-1 items-center gap-3 rounded-control border border-line-strong bg-surface px-3.5 focus-within:border-lapis focus-within:shadow-[0_0_0_4px_var(--lapis-soft)]">
          <Search className="size-4.5 shrink-0 text-ink-3" aria-hidden="true" />
          <span className="sr-only">{t("candidates.search")}</span>
          <input key={query.q} name="q" type="search" defaultValue={query.q} placeholder={t("candidates.search")} className="h-full w-full bg-transparent text-ink outline-none placeholder:text-ink-3" />
        </label>
        <Button type="submit">{t("search.submit")}</Button>
      </form>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Select aria-label={t("jobs.filters.category")} value={query.category_id ?? ""} placeholder={t("jobs.filters.anyCategory")} onValueChange={(v) => set("category_id", v)}
          groups={categories.map((c) => ({ label: nameOf(c.name, locale), options: [{ value: String(c.id), label: t("jobs.filters.allIn", { name: nameOf(c.name, locale) }) }, ...(c.children ?? []).map((ch) => ({ value: String(ch.id), label: nameOf(ch.name, locale) }))] }))} />
        <Select aria-label={t("jobs.filters.region")} value={query.region_id ?? ""} placeholder={t("search.anywhere")} onValueChange={(v) => set("region_id", v)}
          options={regions.map((r) => ({ value: String(r.id), label: nameOf(r.name, locale) }))} />
        <Select aria-label={t("resume.language")} value={query.language ?? ""} placeholder={t("candidates.anyLanguage")} onValueChange={(v) => set("language", v)}
          options={LANGS.map((l) => ({ value: l, label: t(`langs.${l}`) }))} />
        <SalaryTo value={query.salary_to ?? ""} onCommit={(v) => set("salary_to", v)} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(["none", "1_3", "3_6", "6_plus"] as const).map((v) => (
          <Chip key={v} selected={(query.experience ?? "").split(",").includes(v)} onClick={() => toggleMulti("experience", v)}>{t(`enums.experience.${v}`)}</Chip>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
        {(["office", "remote", "hybrid"] as const).map((v) => (
          <Chip key={v} selected={(query.work_format ?? "").split(",").includes(v)} onClick={() => toggleMulti("work_format", v)}>{t(`enums.work_format.${v}`)}</Chip>
        ))}
        {query.region_id && (
          <div className="ml-1"><Checkbox checked={query.with_relocate === "true"} onCheckedChange={(v) => set("with_relocate", v ? "true" : null)} label={t("candidates.withRelocate")} /></div>
        )}
      </div>

      <div className="mb-3 mt-6 flex items-center justify-between gap-2">
        <p className="num text-sm text-ink-2">{meta ? (meta.total_capped ? t("candidates.totalCapped") : t("candidates.total", { count: meta.total ?? items.length })) : " "}</p>
        <Select aria-label={t("jobs.sort")} size="sm" className="w-52" value={query.sort ?? (query.q ? "relevance" : "updated")}
          onValueChange={(v) => set("sort", v)} options={[...(query.q ? [{ value: "relevance", label: t("jobs.sortRelevance") }] : []), { value: "updated", label: t("candidates.sortUpdated") }]} />
      </div>
      {meta?.fuzzy && <p className="mb-3 rounded-control bg-zafaron-soft px-4 py-3 text-sm text-zafaron-ink">{t("jobs.fuzzy")}</p>}

      {q.isPending ? (
        <div className="flex flex-col gap-2"><Skeleton className="h-28 rounded-panel" /><Skeleton className="h-28 rounded-panel" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface"><EmptyState icon={<UsersRound className="size-6" />} title={t("candidates.empty")} body={t("candidates.emptyBody")} /></div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
          {items.map((r) => <Row key={r.id} r={r} onInvite={() => setInvite(r)} />)}
        </ul>
      )}
      <LoadMore hasNext={q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />
      {invite && (
        <Suspense>
          <InviteDialog open onOpenChange={(o) => !o && setInvite(null)} resumeId={invite.id} name={invite.person.full_name ?? ""} />
        </Suspense>
      )}
    </>
  );
}

function Row({ r, onInvite }: { r: Resume; onInvite: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const region = nameOf(idx.regions.get(r.region_id ?? -1)?.name, locale);
  return (
    <li className="group relative flex flex-col gap-3 px-4 py-5 transition-colors hover:bg-sunken/60 sm:flex-row sm:px-5">
      <div className="flex min-w-0 flex-1 gap-4">
        <Avatar name={r.person.full_name ?? ""} src={r.person.avatar_url} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <LocalizedLink to={`/resumes/${r.id}`} className="text-[1.0625rem] font-semibold text-ink after:absolute after:inset-0 group-hover:text-lapis-ink">{r.title}</LocalizedLink>
            {r.desired_salary && <span className="num shrink-0 font-display font-semibold tracking-[-0.02em] text-firuza-ink">{money(r.desired_salary.amount ?? 0, r.desired_salary.currency === "USD" ? "USD" : "UZS", t, locale)}</span>}
          </div>
          <p className="text-sm text-ink-2">{r.person.full_name}</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-3">
            {r.last_job && <span>{r.last_job.position}, {r.last_job.company}</span>}
            <span>{t("resume.experienceTotal", { value: experienceText(r.experience_months, t) })}</span>
            {region && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{region}{r.relocate ? `, ${t("resume.relocateShort")}` : ""}</span>}
            <span>{relativeTime(r.updated_at, t)}</span>
          </p>
          {r.skills.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{r.skills.slice(0, 6).map((s) => <Badge key={s.id} tone="outline">{s.name}</Badge>)}</div>}
        </div>
      </div>
      <div className={cn("relative z-10 self-start sm:ml-2")}>
        <Button variant="soft" size="sm" icon={<Send className="size-4" />} onClick={onInvite}>{t("candidates.invite")}</Button>
      </div>
    </li>
  );
}

function SalaryTo({ value, onCommit }: { value: string; onCommit: (v: string | null) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(value ? groupDigits(Number(value)) : "");
  const commit = () => { const d = text.replace(/\D/g, ""); if (d !== value) onCommit(d || null); };
  return (
    <div className="relative flex items-center">
      <input inputMode="numeric" aria-label={t("candidates.salaryTo")} placeholder={t("candidates.salaryTo")} value={text}
        onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 12); setText(d ? groupDigits(Number(d)) : ""); }}
        onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
        className="num h-11 w-full rounded-control border border-line-strong bg-surface pl-3.5 pr-14 text-[0.9375rem] text-ink outline-none placeholder:text-ink-3 focus:border-lapis focus:shadow-[0_0_0_4px_var(--lapis-soft)]" />
      <span className="pointer-events-none absolute right-3.5 text-sm text-ink-3">{t("salary.currency.UZS")}</span>
    </div>
  );
}
