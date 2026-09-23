import { CircleCheck, FileText, LogIn } from "lucide-react";
import { useEffect, useState } from "react";

import { api, dataOf, type Schemas } from "~/shared/api/client";
import { useSession, withAuth } from "~/shared/auth/session";
import { FormError } from "~/shared/forms/FormError";
import { useSubmit } from "~/shared/forms/useSubmit";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { relativeTime } from "~/shared/lib/format";
import { cn } from "~/shared/lib/cn";
import { Button } from "~/shared/ui/Button";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { Field, Textarea } from "~/shared/ui/Field";
import { Spinner } from "~/shared/ui/Spinner";

type Resume = Schemas["ResumeCard"];

export default function ApplyDialog({
  open, onOpenChange, vacancy,
}: { open: boolean; onOpenChange: (o: boolean) => void; vacancy: Schemas["VacancyDetail"] }) {
  const { t } = useTranslation();
  const { status, user } = useSession();
  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [resumeId, setResumeId] = useState("");
  const [letter, setLetter] = useState("");
  const [done, setDone] = useState<"sent" | "already" | null>(null);
  const { pending, error, fields, run } = useSubmit();

  useEffect(() => {
    if (status !== "authed" || user?.role !== "seeker") return;
    void withAuth(() => api.GET("/me/resumes")).then((res) => {
      const list = dataOf<Resume[]>(res) ?? [];
      setResumes(list);
      setResumeId(list[0]?.id ?? "");
    });
  }, [status, user?.role]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(
      () => withAuth(() => api.POST("/vacancies/{vacancy}/applications", {
        params: { path: { vacancy: vacancy.id } },
        body: { resume_id: resumeId, cover_letter: letter.trim() || undefined },
      })),
      () => setDone("sent"),
      (err) => {
        if (err.code !== "already_applied") return false;
        setDone("already");
        return true;
      },
    );
  };

  const next = typeof location === "undefined" ? "" : encodeURIComponent(location.pathname);
  let body: React.ReactNode;
  if (status === "loading") body = <Loading />;
  else if (status === "anon")
    body = (
      <Notice
        text={t("apply.signInFirst")}
        action={<Button asChild icon={<LogIn className="size-4.5" />}><LocalizedLink to={`/login?next=${next}`}>{t("nav.signIn")}</LocalizedLink></Button>}
      />
    );
  else if (user?.role !== "seeker") body = <Notice text={t("apply.employerNote")} />;
  else if (done)
    body = (
      <div className="flex flex-col items-center py-4 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-firuza-soft text-firuza-ink anim-pop" data-state="open">
          <CircleCheck className="size-7" />
        </span>
        <p className="mt-4 font-display text-lg font-semibold text-ink">{done === "sent" ? t("apply.sent") : t("apply.alreadySent")}</p>
        <p className="mt-1.5 text-sm text-ink-2">{t("apply.sentBody")}</p>
        <Button asChild variant="secondary" className="mt-6"><LocalizedLink to="/me/applications">{t("apply.openApplications")}</LocalizedLink></Button>
      </div>
    );
  else if (!resumes) body = <Loading />;
  else if (resumes.length === 0)
    body = (
      <Notice
        text={t("apply.noResume")}
        action={<Button asChild icon={<FileText className="size-4.5" />}><LocalizedLink to="/me/resumes/new">{t("apply.createResume")}</LocalizedLink></Button>}
      />
    );
  else
    body = (
      <form onSubmit={submit} className="flex flex-col gap-5">
        <FormError>{error}</FormError>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">{t("apply.chooseResume")}</legend>
          <div className="flex flex-col gap-2">
            {resumes.map((r) => (
              <label
                key={r.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-control border px-4 py-3 transition-colors",
                  resumeId === r.id ? "border-lapis bg-lapis-soft/50" : "border-line-strong hover:border-ink-3",
                )}
              >
                <input type="radio" name="resume" value={r.id} checked={resumeId === r.id} onChange={() => setResumeId(r.id)} className="size-4 accent-[var(--lapis)]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{r.title}</span>
                  <span className="block text-xs text-ink-3">{relativeTime(r.updated_at, t)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label={t("apply.coverLetter")} optional={t("common.optional")} hint={t("apply.coverHint")} error={fields.cover_letter}>
          <Textarea rows={4} maxLength={3000} value={letter} onChange={(e) => setLetter(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button type="submit" loading={pending} disabled={!resumeId}>{t("apply.submit")}</Button>
        </div>
      </form>
    );

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent title={vacancy.title} description={t("apply.subtitle", { company: vacancy.company.name })} closeLabel={t("common.close")}>
        {body}
      </DialogContent>
    </DialogRoot>
  );
}

function Loading() {
  return <div className="grid h-32 place-items-center text-ink-3"><Spinner /></div>;
}

function Notice({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 py-2">
      <p className="text-ink-2">{text}</p>
      {action}
    </div>
  );
}
