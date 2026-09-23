import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare, Undo2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";

import { SeekerOnly } from "./layout";
import { useOpenChat } from "~/shared/chat/useOpenChat";
import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { FINAL, StatusBadge, type AppStatus } from "~/shared/application/status";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { relativeTime, salary } from "~/shared/lib/format";
import { ApiFailure, authed } from "~/shared/query/query";
import { Avatar } from "~/shared/ui/Avatar";
import { Button } from "~/shared/ui/Button";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { EmptyState } from "~/shared/ui/EmptyState";
import { Skeleton } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";

type App = Schemas["Application"];

export default function ApplicationPage() {
  return <SeekerOnly><Detail /></SeekerOnly>;
}

function Detail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const locale = useLocale();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({
    queryKey: ["application", id],
    queryFn: () => authed<App>(() => api.GET("/applications/{application}", { params: { path: { application: id! } } })),
  });
  const chat = useOpenChat();
  const withdraw = useMutation({
    mutationFn: () => authed<App>(() => api.POST("/applications/{application}/withdraw", { params: { path: { application: id! } } })),
    onSuccess: (a) => {
      qc.setQueryData(["application", id], a);
      void qc.invalidateQueries({ queryKey: ["my-applications"] });
      setConfirm(false);
    },
    onError: (e) => toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network") }),
  });

  if (q.error) return <EmptyState title={t("apiErrors.application_not_found")} />;
  if (!q.data) return <Skeleton className="h-96 rounded-sheet" />;
  const a = q.data;
  const v = a.vacancy!;
  const events = [...(a.events ?? [])].reverse();

  return (
    <>
      <LocalizedLink to="/me/applications" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" />{t("nav.applications")}
      </LocalizedLink>
      <div className="mt-4 rounded-sheet border border-line bg-surface p-5 md:p-7">
        <div className="flex items-start gap-4">
          <Avatar name={v.company.name} src={v.company.logo_url} square size="lg" />
          <div className="min-w-0 flex-1">
            <LocalizedLink to={`/vacancies/${v.slug}`} className="font-display text-xl font-semibold tracking-[-0.02em] text-ink hover:text-lapis-ink">{v.title}</LocalizedLink>
            <p className="mt-1 text-ink-2">{v.company.name}</p>
            <p className="num mt-1 text-sm font-medium text-firuza-ink">{salary(v.salary, t, locale)}</p>
          </div>
          <StatusBadge status={a.status ?? "sent"} className="h-7 px-2.5 text-sm" />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button icon={<MessageSquare className="size-4.5" />} loading={chat.isPending} onClick={() => chat.mutate(a.id!)}>{t("applications.openChat")}</Button>
          {!FINAL.includes(a.status as AppStatus) && (
            <Button variant="ghost" icon={<Undo2 className="size-4.5" />} onClick={() => setConfirm(true)}>{t("applications.withdraw")}</Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-panel border border-line bg-surface p-5">
          <h2 className="mb-4 font-semibold text-ink">{t("applications.history")}</h2>
          <ol className="relative flex flex-col gap-5 border-l border-line pl-5">
            {events.map((e, i) => (
              <li key={i} className="relative">
                <span className={`absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full ring-4 ring-surface ${i === 0 ? "bg-lapis" : "bg-line-strong"}`} aria-hidden="true" />
                <p className="text-sm font-medium text-ink">{t(`enums.application_status.${e.to}`)}</p>
                <p className="text-xs text-ink-3">{relativeTime(e.at ?? "", t)}</p>
                {e.note && <p className="mt-2 whitespace-pre-line rounded-control bg-sunken px-3 py-2 text-sm text-ink-2">{e.note}</p>}
              </li>
            ))}
          </ol>
        </section>
        <section className="rounded-panel border border-line bg-surface p-5">
          <h2 className="mb-3 font-semibold text-ink">{t("apply.coverLetter")}</h2>
          {a.cover_letter ? <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{a.cover_letter}</p> : <p className="text-sm text-ink-3">{t("applications.noLetter")}</p>}
          <LocalizedLink to={`/resumes/${a.resume_id}`} className="mt-4 inline-block text-sm font-medium text-lapis-ink hover:underline">{t("applications.viewResume")}</LocalizedLink>
        </section>
      </div>

      <DialogRoot open={confirm} onOpenChange={setConfirm}>
        <DialogContent
          title={t("applications.withdrawTitle")}
          description={t("applications.withdrawBody")}
          closeLabel={t("common.close")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>{t("common.cancel")}</Button>
              <Button variant="danger" loading={withdraw.isPending} onClick={() => withdraw.mutate()}>{t("applications.withdraw")}</Button>
            </>
          }
        />
      </DialogRoot>
    </>
  );
}
