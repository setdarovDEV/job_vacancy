import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Copy, Download, Eye, FileText, MoreHorizontal, PencilLine, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useNavigate, useViewTransitionState } from "react-router";

import { SeekerOnly } from "./layout";
import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { localizedPath } from "~/shared/i18n/config";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { experienceText, money } from "~/shared/lib/format";
import { useSpotlight } from "~/shared/lib/spotlight";
import { ApiFailure, authed } from "~/shared/query/query";
import {
  detailToDraft, missingList, resumeChecklist, useResumePdf, VISIBILITIES, VisibilityDot, type ResumeVisibility,
} from "~/shared/resume/ResumeView";
import { Badge } from "~/shared/ui/Badge";
import { Button, IconButton } from "~/shared/ui/Button";
import { Card, CardLink } from "~/shared/ui/Card";
import { useConfirm } from "~/shared/ui/ConfirmDialog";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { MenuContent, MenuItem, MenuRadioGroup, MenuRadioItem, MenuRoot, MenuTrigger } from "~/shared/ui/Menu";
import { Progress } from "~/shared/ui/Progress";
import { RelTime } from "~/shared/ui/RelTime";
import { PageHeader } from "~/shared/ui/Section";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";

type Resume = Schemas["ResumeCard"];
type Detail = Schemas["ResumeDetail"];
export const MAX_RESUMES = 5;

const LIST_KEY = ["my-resumes"];
const detailQuery = (id: string) => ({
  queryKey: ["resume", id],
  queryFn: () => authed<Detail>(() => api.GET("/resumes/{resume}", { params: { path: { resume: id } } })),
});
const failText = (t: ReturnType<typeof useTranslation>["t"], e: unknown) =>
  e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network");

export default function Resumes() {
  return <SeekerOnly><ResumeList /></SeekerOnly>;
}

