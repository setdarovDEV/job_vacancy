import { CircleCheck, FileText, LogIn, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { api, apiError, dataOf, type Schemas } from "~/shared/api/client";
import { refresh, useSession, withAuth } from "~/shared/auth/session";
import { FormError } from "~/shared/forms/FormError";
import { useSubmit } from "~/shared/forms/useSubmit";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { relativeTime } from "~/shared/lib/format";
import { Button } from "~/shared/ui/Button";
import { Callout } from "~/shared/ui/Callout";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Field, Textarea } from "~/shared/ui/Field";
import { SelectableCard, SelectableCardGroup } from "~/shared/ui/SelectableCard";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";

type Resume = Schemas["ResumeCard"];
type Application = Schemas["Application"];
type Load =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; resumes: Resume[]; appliedId: string | null };

const MAX_LETTER = 3000;

// A new application must show up in "My applications" (and its counts) even if they were cached.
const refreshApplications = () =>
  void import("~/shared/query/query").then((m) => m.getQueryClient().invalidateQueries({ queryKey: ["my-applications"] }));

/**
 * Apply flow in one dialog: sign-in / employer / no-resume / already-applied steps, then a resume
 * picker with an optional cover letter, then a success state with a drawn check.
 */
export default function ApplyDialog({
  open, onOpenChange, vacancy, onApplied,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  vacancy: Schemas["VacancyDetail"];
  /** Called once an application is known to exist (sent now, or found from before). */
  onApplied?: () => void;
}) {
  const { t } = useTranslation();
  const { status, user, offline } = useSession();
  const seeker = status === "authed" && user?.role === "seeker";
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [resumeId, setResumeId] = useState("");
  const [letter, setLetter] = useState("");
  const [done, setDone] = useState<{ kind: "sent" | "already"; id?: string } | null>(null);
  const { pending, error, fields, run } = useSubmit();
  // Radix skips links when it picks the first focus: signed-out visitors would land on "×".
  const signIn = useRef<HTMLAnchorElement>(null);

  // The dialog stays mounted between openings (exit animation, cover letter draft kept). Reopened
  // after sending, it says "already applied" instead of replaying the success.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && done?.kind === "sent") setDone({ kind: "already", id: done.id });
  }

  const fetchData = useCallback(async () => {
    // A reopen refreshes quietly: resumes already shown stay until the new list arrives.
    setLoad((l) => (l.status === "ready" ? l : { status: "loading" }));
    try {
      const [rs, apps] = await Promise.all([
        withAuth(() => api.GET("/me/resumes")),
        // Best effort: spot an earlier application up front (the submit answer is the real check).
        withAuth(() => api.GET("/me/applications", { params: { query: { limit: 50 } } })).catch(() => null),
      ]);
      if (!rs.response.ok) throw apiError(rs);
      const resumes = dataOf<Resume[]>(rs) ?? [];
      const mine = apps?.response.ok ? (dataOf<Application[]>(apps) ?? []) : [];
      const prior = mine.find((a) => (a.vacancy_id ?? a.vacancy?.id) === vacancy.id);
      setResumeId((id) => (resumes.some((r) => r.id === id) ? id : (resumes[0]?.id ?? "")));
      setLoad({ status: "ready", resumes, appliedId: prior?.id ?? null });
    } catch (e) {
      setLoad({ status: "error", error: e });
    }
  }, [vacancy.id]);

  useEffect(() => {
    if (seeker && open) void fetchData();
  }, [seeker, open, fetchData]);

  const applied = done != null || (load.status === "ready" && load.appliedId != null);
  // (setting the same flag again is a no-op for the page, so a new callback identity is harmless)
  useEffect(() => {
    if (applied) onApplied?.();
  }, [applied, onApplied]);

  const skeleton = useSkeletonHold(status === "loading" || (seeker && load.status === "loading"));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(
      () => withAuth(() => api.POST("/vacancies/{vacancy}/applications", {
        params: { path: { vacancy: vacancy.id } },
        body: { resume_id: resumeId, cover_letter: letter.trim() || undefined },
      })),
      (res) => {
        setDone({ kind: "sent", id: dataOf<Application>(res)?.id });
        refreshApplications();
      },
      (err) => {
        if (err.code !== "already_applied") return false;
        setDone({ kind: "already" });
        return true;
      },
    );
  };

  const close = () => onOpenChange(false);
  const next = typeof location === "undefined" ? "" : encodeURIComponent(location.pathname);
  const cancel = <Button type="button" variant="ghost" onClick={close}>{t("common.cancel")}</Button>;
  const closeBtn = <Button type="button" variant="secondary" onClick={close}>{t("common.close")}</Button>;

  let body: ReactNode;
  let footer: ReactNode = null;
  if (status === "anon" && offline) {
    body = <ErrorState error={new TypeError("offline")} onRetry={() => refresh()} headingAs="p" />;
  } else if (status === "anon") {
    body = <EmptyState size="sm" headingAs="p" icon={<LogIn />} title={t("apply.signInFirst")} body={t("vacancyPage.signInBody")} />;
    footer = (
      <>
        <Button asChild variant="secondary"><LocalizedLink to={`/register?next=${next}`}>{t("nav.signUp")}</LocalizedLink></Button>
        <Button asChild icon={<LogIn className="size-4.5" />}><LocalizedLink ref={signIn} to={`/login?next=${next}`}>{t("nav.signIn")}</LocalizedLink></Button>
      </>
    );
  } else if (status === "authed" && !seeker) {
    body = <Callout tone="info">{user?.role === "employer" ? t("apply.employerNote") : t("vacancyPage.seekersOnly")}</Callout>;
    footer = closeBtn;
  } else if (done?.kind === "sent") {
    body = <Success title={t("apply.sent")} text={t("apply.sentBody")} />;
    footer = (
      <>
        {closeBtn}
        <Button asChild>
          <LocalizedLink to={done.id ? `/me/applications/${done.id}` : "/me/applications"}>{t("apply.openApplications")}</LocalizedLink>
        </Button>
      </>
    );
  } else if (skeleton || status === "loading" || load.status === "loading") {
    body = <FormSkeleton />;
  } else if (load.status === "error") {
    body = <ErrorState error={load.error} onRetry={fetchData} headingAs="p" />;
    footer = cancel;
  } else if (done?.kind === "already" || load.appliedId) {
    const id = load.appliedId ?? done?.id;
    body = (
      <div role="status">
        <EmptyState size="sm" headingAs="p" icon={<CircleCheck />} title={t("apply.alreadySent")} body={t("vacancyPage.alreadyBody")} />
      </div>
    );
    footer = (
      <>
        {closeBtn}
        <Button asChild>
          <LocalizedLink to={id ? `/me/applications/${id}` : "/me/applications"}>
            {id ? t("vacancyPage.viewApplication") : t("apply.openApplications")}
          </LocalizedLink>
        </Button>
      </>
    );
  } else if (load.resumes.length === 0) {
    body = (
      <EmptyState size="sm" headingAs="p" icon={<FileText />} title={t("vacancyPage.noResumeTitle")} body={t("apply.noResume")} />
    );
    footer = (
      <>
        {cancel}
        <Button asChild icon={<FileText className="size-4.5" />}>
          <LocalizedLink to="/me/resumes/new">{t("apply.createResume")}</LocalizedLink>
        </Button>
      </>
    );
  } else {
    body = (
      <form id="apply-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <FormError>{error}</FormError>
        <div>
          <p className="mb-2 text-sm font-medium text-ink">{t("apply.chooseResume")}</p>
          <SelectableCardGroup
            value={resumeId}
            onValueChange={setResumeId}
            label={t("apply.chooseResume")}
            aria-describedby={fields.resume_id ? "apply-resume-error" : undefined}
          >
            {load.resumes.map((r) => (
              <SelectableCard
                key={r.id}
                value={r.id}
                icon={<FileText />}
                title={r.title || t("resumePage.untitled")}
                description={t("vacancyPage.resumeUpdated", { when: relativeTime(r.updated_at, t) })}
              />
            ))}
          </SelectableCardGroup>
          {fields.resume_id && (
            <p id="apply-resume-error" role="alert" className="mt-2 text-sm text-anor-ink">{fields.resume_id}</p>
          )}
        </div>
        <Field label={t("apply.coverLetter")} optional={t("common.optional")} hint={t("apply.coverHint")} error={fields.cover_letter}>
          <Textarea rows={4} maxLength={MAX_LETTER} value={letter} onChange={(e) => setLetter(e.target.value)} />
        </Field>
        <p className="flex items-start gap-2 text-sm text-ink-2">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-firuza" />
          {t("apply.subtitle", { company: vacancy.company.name })}
        </p>
      </form>
    );
    footer = (
      <>
        {cancel}
        <Button type="submit" form="apply-form" loading={pending} disabled={!resumeId}>{t("apply.submit")}</Button>
      </>
    );
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t("apply.title")}
        description={`${vacancy.title} · ${vacancy.company.name}`}
        closeLabel={t("common.close")}
        dismissible={!pending}
        initialFocus={status === "anon" && !offline ? signIn : undefined}
        footer={footer}
      >
        {body}
      </DialogContent>
    </DialogRoot>
  );
}

