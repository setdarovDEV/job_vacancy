import { useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { useState } from "react";

import { api, type Schemas } from "~/shared/api/client";
import { withAuth } from "~/shared/auth/session";
import { FormError } from "~/shared/forms/FormError";
import { useSubmit } from "~/shared/forms/useSubmit";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { authed, authedPage } from "~/shared/query/query";
import { Button } from "~/shared/ui/Button";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { Field, Textarea } from "~/shared/ui/Field";
import { Select } from "~/shared/ui/Select";
import { Spinner } from "~/shared/ui/Spinner";

/** Invite a candidate to one of the company's published vacancies. */
export default function InviteDialog({
  open, onOpenChange, resumeId, name,
}: { open: boolean; onOpenChange: (o: boolean) => void; resumeId: string; name: string }) {
  const { t } = useTranslation();
  const companies = useQuery({ queryKey: ["my-companies"], queryFn: () => authed<Schemas["Company"][]>(() => api.GET("/me/companies")) });
  const cid = companies.data?.[0]?.id;
  const vacancies = useQuery({
    queryKey: ["company-vacancies", cid, "published"],
    enabled: Boolean(cid),
    queryFn: () => authedPage<Schemas["VacancyCard"]>(() =>
      api.GET("/companies/{company}/vacancies", { params: { path: { company: cid! }, query: { status: "published", limit: 50 } } })),
  });
  const [vacancyId, setVacancyId] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const { pending, error, run } = useSubmit();
  const list = vacancies.data?.data ?? [];
  const chosen = vacancyId || list[0]?.id || "";

  let body: React.ReactNode;
  if (companies.isPending || (cid && vacancies.isPending)) body = <div className="grid h-28 place-items-center text-ink-3"><Spinner /></div>;
  else if (!cid) body = <Empty text={t("employer.noCompany")} to="/employer/company" cta={t("employer.createCompany")} />;
  else if (list.length === 0) body = <Empty text={t("candidates.noPublished")} to="/employer/vacancies/new" cta={t("nav.postVacancy")} />;
  else if (done)
    body = (
      <div className="flex flex-col items-center py-4 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-firuza-soft text-firuza-ink"><CircleCheck className="size-7" /></span>
        <p className="mt-4 font-display text-lg font-semibold text-ink">{t("candidates.invited")}</p>
        <p className="mt-1.5 text-sm text-ink-2">{t("candidates.invitedBody")}</p>
      </div>
    );
  else
    body = (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            () => withAuth(() => api.POST("/resumes/{resume}/invite", { params: { path: { resume: resumeId } }, body: { vacancy_id: chosen, message: message.trim() || undefined } })),
            () => setDone(true),
          );
        }}
      >
        <FormError>{error}</FormError>
        <Field label={t("candidates.vacancy")}>
          <Select value={chosen} onValueChange={setVacancyId} options={list.map((v) => ({ value: v.id, label: v.title }))} />
        </Field>
        <Field label={t("candidates.message")} optional={t("common.optional")} hint={t("candidates.messageHint")}>
          <Textarea rows={4} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button type="submit" loading={pending}>{t("candidates.sendInvite")}</Button>
        </div>
      </form>
    );

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("candidates.inviteTitle", { name })} closeLabel={t("common.close")}>{body}</DialogContent>
    </DialogRoot>
  );
}

function Empty({ text, to, cta }: { text: string; to: string; cta: string }) {
  return (
    <div className="flex flex-col items-start gap-4 py-2">
      <p className="text-ink-2">{text}</p>
      <Button asChild><LocalizedLink to={to}>{cta}</LocalizedLink></Button>
    </div>
  );
}