function ResumeList() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const q = useQuery({ queryKey: LIST_KEY, queryFn: () => authed<Resume[]>(() => api.GET("/me/resumes")) });
  const loading = useSkeletonHold(q.isPending);
  const list = useMemo(() => q.data ?? [], [q.data]);
  // Full resumes power the completeness bar and duplication, and warm the cache so Open and
  // Edit render at once (the viewer and the editor read the same ["resume", id] entries).
  const details = useQueries({ queries: list.map((r) => detailQuery(r.id)) });
  const full = list.length >= MAX_RESUMES;

  const visibility = useMutation({
    mutationFn: ({ id, v }: { id: string; v: ResumeVisibility }) =>
      authed(() => api.PUT("/resumes/{resume}/visibility", { params: { path: { resume: id } }, body: { visibility: v } })),
    onMutate: async ({ id, v }) => {
      await qc.cancelQueries({ queryKey: LIST_KEY });
      const prev = qc.getQueryData<Resume[]>(LIST_KEY);
      const prevDetail = qc.getQueryData<Detail>(["resume", id]);
      qc.setQueryData<Resume[]>(LIST_KEY, (rs) => rs?.map((r) => (r.id === id ? { ...r, visibility: v } : r)));
      if (prevDetail) qc.setQueryData<Detail>(["resume", id], { ...prevDetail, visibility: v });
      return { prev, prevDetail };
    },
    onError: (e, { id }, ctx) => {
      qc.setQueryData(LIST_KEY, ctx?.prev);
      if (ctx?.prevDetail) qc.setQueryData(["resume", id], ctx.prevDetail);
      toast({ tone: "error", title: failText(t, e) });
    },
    onSuccess: (_d, { v }) => toast({ tone: "success", title: t("resumePage.visibilitySaved", { value: t(`resume.vis.${v}`) }) }),
    onSettled: (_d, _e, { id }) => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
      void qc.invalidateQueries({ queryKey: ["resume", id] });
    },
  });

  const remove = useMutation({
    mutationFn: (r: Resume) => authed(() => api.DELETE("/resumes/{resume}", { params: { path: { resume: r.id } } })),
    onMutate: async (r) => {
      await qc.cancelQueries({ queryKey: LIST_KEY });
      const prev = qc.getQueryData<Resume[]>(LIST_KEY);
      qc.setQueryData<Resume[]>(LIST_KEY, (rs) => rs?.filter((x) => x.id !== r.id));
      return { prev };
    },
    onError: (e, _r, ctx) => {
      qc.setQueryData(LIST_KEY, ctx?.prev);
      toast({ tone: "error", title: failText(t, e) });
    },
    onSuccess: (_d, r) => {
      qc.removeQueries({ queryKey: ["resume", r.id] });
      toast({ tone: "success", title: t("resumePage.deleted", { title: r.title }) });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });

  const duplicate = useMutation({
    mutationFn: async (r: Resume) => {
      const d = await qc.fetchQuery(detailQuery(r.id));
      // The copy starts hidden, so two identical resumes never show up in candidate search.
      const body = { ...detailToDraft(d), title: t("resumePage.copyTitle", { title: d.title }).slice(0, 150), visibility: "hidden" as const };
      return authed<Detail>(() => api.POST("/resumes", { body }));
    },
    onSuccess: (created) => {
      qc.setQueryData(["resume", created.id], created);
      void qc.invalidateQueries({ queryKey: LIST_KEY });
      toast({
        tone: "success",
        title: t("resumePage.duplicated"),
        body: t("resumePage.duplicatedBody"),
        action: { label: t("common.edit"), onClick: () => navigate(localizedPath(locale, `/me/resumes/${created.id}/edit`)) },
      });
    },
    onError: (e) => toast({ tone: "error", title: failText(t, e) }),
  });

  const askDelete = async (r: Resume) => {
    const ok = await confirm({
      title: t("resume.deleteTitle"),
      body: t("resume.deleteBody", { title: r.title }),
      confirmLabel: t("common.delete"),
      tone: "danger",
    });
    if (!ok) return;
    // The card (and its menu button) is about to disappear: hand focus to a neighbour.
    const at = list.findIndex((x) => x.id === r.id);
    const next = list[at + 1] ?? list[at - 1];
    remove.mutate(r);
    setTimeout(() => document.getElementById(next ? `resume-${next.id}` : "resume-create")?.focus(), 350);
  };

  const create = full ? (
    <Button id="resume-create" disabled icon={<Plus className="size-4.5" />}>{t("resume.new")}</Button>
  ) : (
    <Button asChild icon={<Plus className="size-4.5" />}>
      <LocalizedLink id="resume-create" to="/me/resumes/new" prefetch="intent">{t("resume.new")}</LocalizedLink>
    </Button>
  );

  return (
    <>
      <PageHeader
        title={t("account.myResumes")}
        description={list.length > 0 ? (full ? t("resumePage.limitReached", { max: MAX_RESUMES }) : t("resumePage.usage", { n: list.length, max: MAX_RESUMES })) : t("resume.listHint")}
        actions={list.length > 0 && create}
      />
      {loading ? (
        <SkeletonDelay>
          <div role="status" aria-busy="true" className="flex flex-col gap-4">
            <span className="sr-only">{t("common.loading")}</span>
            <ResumeCardSkeleton />
            <ResumeCardSkeleton />
          </div>
        </SkeletonDelay>
      ) : q.isError ? (
        <Card padding="none"><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>
      ) : list.length === 0 ? (
        <FirstResume />
      ) : (
        <Cards busy={q.isRefetching}>
          {list.map((r, i) => (
            <li key={r.id} className="anim-enter" style={{ "--i": i } as React.CSSProperties}>
              <ResumeItem
                r={r}
                detail={details[i]?.data}
                canDuplicate={!full}
                duplicating={duplicate.isPending && duplicate.variables?.id === r.id}
                onVisibility={(v) => visibility.mutate({ id: r.id, v })}
                onDuplicate={() => duplicate.mutate(r)}
                onDelete={() => void askDelete(r)}
              />
            </li>
          ))}
        </Cards>
      )}
      {dialog}
    </>
  );
}