/** Firuza check that draws itself: the circle first, then the tick. */
function Success({ title, text }: { title: string; text: string }) {
  return (
    // role=status: the result is read out when it replaces the form.
    <div role="status" className="flex flex-col items-center pb-2 pt-3 text-center">
      <span aria-hidden="true" className="anim-pop grid size-16 place-items-center rounded-full bg-firuza-soft text-firuza-ink" data-state="open">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-9">
          <circle cx="12" cy="12" r="9.5" className="anim-draw origin-center -rotate-90" style={{ "--len": 60 } as CSSProperties} />
          <path d="m7.75 12.25 3 3 5.5-6" className="anim-draw" style={{ "--len": 13, animationDelay: "300ms" } as CSSProperties} />
        </svg>
      </span>
      <p className="mt-5 font-display text-xl font-semibold tracking-heading text-ink">{title}</p>
      <p className="mt-1.5 max-w-sm text-md text-ink-2">{text}</p>
    </div>
  );
}

/** Same shape as the form: two resume cards, the letter field, the note. */
function FormSkeleton() {
  const { t } = useTranslation();
  return (
    <SkeletonDelay>
      <div role="status" className="flex flex-col gap-5">
        <span className="sr-only">{t("common.loading")}</span>
        <div>
          <Skeleton className="mb-2 h-4 w-20" />
          <div className="grid gap-2">
            <Skeleton className="h-18 rounded-control" />
            <Skeleton className="h-18 rounded-control" />
          </div>
        </div>
        <div>
          <Skeleton className="mb-2 h-4 w-32" />
          <Skeleton className="h-28 rounded-control" />
        </div>
        <Skeleton className="h-4 w-3/4" />
      </div>
    </SkeletonDelay>
  );
}
