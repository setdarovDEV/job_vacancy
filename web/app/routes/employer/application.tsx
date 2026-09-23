import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";

import { EmployerOnly } from "./EmployerOnly";
import type { EmployerApplication } from "./company-hook";
import { useOpenChat } from "~/shared/chat/useOpenChat";
import { ResumeView } from "~/shared/resume/ResumeView";
import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { StatusBadge } from "~/shared/application/status";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { relativeTime } from "~/shared/lib/format";
import { ApiFailure, authed } from "~/shared/query/query";
import { Button } from "~/shared/ui/Button";
import { EmptyState } from "~/shared/ui/EmptyState";
import { Select } from "~/shared/ui/Select";
import { Skeleton } from "~/shared/ui/Skeleton";
import { Textarea } from "~/shared/ui/Field";
import { toast } from "~/shared/ui/toast-store";

const TARGETS = ["viewed", "invited", "interview", "hired", "rejected"] as const;

export default function EmployerApplicationPage() {
  return <EmployerOnly><Detail /></EmployerOnly>;
}

function Detail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const key = ["application", id];
  const q = useQuery({ queryKey: key, queryFn: () => authed<EmployerApplication>(() => api.GET("/applications/{application}", { params: { path: { application: id! } } })) });
  const resume = useQuery({
    queryKey: ["resume", q.data?.resume_id],
    enabled: Boolean(q.data?.resume_id),
    queryFn: () => authed<Schemas["ResumeDetail"]>(() => api.GET("/resumes/{resume}", { params: { path: { resume: q.data!.resume_id! } } })),
  });
  const chat = useOpenChat();
  const status = useMutation({
    mutationFn: (s: (typeof TARGETS)[number]) => authed<EmployerApplication>(() => api.PUT("/applications/{application}/status", { params: { path: { application: id! } }, body: { status: s } })),
    onSuccess: (a) => {
      qc.setQueryData(key, a);
      void qc.invalidateQueries({ queryKey: ["applications", a.vacancy_id] });
      void qc.invalidateQueries({ queryKey: ["application-stats", a.vacancy_id] });
    },
    onError: (e) => toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network") }),
  });

  if (q.error) return <EmptyState title={t("apiErrors.application_not_found")} />;
  if (!q.data) return <Skeleton className="h-96 rounded-sheet" />;
  const a = q.data;

  return (
    <>
      <LocalizedLink to={`/employer/vacancies/${a.vacancy_id}/applications`} className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" />{a.vacancy?.title ?? t("employer.applications")}
      </LocalizedLink>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 xl:order-2">
          <div className="flex flex-col gap-4 xl:sticky xl:top-24">
            <section className="rounded-panel border border-line bg-surface p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-ink">{t("employer.stage")}</h2>
                <StatusBadge status={a.status ?? "sent"} />
              </div>
              {a.status !== "withdrawn" ? (
                <Select className="mt-3" aria-label={t("employer.moveTo")} value={TARGETS.includes(a.status as never) ? a.status : ""} placeholder={t("employer.moveTo")}
                  disabled={status.isPending} onValueChange={(v) => v && status.mutate(v as (typeof TARGETS)[number])}
                  options={TARGETS.map((s) => ({ value: s, label: t(`enums.application_status.${s}`) }))} />
              ) : <p className="mt-2 text-sm text-ink-3">{t("employer.withdrawnNote")}</p>}
              <Button className="mt-3 w-full" variant="secondary" icon={<MessageSquare className="size-4.5" />} loading={chat.isPending} onClick={() => chat.mutate(a.id!)}>
                {t("employer.message")}
              </Button>
            </section>
            <Note a={a} />
            <section className="rounded-panel border border-line bg-surface p-5">
              <h2 className="mb-3 font-semibold text-ink">{t("applications.history")}</h2>
              <ol className="flex flex-col gap-3">
                {[...(a.events ?? [])].reverse().map((e, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-ink">{t(`enums.application_status.${e.to}`)}</span>
                    <span className="ml-2 text-xs text-ink-3">{relativeTime(e.at ?? "", t)}</span>
                    {e.note && <p className="mt-1 whitespace-pre-line text-ink-2">{e.note}</p>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
        <div className="min-w-0 xl:order-1">
          {a.cover_letter && (
            <section className="mb-4 rounded-panel border border-line bg-surface p-5">
              <h2 className="mb-2 font-semibold text-ink">{t("apply.coverLetter")}</h2>
              <p className="whitespace-pre-line leading-relaxed text-ink-2">{a.cover_letter}</p>
            </section>
          )}
          {resume.data ? <ResumeView r={resume.data} embedded /> : resume.error ? <EmptyState title={t("apiErrors.resume_not_found")} /> : <Skeleton className="h-96 rounded-sheet" />}
        </div>
      </div>
    </>
  );
}

function Note({ a }: { a: EmployerApplication }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [note, setNote] = useState(a.employer_note ?? "");
  const save = useMutation({
    mutationFn: () => authed<EmployerApplication>(() => api.PUT("/applications/{application}/note", { params: { path: { application: a.id! } }, body: { note } })),
    onSuccess: (r) => { qc.setQueryData(["application", a.id], r); toast({ tone: "success", title: t("common.saved") }); },
  });
  const dirty = note !== (a.employer_note ?? "");
  return (
    <section className="rounded-panel border border-line bg-surface p-5">
      <h2 className="font-semibold text-ink">{t("employer.note")}</h2>
      <p className="mb-3 mt-0.5 text-xs text-ink-3">{t("employer.noteHint")}</p>
      <Textarea rows={3} maxLength={5000} value={note} onChange={(e) => setNote(e.target.value)} aria-label={t("employer.note")} />
      {dirty && <Button size="sm" className="mt-2" loading={save.isPending} onClick={() => save.mutate()}>{t("common.save")}</Button>}
    </section>
  );
}
