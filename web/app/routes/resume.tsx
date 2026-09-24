import { useQuery } from "@tanstack/react-query";
import { Download, PencilLine, Send } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import type { ShellHandle } from "./site";
import { api, type Schemas } from "~/shared/api/client";
import { useSession } from "~/shared/auth/session";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { ApiFailure, authed } from "~/shared/query/query";
import { ResumeView, ResumeViewSkeleton, useResumePdf, VisibilityDot } from "~/shared/resume/ResumeView";
import { BackLink } from "~/shared/ui/BackLink";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";

const InviteDialog = lazy(() => import("./employer/InviteDialog"));

type Detail = Schemas["ResumeDetail"];

// The page brings its own floating action bar on phones: one blurred bottom layer, not two.
export const handle: ShellHandle = { tabBar: false };

export default function ResumePage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useSession();
  const q = useQuery({
    queryKey: ["resume", id],
    queryFn: () => authed<Detail>(() => api.GET("/resumes/{resume}", { params: { path: { resume: id! } } })),
  });
  const loading = useSkeletonHold(q.isPending);
  const r = q.data;
  // Decided by role, not by the loaded resume, so the link doesn't change under the finger.
  const back = user?.role === "seeker" ? { to: "/me/resumes", label: t("account.myResumes") }
    : user?.role === "employer" ? { to: "/employer/candidates", label: t("resumePage.backCandidates") }
    : { to: "/vacancies", label: t("common.back") };
  const notFound = q.error instanceof ApiFailure && q.error.status === 404;

  return (
    <div className="container-page pb-28 pt-6 md:pt-10 lg:pb-24">
      <BackNav to={back.to} label={back.label} />
      {loading ? (
        <SkeletonDelay>
          <div role="status" aria-busy="true" className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <span className="sr-only">{t("common.loading")}</span>
            <ResumeViewSkeleton className="lg:aspect-[210/297]" />
            <div aria-hidden="true" className="hidden lg:block">
              <div className="surface-card flex flex-col gap-3 p-5">
                <Skeleton className="h-11 rounded-control" />
                <Skeleton className="h-11 rounded-control" />
                <Skeleton className="mt-2 h-4 w-3/4" />
              </div>
            </div>
          </div>
        </SkeletonDelay>
      ) : q.isError || !r ? (
        <Card padding="none" className="mx-auto mt-4 max-w-2xl">
          <ErrorState
            error={q.error}
            title={notFound ? t("apiErrors.resume_not_found") : undefined}
            headingAs="h1"
            homeLink
            onRetry={notFound ? undefined : () => q.refetch()}
          />
        </Card>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* A4 proportion on desktop: a short resume still reads as a page, a long one grows. */}
          <ResumeView r={r} actions={false} className="lg:aspect-[210/297]" />
          <Actions r={r} />
        </div>
      )}
    </div>
  );
}

// Back goes to where the person came from when there is history (an application, a search),
// otherwise to the natural parent.
function BackNav({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <BackLink
      to={to}
      onClick={(e) => {
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
        if (idx > 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
          e.preventDefault();
          navigate(-1);
        }
      }}
    >
      {label}
    </BackLink>
  );
}

/** PDF, Invite (employers), Edit (owner): a sticky aside on desktop, a floating glass bar on phones. */
function Actions({ r }: { r: Detail }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const pdf = useResumePdf(r.id, r.person.full_name ?? r.title);
  const [invite, setInvite] = useState(false);
  const employer = user?.role === "employer";
  const vis = r.visibility ?? "public";

  // Toasts rise above the floating bar on phones while this page is open.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--toast-lift", "4.5rem");
    return () => void root.style.removeProperty("--toast-lift");
  }, []);

  const edit = r.is_owner && (
    <Button asChild icon={<PencilLine className="size-4.5" />} className="flex-1 lg:w-full lg:flex-none">
      <LocalizedLink to={`/me/resumes/${r.id}/edit`} prefetch="intent">{t("common.edit")}</LocalizedLink>
    </Button>
  );
  const inviteBtn = employer && (
    <Button icon={<Send className="size-4.5" />} onClick={() => setInvite(true)} className="flex-1 lg:w-full lg:flex-none">
      {t("candidates.invite")}
    </Button>
  );
  const pdfBtn = (
    <Button
      variant="secondary"
      icon={<Download className="size-4.5" />}
      loading={pdf.busy}
      onClick={pdf.download}
      className="flex-1 lg:w-full lg:flex-none"
    >
      {t("resumePage.downloadPdf")}
    </Button>
  );

  return (
    <>
      <aside aria-label={t("resumePage.actions")} className="hidden lg:block">
        <div className="sticky top-24 flex flex-col gap-4">
          <Card padding="sm" className="flex flex-col gap-2.5">
            {edit}
            {inviteBtn}
            {pdfBtn}
          </Card>
          {r.is_owner && (
            <Card padding="sm">
              <p className="text-xs font-semibold uppercase tracking-caps text-ink-2">{t("resume.visibility")}</p>
              <p className="mt-2 flex items-center gap-2 text-md font-medium text-ink">
                <VisibilityDot value={vis} />
                {t(`resume.vis.${vis}`)}
              </p>
              <p className="mt-1 text-sm text-ink-2">{t(`resume.visHint.${vis}`)}</p>
            </Card>
          )}
        </div>
      </aside>

      <div className="glass-chrome fixed inset-x-3 bottom-above-tabbar z-40 flex items-center gap-2 rounded-sheet p-2 md:inset-x-0 md:mx-auto md:max-w-lg lg:hidden">
        {pdfBtn}
        {edit}
        {inviteBtn}
      </div>

      {invite && (
        <Suspense>
          <InviteDialog open={invite} onOpenChange={setInvite} resumeId={r.id} name={r.person.full_name ?? ""} />
        </Suspense>
      )}
    </>
  );
}
