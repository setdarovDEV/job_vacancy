import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";

import { EmployerOnly } from "./EmployerOnly";
import type { EmployerApplication } from "./company-hook";
import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { experienceText, money, relativeTime } from "~/shared/lib/format";
import { ApiFailure, authed, authedPage, type Page } from "~/shared/query/query";
import { Avatar } from "~/shared/ui/Avatar";
import { Button } from "~/shared/ui/Button";
import { EmptyState } from "~/shared/ui/EmptyState";
import { Popover, popoverItem } from "~/shared/ui/Popover";
import { Skeleton } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";

type App = EmployerApplication;
type Col = "sent" | "viewed" | "invited" | "interview" | "hired" | "rejected" | "withdrawn";
const COLUMNS: Col[] = ["sent", "viewed", "invited", "interview", "hired", "rejected", "withdrawn"];
// Where a card may be moved by the employer ("sent" is only the initial state).
const TARGETS: Col[] = ["viewed", "invited", "interview", "hired", "rejected"];
const DOT: Record<Col, string> = {
  sent: "bg-ink-3", viewed: "bg-lapis", invited: "bg-firuza", interview: "bg-firuza", hired: "bg-firuza", rejected: "bg-anor", withdrawn: "bg-line-strong",
};

export default function Kanban() {
  return <EmployerOnly><Board /></EmployerOnly>;
}

const colKey = (vacancy: string, s: Col) => ["applications", vacancy, s];

