import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, FileText, PencilLine, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { SeekerOnly } from "./layout";
import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { downloadAuthed } from "~/shared/lib/download";
import { experienceText, relativeTime } from "~/shared/lib/format";
import { ApiFailure, authed } from "~/shared/query/query";
import { Button } from "~/shared/ui/Button";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { EmptyState } from "~/shared/ui/EmptyState";
import { PageHeader } from "~/shared/ui/Section";
import { Select } from "~/shared/ui/Select";
import { Skeleton } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";

type Resume = Schemas["ResumeCard"];
export const MAX_RESUMES = 5;

export default function Resumes() {
  return <SeekerOnly><ResumeList /></SeekerOnly>;
}

function ResumeList() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["my-resumes"], queryFn: () => authed<Resume[]>(() => api.GET("/me/resumes")) });
  const list = q.data ?? [];
  const create = (
    <Button asChild icon={<Plus className="size-4.5" />} aria-disabled={list.length >= MAX_RESUMES || undefined}>
      <LocalizedLink to="/me/resumes/new">{t("resume.new")}</LocalizedLink>
    </Button>
  );
  return (
    <>
      <PageHeader title={t("account.myResumes")} description={t("resume.listHint")} actions={list.length > 0 && create} />
      {!q.data ? (
        <div className="flex flex-col gap-3"><Skeleton className="h-36 rounded-panel" /><Skeleton className="h-36 rounded-panel" /></div>
      ) : list.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface">
          <EmptyState icon={<FileText className="size-6" />} title={t("resume.emptyTitle")} body={t("resume.emptyBody")} action={create} />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((r) => <ResumeItem key={r.id} r={r} />)}
        </ul>
      )}
    </>
  );
}

function ResumeItem({ r }: { r: Resume }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [pdf, setPdf] = useState(false);
  const visibility = useMutation({
    mutationFn: (v: Schemas["ResumeVisibility"]) =>
      authed(() => api.PUT("/resumes/{resume}/visibility", { params: { path: { resume: r.id } }, body: { visibility: v } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-resumes"] });
      toast({ tone: "success", title: t("common.saved") });
    },
  });
  const remove = useMutation({
    mutationFn: () => authed(() => api.DELETE("/resumes/{resume}", { params: { path: { resume: r.id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-resumes"] }),
    onError: (e) => toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network") }),
    onSettled: () => setConfirm(false),
  });

  const download = async () => {
    setPdf(true);
    try {
      await downloadAuthed(`/resumes/${r.id}/pdf?lang=${locale}`, `${r.title}.pdf`);
    } catch {
      toast({ tone: "error", title: t("errors.internal_error") });
    } finally {
      setPdf(false);
    }
  };

  return (
    <li className="rounded-panel border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <LocalizedLink to={`/resumes/${r.id}`} className="font-display text-lg font-semibold tracking-[-0.01em] text-ink hover:text-lapis-ink">{r.title}</LocalizedLink>
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-ink-2">
            {r.last_job && <span>{r.last_job.position}, {r.last_job.company}</span>}
            <span className="text-ink-3">{t("resume.experienceTotal", { value: experienceText(r.experience_months, t) })}</span>
          </p>
          <p className="mt-1 text-xs text-ink-3">{t("resume.updated", { when: relativeTime(r.updated_at, t) })}</p>
        </div>
        <Select
          aria-label={t("resume.visibility")}
          size="sm"
          className="w-56"
          value={r.visibility ?? "public"}
          disabled={visibility.isPending}
          onValueChange={(v) => visibility.mutate(v as Schemas["ResumeVisibility"])}
          options={(["public", "applied_only", "hidden"] as const).map((v) => ({ value: v, label: t(`resume.vis.${v}`) }))}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
        <Button asChild variant="ghost" size="sm" icon={<Eye className="size-4" />}><LocalizedLink to={`/resumes/${r.id}`}>{t("common.open")}</LocalizedLink></Button>
        <Button asChild variant="ghost" size="sm" icon={<PencilLine className="size-4" />}><LocalizedLink to={`/me/resumes/${r.id}/edit`}>{t("common.edit")}</LocalizedLink></Button>
        <Button variant="ghost" size="sm" icon={<Download className="size-4" />} loading={pdf} onClick={download}>PDF</Button>
        <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} className="ml-auto text-anor-ink hover:text-anor-ink" onClick={() => setConfirm(true)}>{t("common.delete")}</Button>
      </div>
      <DialogRoot open={confirm} onOpenChange={setConfirm}>
        <DialogContent
          title={t("resume.deleteTitle")}
          description={t("resume.deleteBody", { title: r.title })}
          closeLabel={t("common.close")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>{t("common.cancel")}</Button>
              <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>{t("common.delete")}</Button>
            </>
          }
        />
      </DialogRoot>
    </li>
  );
}
