import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ChevronDown, Lock, MessageSquare, Send } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "react-router";

import type { ShellHandle } from "../site";
import { EmployerOnly } from "./EmployerOnly";
import type { EmployerApplication } from "./company-hook";
import { useOpenChat } from "~/shared/chat/useOpenChat";
import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import {
  EMPLOYER_TARGETS, isEmployerTarget, lookOf, StageMenuItems, StatusBadge, StatusIcon, type EmployerTarget,
} from "~/shared/application/status";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { ApiFailure, authed } from "~/shared/query/query";
import { ResumeView, ResumeViewSkeleton } from "~/shared/resume/ResumeView";
import { BackLink } from "~/shared/ui/BackLink";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Callout } from "~/shared/ui/Callout";
import { Card, CardBody, CardHeader } from "~/shared/ui/Card";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Textarea } from "~/shared/ui/Field";
import { Popover } from "~/shared/ui/Popover";
import { RelTime } from "~/shared/ui/RelTime";
import { PageHeader } from "~/shared/ui/Section";
import { Select } from "~/shared/ui/Select";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";
import { Spinner } from "~/shared/ui/Spinner";
import { Timeline, type TimelineItem } from "~/shared/ui/Timeline";
import { toast } from "~/shared/ui/toast-store";

type App = EmployerApplication;

// A detail page with its own action bar on phones: the tab bar steps aside (like the vacancy page).
export const handle: ShellHandle = { tabBar: false };

export default function EmployerApplicationPage() {
  return <EmployerOnly><Detail /></EmployerOnly>;
}

// Private pages render in the browser only, so the first client render already knows the width.
function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

const boardPath = (a: App) => `/employer/vacancies/${a.vacancy_id}/applications`;