// Own component so the spotlight listener binds when the list itself mounts (after loading).
function Cards({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  const list = useSpotlight<HTMLUListElement>();
  return (
    <ul ref={list} aria-busy={busy || undefined} className={cn("flex flex-col gap-4 transition-opacity", busy && "opacity-60")}>
      {children}
    </ul>
  );
}

function ResumeItem({ r, detail, canDuplicate, duplicating, onVisibility, onDuplicate, onDelete }: {
  r: Resume;
  detail?: Detail;
  canDuplicate: boolean;
  duplicating: boolean;
  onVisibility: (v: ResumeVisibility) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const href = `/resumes/${r.id}`;
  // Name only the clicked card for the list → resume morph (unique names, cheap snapshot).
  const morph = useViewTransitionState(localizedPath(locale, href));
  const pdf = useResumePdf(r.id, r.title);
  const check = detail ? resumeChecklist(detailToDraft(detail)) : null;
  const region = nameOf(idx.regions.get(r.region_id ?? -1)?.name, locale);
  const vis = r.visibility ?? "public";
  const skills = r.skills.slice(0, 5);

  return (
    <Card as="article" interactive padding="none" aria-labelledby={`resume-${r.id}-title`} className="spotlight">
      <div className="flex gap-4 p-5 md:p-6">
        <span aria-hidden="true" className="hidden size-14 shrink-0 place-items-center rounded-control bg-lapis-soft text-lapis sm:grid">
          <FileText className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1 basis-56">
              <h2 id={`resume-${r.id}-title`} className="break-words text-lead font-semibold tracking-snug text-ink">
                <CardLink
                  id={`resume-${r.id}`}
                  to={href}
                  prefetch="intent"
                  viewTransition
                  style={morph ? { viewTransitionName: `resume-title-${r.id}` } : undefined}
                >
                  {r.title}
                </CardLink>
              </h2>
              {r.last_job && (
                <p className="mt-1 break-words text-md text-ink-2">
                  {t("resumePage.lastJob", { position: r.last_job.position ?? "", company: r.last_job.company ?? "" })}
                </p>
              )}
            </div>
            <VisibilityMenu value={vis} onChange={onVisibility} />
          </div>
          <ul className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1.5 text-sm text-ink-2">
            <li>{t("resume.experienceTotal", { value: experienceText(r.experience_months, t) })}</li>
            {region && <li>{region}</li>}
            {r.desired_salary?.amount ? (
              <li className="num font-display text-md font-semibold text-firuza-ink">
                {money(r.desired_salary.amount, r.desired_salary.currency === "USD" ? "USD" : "UZS", t, locale)}
              </li>
            ) : null}
          </ul>
          {skills.length > 0 && (
            <ul aria-label={t("jobs.skills")} className="mt-3 hidden flex-wrap gap-1.5 sm:flex">
              {skills.map((s) => <li key={s.id} className="min-w-0 max-w-full"><Badge>{s.name}</Badge></li>)}
              {r.skills.length > skills.length && (
                <li><Badge tone="outline" className="num">+{r.skills.length - skills.length}</Badge></li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Completeness: what employers see first, and one tap to the step that fixes it. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line px-5 py-3.5 md:px-6">
        {check ? (
          <>
            <Progress
              value={check.percent}
              label={t("resumePage.completeness")}
              tone={check.percent === 100 ? "firuza" : "lapis"}
              size="sm"
              showValue
              className="min-w-0 flex-1 basis-48"
            />
            {check.missing.length ? (
              <p className="min-w-0 flex-1 basis-56 text-sm text-ink-2">
                {t("resumePage.missing", { items: missingList(check.missing, t, locale) })}{" "}
                <LocalizedLink
                  to={`/me/resumes/${r.id}/edit?step=${check.missing[0].step}`}
                  className="relative z-10 font-medium text-lapis-ink underline-offset-4 hover:underline"
                >
                  {t("resumePage.fill")}
                </LocalizedLink>
              </p>
            ) : (
              <p className="flex min-w-0 flex-1 basis-56 items-center gap-1.5 text-sm text-ink-2">
                <Check aria-hidden="true" className="size-4 shrink-0 text-firuza" />
                {t("resumePage.complete")}
              </p>
            )}
          </>
        ) : (
          <div aria-hidden="true" className="flex min-w-0 flex-1 basis-48 flex-col gap-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-1.5 w-full" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 md:px-6">
        <Button asChild variant="secondary" size="sm" icon={<PencilLine className="size-4" />} className="relative z-10">
          <LocalizedLink to={`/me/resumes/${r.id}/edit`} prefetch="intent">{t("common.edit")}</LocalizedLink>
        </Button>
        <Button asChild variant="ghost" size="sm" icon={<Eye className="size-4" />} className="relative z-10">
          <LocalizedLink to={href} viewTransition tabIndex={-1}>{t("resumePage.view")}</LocalizedLink>
        </Button>
        <Button variant="ghost" size="sm" icon={<Download className="size-4" />} loading={pdf.busy} onClick={pdf.download} className="relative z-10 hidden sm:inline-flex">
          PDF
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Copy className="size-4" />}
          loading={duplicating}
          disabled={!canDuplicate}
          title={canDuplicate ? undefined : t("resumePage.limitShort", { max: MAX_RESUMES })}
          onClick={onDuplicate}
          className="relative z-10 hidden md:inline-flex"
        >
          {t("resumePage.duplicate")}
        </Button>
        <RelTime iso={r.updated_at} template={(when) => t("resume.updated", { when })} className="ml-auto hidden text-sm text-ink-2 lg:block" />
        <MenuRoot>
          <MenuTrigger asChild>
            <IconButton label={t("resumePage.more")} size="sm" className="relative z-10 ml-auto lg:ml-0">
              <MoreHorizontal className="size-4.5" />
            </IconButton>
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<Download className="size-4" />} onSelect={() => void pdf.download()} className="sm:hidden">{t("resumePage.downloadPdf")}</MenuItem>
            <MenuItem icon={<Copy className="size-4" />} onSelect={onDuplicate} disabled={!canDuplicate || duplicating} className="md:hidden">
              {t("resumePage.duplicate")}
            </MenuItem>
            <MenuItem icon={<Trash2 className="size-4" />} tone="danger" onSelect={onDelete}>{t("common.delete")}</MenuItem>
          </MenuContent>
        </MenuRoot>
      </div>
    </Card>
  );
}

/** Who can see the resume: a menu styled as a compact select, each choice explained. */
function VisibilityMenu({ value, onChange }: { value: ResumeVisibility; onChange: (v: ResumeVisibility) => void }) {
  const { t } = useTranslation();
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={t("resumePage.visibilityCurrent", { value: t(`resume.vis.${value}`) })}
          className="relative z-10 inline-flex h-9 max-w-full shrink-0 items-center gap-2 rounded-pill border border-line-strong bg-surface pl-3 pr-2.5 text-sm font-medium text-ink transition-[background-color,border-color,scale] duration-150 hover:border-ink-3 hover:bg-sunken active:scale-[0.97] pointer-coarse:h-11"
        >
          <VisibilityDot value={value} />
          <span className="truncate">{t(`resume.vis.${value}`)}</span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-2" />
        </button>
      </MenuTrigger>
      <MenuContent className="w-80">
        <MenuRadioGroup value={value} onValueChange={(v) => v !== value && onChange(v as ResumeVisibility)}>
          {VISIBILITIES.map((v) => (
            <MenuRadioItem key={v} value={v} icon={<VisibilityDot value={v} className="mt-1.5 self-start" />}>
              <span className="block font-medium text-ink">{t(`resume.vis.${v}`)}</span>
              <span className="mt-0.5 block text-sm text-ink-2">{t(`resume.visHint.${v}`)}</span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </MenuRoot>
  );
}

/** Empty list: why a resume matters, how it goes in three steps, and the one action. */
function FirstResume() {
  const { t } = useTranslation();
  const steps = [1, 2, 3] as const;
  return (
    <Card padding="none" className="anim-fade overflow-hidden">
      <EmptyState
        icon={<FileText />}
        headingAs="h2"
        title={t("resumePage.firstTitle")}
        body={t("resume.emptyBody")}
        action={
          <Button asChild size="lg" icon={<Plus className="size-5" />}>
            <LocalizedLink to="/me/resumes/new" prefetch="intent">{t("resumePage.createFirst")}</LocalizedLink>
          </Button>
        }
        className="pb-8 md:pb-10"
      />
      <ol className="grid gap-px border-t border-line bg-line sm:grid-cols-3">
        {steps.map((n) => (
          <li key={n} className="flex gap-3.5 bg-surface p-5 md:p-6">
            <span aria-hidden="true" className="num grid size-9 shrink-0 place-items-center rounded-full bg-lapis-soft font-display text-md font-semibold text-lapis-ink">
              {n}
            </span>
            <div className="min-w-0">
              <p className="text-md font-semibold text-ink">{t(`resumePage.firstSteps.s${n}Title`)}</p>
              <p className="mt-0.5 text-sm text-ink-2">{t(`resumePage.firstSteps.s${n}Body`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function ResumeCardSkeleton() {
  return (
    <div aria-hidden="true" className="surface-card">
      <div className="flex gap-4 p-5 md:p-6">
        <Skeleton className="hidden size-14 shrink-0 rounded-control sm:block" />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
          <div className="flex items-start justify-between gap-4">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-9 w-40 shrink-0" />
          </div>
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-1 h-4 w-1/2" />
        </div>
      </div>
      <div className="flex items-center border-t border-line px-5 py-3.5 md:px-6">
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      </div>
      <div className="flex gap-2 border-t border-line px-5 py-3 md:px-6">
        <Skeleton className="h-9 w-28 rounded-control" />
        <Skeleton className="h-9 w-24 rounded-control" />
        <Skeleton className="ml-auto size-9 rounded-control" />
      </div>
    </div>
  );
}
