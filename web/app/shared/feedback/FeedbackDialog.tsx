import { CircleCheck } from "lucide-react";
import { useState } from "react";

import { api } from "~/shared/api/client";
import { useCaptcha } from "~/shared/captcha/Turnstile";
import { FormError } from "~/shared/forms/FormError";
import { useSubmit } from "~/shared/forms/useSubmit";
import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { Field, Input, Textarea } from "~/shared/ui/Field";
import { RadioGroup } from "~/shared/ui/Toggle";

const CATEGORIES = ["bug", "idea", "other"] as const;
type Category = (typeof CATEGORIES)[number];
const MAX_MESSAGE = 2000;

/** "Fikr bildirish": a message to the team, from anyone. Loaded only when opened. */
export default function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<Category>("idea");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState(false);
  const { pending, error, fields, run } = useSubmit();
  const captcha = useCaptcha();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Signed in: the shared client adds the access token, and the message is linked to the account.
    void run(
      () => api.POST("/feedback", {
        headers: captcha.take(),
        body: { category, message: message.trim(), contact: contact.trim() || undefined, page_url: location.href.slice(0, 500) },
      }),
      () => setSent(true),
    );
  };

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("feedback.title")} description={sent ? undefined : t("feedback.hint")} closeLabel={t("common.close")}>
        {sent ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-firuza-soft text-firuza-ink"><CircleCheck className="size-7" /></span>
            <p className="mt-4 font-display text-lg font-semibold text-ink">{t("feedback.sent")}</p>
            <p className="mt-1.5 text-sm text-ink-2">{t("feedback.sentBody")}</p>
            <Button variant="secondary" className="mt-6" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-5">
            <FormError>{error}</FormError>
            <fieldset>
              <legend className="mb-3 text-sm font-medium text-ink">{t("feedback.category")}</legend>
              <RadioGroup value={category} onValueChange={(v) => setCategory(v as Category)}
                options={CATEGORIES.map((c) => ({ value: c, label: t(`feedback.categories.${c}`) }))} />
            </fieldset>
            <Field label={t("feedback.message")} error={fields.message} hint={`${message.length}/${MAX_MESSAGE}`}>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={MAX_MESSAGE} minLength={5} required rows={5} />
            </Field>
            <Field label={t("feedback.contact")} hint={t("feedback.contactHint")} error={fields.contact}>
              <Input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} autoComplete="email" />
            </Field>
            {captcha.widget}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              <Button type="submit" loading={pending} disabled={message.trim().length < 5 || !captcha.ready}>{t("feedback.send")}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
