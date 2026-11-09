import { CircleCheck, Clock, LogIn } from "lucide-react";
import { useState } from "react";

import { api } from "~/shared/api/client";
import { useSession, withAuth } from "~/shared/auth/session";
import { FormError } from "~/shared/forms/FormError";
import { useSubmit } from "~/shared/forms/useSubmit";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { Field, Textarea } from "~/shared/ui/Field";
import { RadioGroup } from "~/shared/ui/Toggle";

import { REASONS, type ReportReason as Reason, type ReportTarget } from "./reasons";

const MAX_COMMENT = 1000;

/**
 * Files a report. A second open report on the same target answers 409 already_reported;
 * that's shown as "already reported" rather than as an error (there's no lookup endpoint).
 */
export default function ReportDialog({ target, open, onOpenChange }: {
  target: ReportTarget; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation();
  const { status } = useSession();
  const [reason, setReason] = useState<Reason | "">("");
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<"sent" | "already" | null>(null);
  const { pending, error, fields, run } = useSubmit();
  const needsComment = reason === "other" && !comment.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || needsComment) return;
    void run(
      () => withAuth(() => api.POST("/reports", {
        body: { target_type: target.type, target_id: target.id, reason, comment: comment.trim() || undefined },
      })),
      () => setDone("sent"),
      (err) => {
        if (err.code !== "already_reported") return false;
        setDone("already");
        return true;
      },
    );
  };

  const next = typeof location === "undefined" ? "" : encodeURIComponent(location.pathname);
  let body: React.ReactNode;
  if (status === "anon") {
    body = (
      <div className="flex flex-col items-start gap-4 py-2">
        <p className="text-ink-2">{t("report.signIn")}</p>
        <Button asChild icon={<LogIn className="size-4.5" />}><LocalizedLink to={`/login?next=${next}`}>{t("nav.signIn")}</LocalizedLink></Button>
      </div>
    );
  } else if (done) {
    const sent = done === "sent";
    body = (
      <div className="flex flex-col items-center py-4 text-center">
        <span className={sent ? "grid size-14 place-items-center rounded-full bg-firuza-soft text-firuza-ink" : "grid size-14 place-items-center rounded-full bg-zafaron-soft text-zafaron-ink"}>
          {sent ? <CircleCheck className="size-7" /> : <Clock className="size-7" />}
        </span>
        <p className="mt-4 font-display text-lg font-semibold text-ink">{sent ? t("report.sent") : t("report.already")}</p>
        <p className="mt-1.5 text-sm text-ink-2">{sent ? t("report.sentBody") : t("report.alreadyBody")}</p>
        <Button variant="secondary" className="mt-6" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
      </div>
    );
  } else {
    body = (
      <form onSubmit={submit} className="flex flex-col gap-5">
        <FormError>{error}</FormError>
        <fieldset>
          <legend className="mb-3 text-sm font-medium text-ink">{t("report.why")}</legend>
          <RadioGroup
            value={reason}
            onValueChange={(v) => setReason(v as Reason)}
            options={REASONS.map((r) => ({
              value: r,
              label: (
                <span className="block">
                  <span className="block font-medium text-ink">{t(`report.reasons.${r}`)}</span>
                  <span className="block text-xs text-ink-3">{t(`report.reasonHints.${r}`)}</span>
                </span>
              ),
            }))}
          />
        </fieldset>
        <Field
          label={t("report.comment")}
          optional={reason === "other" ? undefined : t("common.optional")}
          hint={t("report.commentHint")}
          error={fields.comment}
        >
          <Textarea rows={3} maxLength={MAX_COMMENT} value={comment} onChange={(e) => setComment(e.target.value)} required={reason === "other"} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button type="submit" loading={pending} disabled={!reason || needsComment}>{t("report.submit")}</Button>
        </div>
      </form>
    );
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("report.title")} description={t(`report.hint.${target.type}`, { name: target.name })} closeLabel={t("common.close")}>
        {body}
      </DialogContent>
    </DialogRoot>
  );
}
