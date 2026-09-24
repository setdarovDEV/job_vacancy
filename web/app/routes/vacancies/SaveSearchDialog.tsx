import { BellRing } from "lucide-react";
import { useId, useState } from "react";
import { useNavigate } from "react-router";

import { api } from "~/shared/api/client";
import { withAuth } from "~/shared/auth/session";
import { FormError } from "~/shared/forms/FormError";
import { useSubmit } from "~/shared/forms/useSubmit";
import { localizedPath } from "~/shared/i18n/config";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { Field, Input } from "~/shared/ui/Field";
import { toast } from "~/shared/ui/toast-store";
import { Switch } from "~/shared/ui/Toggle";
import { canonicalSearch } from "./params";

export default function SaveSearchDialog({
  open, onOpenChange, query, defaultName, summary = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  query: Record<string, string>;
  defaultName: string;
  /** Human labels of what is being saved (query words and filters), shown as badges. */
  summary?: string[];
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const formId = useId();
  const [name, setName] = useState(defaultName.slice(0, 100));
  const [notify, setNotify] = useState(true);
  const { pending, error, fields, run } = useSubmit();
  // Each opening proposes the name of the search currently on screen.
  const [shownFor, setShownFor] = useState(defaultName);
  if (open && shownFor !== defaultName) {
    setShownFor(defaultName);
    setName(defaultName.slice(0, 100));
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(
      () => withAuth(() => api.POST("/me/saved-searches", { body: { name, params: canonicalSearch(query, ["sort"]), notify } })),
      () => {
        onOpenChange(false);
        toast({
          tone: "success",
          title: t("jobs.searchSaved"),
          action: { label: t("vacanciesPage.viewSearches"), onClick: () => navigate(localizedPath(locale, "/me/searches")) },
        });
      },
    );
  };

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t("jobs.saveSearch")}
        description={t("jobs.saveSearchHint")}
        closeLabel={t("common.close")}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" form={formId} loading={pending} icon={<BellRing className="size-4.5" />}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
          <FormError>{error}</FormError>
          <Field label={t("jobs.searchName")} error={fields.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          </Field>
          <div>
            <p className="text-sm font-medium text-ink">{t("vacanciesPage.saveSummary")}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {(summary.length ? summary : [t("vacanciesPage.allVacancies")]).map((s) => (
                <li key={s} className="flex max-w-full"><Badge tone="lapis">{s}</Badge></li>
              ))}
            </ul>
          </div>
          <Switch checked={notify} onCheckedChange={setNotify} label={t("jobs.notifyMe")} description={t("jobs.notifyMeHint")} />
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
