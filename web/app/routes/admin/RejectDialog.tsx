import { useId, useRef, useState, type KeyboardEvent } from "react";

import type { QueueVacancy } from "./useModeration";
import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";
import { Chip } from "~/shared/ui/Chip";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { Field, Textarea } from "~/shared/ui/Field";

// Same limits as POST /admin/vacancies/{id}/reject (the server trims before counting).
const MIN = 5;
const MAX = 1000;
const PRESETS = ["thin", "contacts", "discrimination", "duplicate"] as const;

/**
 * Asks for the reason the employer will read. Submitting hands the text to the page, which closes
 * the dialog and removes the row at once (optimistic); a failed request offers Retry with the
 * same text, so nothing typed here is ever lost.
 */
export default function RejectDialog({ vacancy, open, onOpenChange, onSubmit }: {
  vacancy: QueueVacancy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e?: { preventDefault(): void }) => {
    e?.preventDefault();
    const text = reason.trim();
    if ([...text].length < MIN) {
      setError(t("adminPage.reasonShort"));
      field.current?.focus();
      return;
    }
    onSubmit(text);
  };

  // A ready-made reason fills an empty field or starts a new paragraph after what's typed.
  const addPreset = (text: string) => {
    setReason((r) => (r.trim() ? `${r.trimEnd()}\n${text}` : text).slice(0, MAX));
    setError(null);
    field.current?.focus();
  };

  // Initial focus is the dialog's default: the text field with a mouse, the panel on touch (the
  // keyboard would cover the ready-made reasons).

  // Ctrl/⌘+Enter sends from the text field (Enter alone starts a new line).
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(e);
  };

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t("adminPage.rejectTitle")}
        description={`«${vacancy.title}» · ${vacancy.company.name}`}
        closeLabel={t("common.close")}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" form={formId} variant="danger">{t("adminPage.reject")}</Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} noValidate>
          <Field label={t("adminPage.reason")} hint={t("adminPage.reasonHint")} error={error}>
            <Textarea
              ref={field}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error && [...e.target.value.trim()].length >= MIN) setError(null);
              }}
              onKeyDown={onKeyDown}
              maxLength={MAX}
              rows={4}
              required
              enterKeyHint="enter"
            />
          </Field>
          <fieldset className="mt-4 min-w-0">
            <legend className="mb-2 text-sm font-medium text-ink-2">{t("adminPage.presetsLabel")}</legend>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((id) => (
                <Chip key={id} onClick={() => addPreset(t(`adminPage.presets.${id}.text`))} className="max-w-full">
                  <span className="truncate">{t(`adminPage.presets.${id}.label`)}</span>
                </Chip>
              ))}
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