function Detail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const key = ["application", id];
  const q = useQuery({
    queryKey: key,
    queryFn: () => authed<App>(() => api.GET("/applications/{application}", { params: { path: { application: id! } } })),
  });
  const a = q.data;
  const resume = useQuery({
    queryKey: ["resume", a?.resume_id],
    enabled: Boolean(a?.resume_id),
    queryFn: () => authed<Schemas["ResumeDetail"]>(() => api.GET("/resumes/{resume}", { params: { path: { resume: a!.resume_id! } } })),
  });
  const chat = useOpenChat();
  const wide = useMedia("(min-width: 80rem)"); // xl: resume + aside side by side
  const loading = useSkeletonHold(q.isPending);
  const [said, setSaid] = useState("");

  // The first employer visit marks a new application "viewed" on the server, so the board's
  // columns and counts may be out of date now (they refetch when the board is opened again).
  const vacancyId = a?.vacancy_id;
  useEffect(() => {
    if (!vacancyId) return;
    void qc.invalidateQueries({ queryKey: ["applications", vacancyId] });
    void qc.invalidateQueries({ queryKey: ["application-stats", vacancyId] });
  }, [qc, vacancyId]);

  // Toasts rise above the floating action bar while it is shown (below xl).
  useEffect(() => {
    if (wide) return;
    const root = document.documentElement;
    root.style.setProperty("--toast-lift", "4.5rem");
    return () => void root.style.removeProperty("--toast-lift");
  }, [wide]);

  const stage = useMutation({
    mutationFn: (s: EmployerTarget) =>
      authed<App>(() => api.PUT("/applications/{application}/status", { params: { path: { application: id! } }, body: { status: s } })),
    // Optimistic: the badge, select and bar switch at once; a failure puts the old stage back.
    onMutate: async (s) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<App>(key);
      qc.setQueryData<App>(key, (o) => o && { ...o, status: s });
      return { prev };
    },
    onError: (e, s, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast({
        tone: "error",
        title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network"),
        action: { label: t("common.retry"), onClick: () => stage.mutate(s) },
      });
    },
    onSuccess: (r, s) => {
      qc.setQueryData<App>(key, (o) => (o ? { ...o, ...r } : r));
      setSaid(t("kanbanPage.stageChanged", { stage: t(`enums.application_status.${s}`) }));
    },
    onSettled: (r) => {
      const v = r?.vacancy_id ?? vacancyId;
      if (!v) return;
      void qc.invalidateQueries({ queryKey: ["applications", v] });
      void qc.invalidateQueries({ queryKey: ["application-stats", v] });
    },
  });

  if (loading) return <SkeletonDelay><DetailSkeleton /></SkeletonDelay>;
  if (q.isError || !a) {
    return (
      <>
        <div className="mb-3"><BackLink to="/employer">{t("account.dashboard")}</BackLink></div>
        <Card padding="none"><ErrorState error={q.error} onRetry={() => q.refetch()} headingAs="h1" /></Card>
      </>
    );
  }

  const status = a.status ?? "sent";
  const withdrawn = status === "withdrawn";
  const c = a.candidate;
  const pick = (s: EmployerTarget) => {
    if (s !== status && !withdrawn) stage.mutate(s);
  };
  const openChat = () => chat.mutate(a.id!);

  const resumeBlock = resume.isError ? (
    <Card padding="none"><ErrorState error={resume.error} onRetry={() => resume.refetch()} /></Card>
  ) : resume.data ? (
    <ResumeView r={resume.data} embedded headingAs="h2" />
  ) : a.resume_id ? (
    <ResumeViewSkeleton />
  ) : null;

  return (
    <>
      <PageHeader
        breadcrumbs={<BackLink to={boardPath(a)} viewTransition>{a.vacancy?.title ?? t("employer.applications")}</BackLink>}
        // inline-block: one box, so the name can morph from the kanban card (view transition).
        title={<span className="inline-block" style={{ viewTransitionName: `application-name-${a.id}` }}>{c.full_name}</span>}
        description={(
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusBadge status={status} />
            {a.created_at && <RelTime iso={a.created_at} template={(when) => t("kanbanPage.appliedAt", { when })} className="text-md" />}
            {a.source === "invite" && <Badge tone="lapis" icon={<Send />}>{t("employer.invitedByYou")}</Badge>}
          </span>
        )}
      />
      <p role="status" aria-live="polite" className="sr-only">{said}</p>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {a.cover_letter && (
            <Card as="section" aria-labelledby="cover-letter">
              <CardHeader id="cover-letter" title={t("apply.coverLetter")} />
              <CardBody>
                <p className="max-w-prose whitespace-pre-line break-words text-md leading-relaxed text-ink">{a.cover_letter}</p>
              </CardBody>
            </Card>
          )}
          {resumeBlock}
          {/* Below xl the aside's note and history follow the resume (stage + chat live in the bar). */}
          {!wide && (
            <div className="grid gap-6 md:grid-cols-2">
              <NoteCard a={a} />
              <HistoryCard a={a} />
            </div>
          )}
        </div>

        {wide && (
          <aside aria-label={t("kanbanPage.actions")}>
            <div className="sticky top-24 flex flex-col gap-6">
              <Card as="section" aria-labelledby="stage-title">
                <CardHeader id="stage-title" title={t("employer.stage")} />
                <CardBody>
                  {withdrawn ? (
                    <Callout>{t("employer.withdrawnNote")}</Callout>
                  ) : (
                    <>
                      <Select
                        aria-label={t("employer.moveTo")}
                        aria-describedby="stage-hint"
                        value={isEmployerTarget(status) ? status : ""}
                        placeholder={t("employer.moveTo")}
                        required
                        onValueChange={(v) => isEmployerTarget(v) && pick(v)}
                        options={EMPLOYER_TARGETS.map((s) => ({ value: s, label: t(`enums.application_status.${s}`) }))}
                      />
                      <p id="stage-hint" className="mt-2 text-sm text-ink-2">{t("kanbanPage.stageHint")}</p>
                    </>
                  )}
                  <Button variant="secondary" className="mt-4 w-full" icon={<MessageSquare className="size-4.5" />} loading={chat.isPending} onClick={openChat}>
                    {t("employer.message")}
                  </Button>
                </CardBody>
              </Card>
              <NoteCard a={a} />
              <HistoryCard a={a} />
            </div>
          </aside>
        )}
      </div>

      {/* Phones to laptops: the two actions float at the bottom, above the home indicator. */}
      {!wide && (
        <div
          role="region"
          aria-label={t("kanbanPage.actions")}
          className="glass-chrome sticky bottom-above-tabbar z-40 mt-6 flex items-center gap-2 rounded-pill p-1.5 md:mx-auto md:max-w-md"
        >
          {withdrawn ? (
            <p className="min-w-0 flex-1 truncate px-3 text-sm text-ink-2">{t("employer.withdrawnNote")}</p>
          ) : (
            <Popover
              label={t("employer.moveTo")}
              align="start"
              className="w-64"
              trigger={(p) => (
                <Button
                  popoverTarget={p.popoverTarget}
                  aria-label={t("kanbanPage.stageButton", { stage: t(`enums.application_status.${status}`) })}
                  variant="secondary"
                  shape="pill"
                  className="min-w-0 flex-1 justify-start gap-2 pl-2 pr-3.5"
                >
                  <StatusIcon status={status} />
                  <span className="min-w-0 flex-1 truncate text-left">{t(`enums.application_status.${status}`)}</span>
                  <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
                </Button>
              )}
            >
              <StageMenuItems current={status} onPick={pick} />
            </Popover>
          )}
          <Button shape="pill" className="shrink-0" icon={<MessageSquare className="size-4.5" />} loading={chat.isPending} onClick={openChat}>
            {t("kanbanPage.chat")}
          </Button>
        </div>
      )}
    </>
  );
}