function Board() {
  const { id } = useParams();
  const vacancyId = id!;
  const { t } = useTranslation();
  const qc = useQueryClient();
  const vacancy = useQuery({ queryKey: ["vacancy", vacancyId], queryFn: () => authed<Schemas["VacancyDetail"]>(() => api.GET("/vacancies/{vacancy}", { params: { path: { vacancy: vacancyId } } })) });
  const stats = useQuery({ queryKey: ["application-stats", vacancyId], queryFn: () => authed<Record<Col, number>>(() => api.GET("/vacancies/{vacancy}/applications/stats", { params: { path: { vacancy: vacancyId } } })) });
  const [dragging, setDragging] = useState<App | null>(null);
  const [over, setOver] = useState<Col | null>(null);
  const [mobileCol, setMobileCol] = useState<Col>("sent");

  const move = useMutation({
    mutationFn: ({ app, to }: { app: App; to: Col }) =>
      authed<App>(() => api.PUT("/applications/{application}/status", { params: { path: { application: app.id! } }, body: { status: to as never } })),
    // Optimistic: take the card out of its column and put it on top of the target one.
    onMutate: async ({ app, to }) => {
      const from = app.status as Col;
      await qc.cancelQueries({ queryKey: ["applications", vacancyId] });
      qc.setQueryData<InfiniteData<Page<App>>>(colKey(vacancyId, from), (d) => d && ({ ...d, pages: d.pages.map((p) => ({ ...p, data: p.data.filter((a) => a.id !== app.id) })) }));
      qc.setQueryData<InfiniteData<Page<App>>>(colKey(vacancyId, to), (d) => d && ({ ...d, pages: d.pages.map((p, i) => (i === 0 ? { ...p, data: [{ ...app, status: to }, ...p.data] } : p)) }));
      qc.setQueryData<Record<Col, number>>(["application-stats", vacancyId], (s) => s && ({ ...s, [from]: Math.max(0, s[from] - 1), [to]: s[to] + 1 }));
    },
    onError: (e) => toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network") }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["applications", vacancyId] });
      void qc.invalidateQueries({ queryKey: ["application-stats", vacancyId] });
    },
  });
  const moveTo = (app: App, to: Col) => { if (app.status !== to) move.mutate({ app, to }); };

  if (vacancy.error) return <EmptyState title={t("apiErrors.vacancy_not_found")} />;
  const total = stats.data ? Object.values(stats.data).reduce((a, b) => a + b, 0) : undefined;

  return (
    <>
      <LocalizedLink to="/employer" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink"><ArrowLeft className="size-4" />{t("account.dashboard")}</LocalizedLink>
      <div className="mb-5 mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">{vacancy.data?.title ?? <Skeleton className="h-8 w-64" />}</h1>
          {total !== undefined && <p className="num mt-1 text-ink-2">{t("jobs.applicants", { count: total })}</p>}
        </div>
        {vacancy.data && (
          <Button asChild variant="ghost" size="sm" icon={<ExternalLink className="size-4" />}>
            <LocalizedLink to={`/vacancies/${vacancy.data.slug}`}>{t("employer.viewPublic")}</LocalizedLink>
          </Button>
        )}
      </div>

      {/* Phones: one column at a time, picked from a strip of tabs. */}
      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden" role="tablist">
        {COLUMNS.map((c) => (
          <button key={c} role="tab" aria-selected={mobileCol === c} onClick={() => setMobileCol(c)}
            className={cn("flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium", mobileCol === c ? "bg-lapis-soft text-lapis-ink" : "text-ink-2")}>
            {t(`enums.application_status.${c}`)}<span className="num text-ink-3">{stats.data?.[c] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 lg:mx-0 lg:px-0">
        {COLUMNS.map((c) => (
          <section
            key={c}
            aria-label={t(`enums.application_status.${c}`)}
            className={cn(
              "w-full shrink-0 flex-col rounded-panel border bg-sunken/60 p-2 transition-colors lg:flex lg:w-64",
              mobileCol === c ? "flex" : "hidden",
              over === c && dragging && TARGETS.includes(c) ? "border-lapis bg-lapis-soft/60" : "border-transparent",
            )}
            onDragOver={(e) => { if (dragging && TARGETS.includes(c)) { e.preventDefault(); setOver(c); } }}
            onDragLeave={() => setOver((o) => (o === c ? null : o))}
            onDrop={(e) => { e.preventDefault(); if (dragging) moveTo(dragging, c); setDragging(null); setOver(null); }}
          >
            <header className="flex items-center gap-2 px-2 pb-2 pt-1">
              <span className={cn("size-2 rounded-full", DOT[c])} aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">{t(`enums.application_status.${c}`)}</h2>
              <span className="num ml-auto text-sm text-ink-3">{stats.data?.[c] ?? ""}</span>
            </header>
            <Column vacancyId={vacancyId} status={c} onDragStart={setDragging} onDragEnd={() => { setDragging(null); setOver(null); }} onMove={moveTo} />
          </section>
        ))}
      </div>
    </>
  );
}

function Column({ vacancyId, status, onDragStart, onDragEnd, onMove }: {
  vacancyId: string; status: Col; onDragStart: (a: App) => void; onDragEnd: () => void; onMove: (a: App, to: Col) => void;
}) {
  const { t } = useTranslation();
  const q = useInfiniteQuery({
    queryKey: colKey(vacancyId, status),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => authedPage<App>(() =>
      api.GET("/vacancies/{vacancy}/applications", { params: { path: { vacancy: vacancyId }, query: { status, cursor: pageParam, limit: 20 } } })),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  if (q.isPending) return <div className="flex flex-col gap-2"><Skeleton className="h-24 rounded-control" /></div>;
  return (
    <div className="flex min-h-24 flex-col gap-2">
      {items.map((a) => <Card key={a.id} a={a} onDragStart={onDragStart} onDragEnd={onDragEnd} onMove={onMove} />)}
      {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-ink-3">{t("employer.columnEmpty")}</p>}
      {q.hasNextPage && (
        <Button variant="ghost" size="sm" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{t("common.more")}</Button>
      )}
    </div>
  );
}

function Card({ a, onDragStart, onDragEnd, onMove }: { a: App; onDragStart: (a: App) => void; onDragEnd: () => void; onMove: (a: App, to: Col) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const c = a.candidate;
  const movable = a.status !== "withdrawn";
  return (
    <article
      draggable={movable}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", a.id!); onDragStart(a); }}
      onDragEnd={onDragEnd}
      className={cn("group relative rounded-control border border-line bg-surface p-3 shadow-[0_1px_2px_rgb(21_26_51/0.05)] transition-shadow hover:shadow-pop", movable && "cursor-grab active:cursor-grabbing")}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={c.full_name} src={c.avatar_url} size="sm" />
        <div className="min-w-0 flex-1">
          <LocalizedLink draggable={false} to={`/employer/applications/${a.id}`} className="block truncate text-sm font-semibold text-ink after:absolute after:inset-0 hover:text-lapis-ink">
            {c.full_name}
          </LocalizedLink>
          <p className="truncate text-xs text-ink-2">{c.resume_title}</p>
        </div>
        {movable && (
          <div className="relative z-10 -mr-1 -mt-1">
            <Popover label={t("employer.moveTo")} className="w-52" trigger={(p) => (
              <button popoverTarget={p.popoverTarget} aria-label={p["aria-label"]} className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink">
                <MoreHorizontal className="size-4" />
              </button>
            )}>
              <p className="px-2.5 pb-1 pt-1.5 text-xs text-ink-3">{t("employer.moveTo")}</p>
              {TARGETS.filter((s) => s !== a.status).map((s) => (
                <button key={s} className={popoverItem} onClick={() => onMove(a, s)}>
                  <span className={cn("size-2 rounded-full", DOT[s])} />{t(`enums.application_status.${s}`)}
                </button>
              ))}
            </Popover>
          </div>
        )}
      </div>
      <p className="num mt-2.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-3">
        <span>{experienceText(c.experience_months, t)}</span>
        {c.desired_salary && <span className="text-firuza-ink">{money(c.desired_salary.amount, c.desired_salary.currency === "USD" ? "USD" : "UZS", t, locale)}</span>}
        <span>{relativeTime(a.created_at ?? "", t)}</span>
      </p>
      {a.source === "invite" && <p className="mt-1.5 text-xs font-medium text-lapis-ink">{t("employer.invitedByYou")}</p>}
    </article>
  );
}
