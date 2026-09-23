import { useState } from "react";

import { api } from "~/shared/api/client";
import { withAuth } from "~/shared/auth/session";
import { FormError } from "~/shared/forms/FormError";
import { useSubmit } from "~/shared/forms/useSubmit";
import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { Field, Input } from "~/shared/ui/Field";
import { toast } from "~/shared/ui/toast-store";
import { Switch } from "~/shared/ui/Toggle";
import { canonicalSearch } from "./params";

export default function SaveSearchDialog({
  open, onOpenChange, query, defaultName,
}: { open: boolean; onOpenChange: (o: boolean) => void; query: Record<string, string>; defaultName: string }) {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName.slice(0, 100));
  const [notify, setNotify] = useState(true);
  const { pending, error, fields, run } = useSubmit();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(
      () => withAuth(() => api.POST("/me/saved-searches", { body: { name, params: canonicalSearch(query, ["sort"]), notify } })),
      () => {
        onOpenChange(false);
        toast({ tone: "success", title: t("jobs.searchSaved") });
      },
    );
  };

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("jobs.saveSearch")} description={t("jobs.saveSearchHint")} closeLabel={t("common.close")}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FormError>{error}</FormError>
          <Field label={t("jobs.searchName")} error={fields.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoFocus />
          </Field>
          <Switch checked={notify} onCheckedChange={setNotify} label={t("jobs.notifyMe")} description={t("jobs.notifyMeHint")} />
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={pending}>{t("common.save")}</Button>
          </div>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
