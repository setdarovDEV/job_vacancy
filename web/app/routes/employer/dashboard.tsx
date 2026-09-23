import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, Building2, Eye, FileText, MoreHorizontal, PencilLine, Plus, Send, Trash2, Users } from "lucide-react";
import { useState } from "react";

import { EmployerOnly } from "./EmployerOnly";
import { useMyCompany, type Company } from "./company-hook";
import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { relativeTime } from "~/shared/lib/format";
import { ApiFailure, authed, authedPage } from "~/shared/query/query";
import { LoadMore } from "~/shared/query/LoadMore";
import { Badge, type BadgeTone } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Chip } from "~/shared/ui/Chip";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { EmptyState } from "~/shared/ui/EmptyState";
import { Popover, popoverItem } from "~/shared/ui/Popover";
import { PageHeader } from "~/shared/ui/Section";
import { Skeleton } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";

type Vacancy = Schemas["VacancyCard"];
type Status = Schemas["VacancyStatus"];
const TABS: (Status | null)[] = [null, "published", "moderation", "draft", "rejected", "archived", "expired"];
const TONE: Record<Status, BadgeTone> = { draft: "neutral", moderation: "zafaron", published: "firuza", rejected: "anor", archived: "outline", expired: "outline" };

export default function Dashboard() {
  return <EmployerOnly><Page /></EmployerOnly>;
}

function Page() {
  const { t } = useTranslation();
  const { company, isPending } = useMyCompany();
  if (isPending) return <Skeleton className="h-96 rounded-sheet" />;
  if (!company) {
    return (
      <div className="rounded-sheet border border-line bg-surface">
        <EmptyState icon={<Building2 className="size-6" />} title={t("employer.welcomeTitle")} body={t("employer.welcomeBody")}
          action={<Button asChild><LocalizedLink to="/employer/company">{t("employer.createCompany")}</LocalizedLink></Button>} />
      </div>
    );
  }
  return <Vacancies company={company} />;
}

function Vacancies({ company }: { company: Company }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status | null>(null);
  const q = useInfiniteQuery({
    queryKey: ["company-vacancies", company.id, status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => authedPage<Vacancy>(() =>
      api.GET("/companies/{company}/vacancies", { params: { path: { company: company.id }, query: { status: status ?? undefined, cursor: pageParam } } })),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <>
      <PageHeader
        title={company.name}
        description={company.verified ? t("employer.dashboardHint") : t("employer.unverifiedHint")}
        actions={<Button asChild icon={<Plus className="size-4.5" />}><LocalizedLink to="/employer/vacancies/new">{t("nav.postVacancy")}</LocalizedLink></Button>}
      />
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {TABS.map((s) => (
          <Chip key={s ?? "all"} className="shrink-0" selected={status === s} onClick={() => setStatus(s)}>{s ? t(`vacancyStatus.${s}`) : t("applications.all")}</Chip>
        ))}
      </div>
      {q.isPending ? (
        <div className="flex flex-col gap-2"><Skeleton className="h-20 rounded-panel" /><Skeleton className="h-20 rounded-panel" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface">
          <EmptyState icon={<FileText className="size-6" />} title={status ? t("employer.noneInStatus") : t("employer.noVacancies")} body={status ? undefined : t("employer.noVacanciesBody")}
            action={!status && <Button asChild icon={<Plus className="size-4.5" />}><LocalizedLink to="/employer/vacancies/new">{t("nav.postVacancy")}</LocalizedLink></Button>} />
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
          {items.map((v) => <Row key={v.id} v={v} companyId={company.id} />)}
        </ul>
      )}
      <LoadMore hasNext={q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />
    </>
  );
}

function Row({ v, companyId }: { v: Vacancy; companyId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const done = () => qc.invalidateQueries({ queryKey: ["company-vacancies", companyId] });
  const fail = (e: Error) => toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network") });
  const submit = useMutation({
    mutationFn: () => authed<Schemas["VacancyDetail"]>(() => api.POST("/vacancies/{vacancy}/submit", { params: { path: { vacancy: v.id } } })),
    onSuccess: (d) => { void done(); toast({ tone: "success", title: d.status === "published" ? t("employer.published") : t("employer.sentToModeration") }); },
    onError: fail,
  });
  const archive = useMutation({
    mutationFn: () => authed(() => api.POST("/vacancies/{vacancy}/archive", { params: { path: { vacancy: v.id } } })),
    onSuccess: () => { void done(); setConfirm(null); }, onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => authed(() => api.DELETE("/vacancies/{vacancy}", { params: { path: { vacancy: v.id } } })),
    onSuccess: () => { void done(); setConfirm(null); }, onError: fail,
  });
  const canSubmit = ["draft", "rejected", "archived", "expired"].includes(v.status);

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <LocalizedLink to={`/employer/vacancies/${v.id}/applications`} className="font-semibold text-ink hover:text-lapis-ink">{v.title}</LocalizedLink>
          <Badge tone={TONE[v.status]}>{t(`vacancyStatus.${v.status}`)}</Badge>
        </div>
        <p className="num mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-3">
          <span className="flex items-center gap-1.5"><Eye className="size-4" />{v.views_count}</span>
          <span className="flex items-center gap-1.5"><Users className="size-4" />{t("jobs.applicants", { count: v.applications_count })}</span>
          <span>{v.published_at ? t("jobs.posted", { when: relativeTime(v.published_at, t) }) : relativeTime(v.created_at, t)}</span>
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button asChild variant="secondary" size="sm" icon={<Users className="size-4" />}>
          <LocalizedLink to={`/employer/vacancies/${v.id}/applications`}>{t("employer.applications")}</LocalizedLink>
        </Button>
        {canSubmit && (
          <Button variant="soft" size="sm" icon={<Send className="size-4" />} loading={submit.isPending} onClick={() => submit.mutate()}>{t("employer.publish")}</Button>
        )}
        <Popover
          label={t("common.more")}
          className="w-56"
          trigger={(p) => (
            <button popoverTarget={p.popoverTarget} aria-label={p["aria-label"]} className="grid size-9 place-items-center rounded-control text-ink-3 hover:bg-sunken hover:text-ink">
              <MoreHorizontal className="size-5" />
            </button>
          )}
        >
          <LocalizedLink to={`/employer/vacancies/${v.id}/edit`} className={popoverItem}><PencilLine className="size-4" />{t("common.edit")}</LocalizedLink>
          <LocalizedLink to={`/vacancies/${v.slug}`} className={popoverItem}><Eye className="size-4" />{t("employer.viewPublic")}</LocalizedLink>
          {v.status === "published" && <button className={popoverItem} onClick={() => setConfirm("archive")}><Archive className="size-4" />{t("employer.archive")}</button>}
          {v.status === "draft" && <button className={`${popoverItem} text-anor-ink`} onClick={() => setConfirm("delete")}><Trash2 className="size-4" />{t("common.delete")}</button>}
        </Popover>
      </div>
      <DialogRoot open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent
          title={confirm === "delete" ? t("employer.deleteTitle") : t("employer.archiveTitle")}
          description={confirm === "delete" ? t("employer.deleteBody") : t("employer.archiveBody")}
          closeLabel={t("common.close")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(null)}>{t("common.cancel")}</Button>
              {confirm === "delete"
                ? <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>{t("common.delete")}</Button>
                : <Button loading={archive.isPending} onClick={() => archive.mutate()}>{t("employer.archive")}</Button>}
            </>
          }
        />
      </DialogRoot>
    </li>
  );
}
