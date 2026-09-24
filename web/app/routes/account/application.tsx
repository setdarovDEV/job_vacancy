import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck, BriefcaseBusiness, CalendarCheck, CircleX, ExternalLink, Eye, FileText, Handshake, MapPin, MessageSquare, PartyPopper, Send, Undo2, Users,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router";

import { SeekerOnly } from "./layout";
import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { FINAL, StatusBadge, type AppStatus } from "~/shared/application/status";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { useOpenChat } from "~/shared/chat/useOpenChat";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation, type TFunction } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { salary } from "~/shared/lib/format";
import { ApiFailure, authed } from "~/shared/query/query";
import { Avatar } from "~/shared/ui/Avatar";
import { BackLink } from "~/shared/ui/BackLink";
import { Button } from "~/shared/ui/Button";
import { Card, CardHeader } from "~/shared/ui/Card";
import { ConfirmDialog } from "~/shared/ui/ConfirmDialog";
import { ErrorState } from "~/shared/ui/ErrorState";
import { absoluteDate, RelTime } from "~/shared/ui/RelTime";
import { Skeleton, SkeletonDelay, SkeletonText, useSkeletonHold } from "~/shared/ui/Skeleton";
import { Stepper, type Step } from "~/shared/ui/Stepper";
import { Timeline, type TimelineItem } from "~/shared/ui/Timeline";
import { toast } from "~/shared/ui/toast-store";

type App = Schemas["Application"];

export default function ApplicationPage() {
  return <SeekerOnly><Detail /></SeekerOnly>;
}

// How each status reads in the history: tint + icon (never colour alone — the title says it).
const LOOK: Record<AppStatus, { tone: TimelineItem["tone"]; icon: ReactNode }> = {
  sent: { tone: "neutral", icon: <Send /> },
  viewed: { tone: "lapis", icon: <Eye /> },
  invited: { tone: "firuza", icon: <Handshake /> },
  interview: { tone: "firuza", icon: <Users /> },
  hired: { tone: "firuza", icon: <PartyPopper /> },
  rejected: { tone: "anor", icon: <CircleX /> },
  withdrawn: { tone: "neutral", icon: <Undo2 /> },
};

// Progress through the hiring funnel. "invited" and "interview" share a stage.
const STAGE: Record<AppStatus, number> = { sent: 0, viewed: 1, invited: 2, interview: 2, hired: 3, rejected: -1, withdrawn: -1 };

function pipeline(a: App, t: TFunction): { steps: Step[]; current: string } {
  const status = (a.status ?? "sent") as AppStatus;
  // The furthest stage the application reached, from its history (a rejection can follow an interview).
  const reached = Math.max(0, ...(a.events ?? []).map((e) => STAGE[e.to as AppStatus] ?? 0), STAGE[status]);
  const wasInvited = (a.events ?? []).some((e) => e.to === "invited");
  const middle = status === "invited" || (wasInvited && status !== "interview") ? "invited" : "interview";
  const base: Step[] = [
    { id: "sent", label: t("enums.application_status.sent") },
    { id: "viewed", label: t("enums.application_status.viewed") },
    { id: middle, label: t(`enums.application_status.${middle}`) },
    { id: "hired", label: t("enums.application_status.hired") },
  ];
  if (status === "rejected" || status === "withdrawn") {
    // Stages up to the one reached are done; the final status replaces the rest.
    const steps = base.slice(0, reached + 1).map((s) => ({ ...s, done: true }));
    steps.push({ id: status, label: t(`enums.application_status.${status}`), error: status === "rejected", done: status === "withdrawn" });
    return { steps, current: status };
  }
  const at = STAGE[status];
  return { steps: base.map((s, i) => ({ ...s, done: i < at || status === "hired" })), current: base[at].id };
}

