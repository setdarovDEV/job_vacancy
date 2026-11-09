import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Check, X } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { AdminOnly, MIN_REASON_LENGTH, NoteDialog } from "./admin-ui";
import { adminKeys } from "./keys";
import { useAdminMutation } from "./toggle";
import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { localizedPath } from "~/shared/i18n/config";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { relativeTime } from "~/shared/lib/format";
import { ApiFailure, authed } from "~/shared/query/query";
import { Avatar } from "~/shared/ui/Avatar";
import { Button } from "~/shared/ui/Button";
import { EmptyState } from "~/shared/ui/EmptyState";
import { Skeleton } from "~/shared/ui/Skeleton";
import { VacancyContent, VacancyFacts } from "~/shared/vacancy/VacancyDetails";

type Vacancy = Schemas["VacancyDetail"];

export default function ModerationReview() {
  return <AdminOnly><Page /></AdminOnly>;
}

function Page() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const q = useQuery({
    queryKey: adminKeys.vacancy(id),
    queryFn: () => authed<Vacancy>(() => api.GET("/vacancies/{vacancy}", { params: { path: { vacancy: id } } })),
  });
  if (q.isPending) return <Skeleton className="h-[32rem] rounded-sheet" />;
  if (!q.data) {
    return <EmptyState title={q.error instanceof ApiFailure ? errorText(t, q.error.error) : t("errors.network")} action={<BackLink />} />;
  }
  return <Review v={q.data} />;
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <LocalizedLink to="/admin/moderation" className="inline-flex items-center gap-1.5 text-sm text-ink-3 transition-colors hover:text-ink">
      <ArrowLeft className="size-4" />{t("admin.backToQueue")}
    </LocalizedLink>
  );
}

function Review({ v }: { v: Vacancy }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const [rejecting, setRejecting] = useState(false);
  const inModeration = v.status === "moderation";
  const path = { params: { path: { vacancy: v.id } } };
  const backToQueue = () => navigate(localizedPath(locale, "/admin/moderation"));

  const approve = useAdminMutation({
    mutationFn: () => authed<Vacancy>(() => api.POST("/admin/vacancies/{vacancy}/approve", path)),
    done: t("admin.approved"),
    invalidate: [adminKeys.moderation()],
  });
  const reject = useAdminMutation({
    mutationFn: (reason: string) => authed<Vacancy>(() => api.POST("/admin/vacancies/{vacancy}/reject", { ...path, body: { reason } })),
    done: t("admin.rejected"),
    invalidate: [adminKeys.moderation()],
  });

  return (
    <div>
      <BackLink />
      {!inModeration && (
        <p className="mt-5 rounded-control bg-zafaron-soft px-4 py-3 text-sm font-medium text-zafaron-ink">
          {t("admin.notInModeration")} {t(`vacancyStatus.${v.status}`)}
        </p>
      )}
      <header className="mt-5 rounded-sheet border border-line bg-surface p-5 md:p-8">
        <div className="flex items-start gap-4">
          <Avatar name={v.company.name} src={v.company.logo_url} square size="lg" className="max-sm:hidden" />
          <div className="min-w-0 flex-1">
            <h1 className="text-balance font-display text-2xl font-semibold leading-tight tracking-[-0.03em] text-ink">{v.title}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
              <span className="flex items-center gap-1.5 font-medium">
                {v.company.name}
                {v.company.verified && <BadgeCheck className="size-4.5 text-firuza" aria-label={t("common.verified")} />}
              </span>
              <span className="text-sm text-ink-3">{t("admin.created", { when: relativeTime(v.created_at, t) })}</span>
            </p>
          </div>
        </div>
        <VacancyFacts v={v} />
        {inModeration && (
          <div className="mt-7 flex flex-wrap gap-2">
            <Button icon={<Check className="size-4.5" />} loading={approve.isPending} onClick={() => approve.mutate(undefined, { onSuccess: backToQueue })}>
              {t("admin.approve")}
            </Button>
            <Button variant="secondary" icon={<X className="size-4.5" />} onClick={() => setRejecting(true)}>{t("admin.reject")}</Button>
          </div>
        )}
      </header>
      <VacancyContent v={v} />
      <NoteDialog
        open={rejecting}
        title={t("admin.rejectTitle")}
        body={t("admin.rejectHint")}
        label={t("admin.rejectReason")}
        placeholder={t("admin.rejectPlaceholder")}
        minLength={MIN_REASON_LENGTH}
        confirmLabel={t("admin.reject")}
        danger
        pending={reject.isPending}
        onConfirm={(reason) => reject.mutate(reason, { onSuccess: backToQueue })}
        onClose={() => setRejecting(false)}
      />
    </div>
  );
}