// ---- private note with autosave -------------------------------------------------------------

type SaveState = "idle" | "saving" | "saved" | "error";
const AUTOSAVE_MS = 800;

function NoteCard({ a }: { a: App }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const uid = useId();
  const initial = a.employer_note ?? "";
  const [text, setText] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");
  // The last non-idle state keeps its words while the line fades out; nothing before the first save.
  const [shown, setShown] = useState<Exclude<SaveState, "idle"> | null>(null);
  const latest = useRef(initial);
  const saved = useRef(initial);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alive = useRef(true);

  const put = useCallback(
    // keepalive: a save started as the tab closes still reaches the server.
    (note: string) => authed<App>(() => api.PUT("/applications/{application}/note", { params: { path: { application: a.id! } }, body: { note }, keepalive: true })),
    [a.id],
  );
  const store = useCallback(
    (r: App) => qc.setQueryData<App>(["application", a.id], (o) => o && { ...o, employer_note: r.employer_note }),
    [a.id, qc],
  );
  const show = (s: SaveState) => {
    if (!alive.current) return;
    setState(s);
    if (s !== "idle") setShown(s);
  };

  const save = useRef<() => Promise<void>>(async () => {});
  save.current = async () => {
    clearTimeout(timer.current);
    const value = latest.current;
    if (busy.current || value === saved.current) return;
    busy.current = true;
    show("saving");
    try {
      const r = await put(value);
      saved.current = value;
      store(r);
      show("saved");
    } catch (e) {
      busy.current = false;
      show("error");
      toast({ tone: "error", title: t("kanbanPage.saveFailed"), body: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network") });
      return;
    }
    busy.current = false;
    // Typed on while the request was out: save the newer text too.
    if (latest.current !== saved.current) void save.current();
  };

  // "Saved" fades after 2s; errors stay until the next save.
  useEffect(() => {
    if (state !== "saved") return;
    const id = setTimeout(() => show("idle"), 2000);
    return () => clearTimeout(id);
  }, [state]);

  // Leaving the page (or hiding the tab) mid-pause still saves the last words. Mount-only: the
  // cleanup is the unmount, reading the latest helpers through a ref.
  const unmount = useRef({ put, store, t });
  unmount.current = { put, store, t };
  useEffect(() => {
    alive.current = true;
    const flush = () => {
      if (document.visibilityState === "hidden") void save.current();
    };
    document.addEventListener("visibilitychange", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      alive.current = false;
      clearTimeout(timer.current);
      if (!busy.current && latest.current !== saved.current) {
        const { put, store, t } = unmount.current;
        put(latest.current).then(store, () => toast({ tone: "error", title: t("kanbanPage.saveFailed") }));
      }
    };
  }, []);

  const onChange = (v: string) => {
    setText(v);
    latest.current = v;
    if (state === "error") show("idle");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void save.current(), AUTOSAVE_MS);
  };

  const view = state === "idle" ? shown : state;
  return (
    <Card as="section" aria-labelledby={`${uid}-title`}>
      <CardHeader
        id={`${uid}-title`}
        title={t("employer.note")}
        description={(
          <span className="inline-flex items-center gap-1.5 text-sm" id={`${uid}-hint`}>
            <Lock aria-hidden="true" className="size-3.5 shrink-0" />
            {t("employer.noteHint")}
          </span>
        )}
      />
      <CardBody>
        <Textarea
          rows={4}
          maxLength={5000}
          value={text}
          placeholder={t("kanbanPage.notePlaceholder")}
          aria-labelledby={`${uid}-title`}
          aria-describedby={`${uid}-hint`}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => void save.current()}
        />
        {/* Fixed-height status line: nothing moves when it appears or fades. */}
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "mt-2 flex min-h-6 items-center gap-1.5 text-sm transition-opacity duration-300",
            state === "idle" ? "opacity-0" : "opacity-100",
            view === "error" ? "text-anor-ink" : "text-ink-2",
          )}
        >
          {view === "saving" && <><Spinner className="size-3.5" />{t("kanbanPage.saving")}</>}
          {view === "saved" && <><Check aria-hidden="true" className="size-4 text-firuza-ink" strokeWidth={2.5} />{t("common.saved")}</>}
          {view === "error" && state === "error" && (
            <>
              <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
              {t("kanbanPage.saveFailed")}
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void save.current()}>{t("common.retry")}</Button>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// ---- history ------------------------------------------------------------------------------

function HistoryCard({ a }: { a: App }) {
  const { t } = useTranslation();
  const uid = useId();
  const events = [...(a.events ?? [])].reverse();
  const items: TimelineItem[] = events.map((e, i) => {
    const look = lookOf(e.to);
    const Icon = look.icon;
    return {
      id: `${e.at}-${i}`,
      title: t(`enums.application_status.${e.to ?? "sent"}`),
      at: e.at,
      // The current stage carries its colour; earlier steps stay quiet (the icon still says which).
      tone: i === 0 ? look.tone : "neutral",
      icon: <Icon />,
      body: e.note && <p className="whitespace-pre-line break-words rounded-control bg-sunken px-3 py-2 text-md text-ink">{e.note}</p>,
    };
  });
  return (
    <Card as="section" aria-labelledby={`${uid}-title`}>
      <CardHeader id={`${uid}-title`} title={t("applications.history")} />
      <CardBody><Timeline items={items} /></CardBody>
    </Card>
  );
}

// ---- loading shape ------------------------------------------------------------------------

function DetailSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true">
        <div className="mb-6 md:mb-8">
          <div className="mb-3 flex h-11 items-center"><Skeleton className="h-4 w-44" /></div>
          <Skeleton className="h-8 w-2/3 max-w-sm md:h-10" />
          <div className="mt-2 flex h-7 items-center gap-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <ResumeViewSkeleton />
          <div className="hidden flex-col gap-6 xl:flex">
            {[
              ["h-11 w-full rounded-control", "h-11 w-full rounded-control"],
              ["h-28 w-full rounded-control"],
              ["h-4 w-2/3", "h-4 w-1/2", "h-4 w-3/5"],
            ].map((rows, i) => (
              <Card key={i}>
                <Skeleton className="h-5 w-32" />
                <div className="mt-4 flex flex-col gap-3">
                  {rows.map((r, j) => <Skeleton key={j} className={r} />)}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