function Detail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const locale = useLocale();
  const qc = useQueryClient();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const [confirm, setConfirm] = useState(false);
  const key = ["application", id];
  const q = useQuery({
    queryKey: key,
    queryFn: () => authed<App>(() => api.GET("/applications/{application}", { params: { path: { application: id! } } })),
  });
  const loading = useSkeletonHold(q.isPending);
  const chat = useOpenChat();
  const withdraw = useMutation({
    mutationFn: () => authed<App>(() => api.POST("/applications/{application}/withdraw", { params: { path: { application: id! } } })),
    // Optimistic: the badge and history flip at once; a refusal puts them back.
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<App>(key);
      if (prev) {
        const at = new Date().toISOString();
        qc.setQueryData<App>(key, { ...prev, status: "withdrawn", status_changed_at: at, events: [...(prev.events ?? []), { from: prev.status, to: "withdrawn", at }] });
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network") });
    },
    onSuccess: (a) => {
      qc.setQueryData(key, a);
      toast({ tone: "success", title: t("accountPage.withdrawn") });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["my-applications"] }),
  });

  const back = <BackLink to="/me/applications">{t("nav.applications")}</BackLink>;

  if (loading) {
    return (
      <>
        {back}
        <SkeletonDelay>
          <DetailSkeleton />
        </SkeletonDelay>
      </>
    );
  }
  if (q.isError) {
    return (
      <>
        {back}
        <Card padding="none" className="mt-2">
          <ErrorState error={q.error} headingAs="h1" onRetry={() => q.refetch()} />
        </Card>
      </>
    );
  }

  const a = q.data!;
  const v = a.vacancy;
  const status = (a.status ?? "sent") as AppStatus;
  const events = [...(a.events ?? [])].reverse();
  const flow = pipeline(a, t);
  const region = v ? nameOf(idx.regions.get(v.district_id ?? v.region_id)?.name ?? idx.regions.get(v.region_id)?.name, locale) : "";
  const hasSalary = v?.salary && (v.salary.min != null || v.salary.max != null);
  const history: TimelineItem[] = events.map((e, i) => {
    const s = (e.to ?? "sent") as AppStatus;
    return {
      id: `${e.at}-${i}`,
      title: t(`enums.application_status.${s}`),
      at: e.at,
      tone: i === 0 ? LOOK[s]?.tone : "neutral",
      icon: LOOK[s]?.icon,
      body: e.note && <p className="whitespace-pre-line break-words rounded-control bg-sunken px-3 py-2 text-md text-ink">{e.note}</p>,
    };
  });

  return (
    <>
      {back}
      <Card as="header" radius="sheet" padding="lg" className="mt-2">
        {/* Phones: logo beside the status line, title and the rest full width (long titles and
            salaries get the whole row); from sm the logo gets its own column. */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 md:gap-x-5">
          {v ? (
            <Avatar
              name={v.company.name}
              src={v.company.logo_url}
              square
              size="lg"
              priority
              className="sm:row-span-4"
              style={{ viewTransitionName: `vacancy-logo-${v.id}` }}
            />
          ) : (
            <span />
          )}
          <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1.5 sm:min-h-0">
            <StatusBadge status={status} />
            {a.status_changed_at && <RelTime iso={a.status_changed_at} template={(when) => t("resume.updated", { when })} className="text-sm text-ink-2" />}
          </div>
          <h1
            className="col-span-2 mt-3 break-words font-display text-2xl font-semibold tracking-heading text-ink sm:col-span-1 sm:col-start-2 sm:mt-2 md:text-3xl"
            style={v ? { viewTransitionName: `vacancy-title-${v.id}` } : undefined}
          >
            {v?.title ?? t("accountPage.vacancyGone")}
          </h1>
          {v && (
            <p className="col-span-2 mt-1.5 flex min-w-0 items-center gap-1.5 text-md text-ink-2 sm:col-span-1 sm:col-start-2">
              <span className="truncate">{v.company.name}</span>
              {v.company.verified && <BadgeCheck className="size-4.5 shrink-0 text-firuza" aria-label={t("common.verified")} role="img" />}
            </p>
          )}
          {v && (
            <p
              className={cn(
                "col-span-2 mt-3 sm:col-span-1 sm:col-start-2",
                hasSalary ? "num font-display text-xl font-semibold tracking-heading text-firuza-ink" : "text-md text-ink-2",
              )}
            >
              {salary(v.salary, t, locale)}
            </p>
          )}
        </div>

        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
          {a.created_at && (
            <li className="flex items-center gap-1.5">
              <CalendarCheck aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
              {t(a.source === "invite" ? "accountPage.invitedOn" : "accountPage.appliedOn", { date: absoluteDate(a.created_at, locale) })}
            </li>
          )}
          {region && <li className="flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-4 shrink-0 text-ink-3" />{region}</li>}
          {v && (
            <li className="flex items-center gap-1.5">
              <BriefcaseBusiness aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
              {t(`enums.work_format.${v.work_format}`)}
            </li>
          )}
        </ul>

        <div className="mt-6 border-t border-line pt-4">
          <Stepper steps={flow.steps} current={flow.current} className="-mx-1.5" />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button icon={<MessageSquare className="size-4.5" />} loading={chat.isPending} onClick={() => chat.mutate(a.id!)} className="max-sm:w-full">
            {t("applications.openChat")}
          </Button>
          {v && (
            <Button asChild variant="secondary" icon={<ExternalLink className="size-4.5" />} className="max-sm:flex-1">
              <LocalizedLink to={`/vacancies/${v.slug}`} prefetch="intent">{t("accountPage.openVacancy")}</LocalizedLink>
            </Button>
          )}
          {!FINAL.includes(status) && (
            <Button
              variant="ghost"
              icon={<Undo2 className="size-4.5" />}
              onClick={() => setConfirm(true)}
              className="text-anor-ink hover:bg-anor-soft hover:text-anor-ink max-sm:flex-1"
            >
              {t("applications.withdraw")}
            </Button>
          )}
        </div>
      </Card>

      <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
        <Card as="section" aria-labelledby="history-title">
          <CardHeader id="history-title" title={t("applications.history")} />
          <Timeline items={history} className="mt-5" />
        </Card>
        <Card as="section" aria-labelledby="letter-title">
          <CardHeader id="letter-title" title={t("apply.coverLetter")} />
          {a.cover_letter ? (
            <p className="mt-4 whitespace-pre-line break-words text-md leading-relaxed text-ink">{a.cover_letter}</p>
          ) : (
            <p className="mt-4 text-md text-ink-2">{t("applications.noLetter")}</p>
          )}
          {a.resume_id && (
            <Button asChild variant="soft" icon={<FileText className="size-4.5" />} className="mt-5">
              <LocalizedLink to={`/resumes/${a.resume_id}`} prefetch="intent">{t("applications.viewResume")}</LocalizedLink>
            </Button>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="danger"
        title={t("applications.withdrawTitle")}
        body={t("applications.withdrawBody")}
        confirmLabel={t("applications.withdraw")}
        onConfirm={() => withdraw.mutateAsync()}
      />
    </>
  );
}

function DetailSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" className="mt-2">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true">
        <div className="surface-card rounded-sheet p-6 md:p-8">
          <div className="flex items-start gap-4 md:gap-5">
            <Skeleton className="size-14 shrink-0 rounded-panel" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-8 w-4/5 md:h-9" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-6 w-1/4" />
            </div>
          </div>
          <Skeleton className="mt-5 h-4 w-2/3" />
          <Skeleton className="mt-6 h-11 w-full" />
          <div className="mt-5 flex gap-2">
            <Skeleton className="h-11 w-48 rounded-control" />
            <Skeleton className="h-11 w-40 rounded-control" />
          </div>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="surface-card p-5 md:p-6"><Skeleton className="h-5 w-32" /><SkeletonText lines={4} className="mt-5" /></div>
          <div className="surface-card p-5 md:p-6"><Skeleton className="h-5 w-32" /><SkeletonText lines={3} className="mt-5" /></div>
        </div>
      </div>
    </div>
  );
}
