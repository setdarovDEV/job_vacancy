import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import { TwoFactorEnroll } from "./Enroll";
import { twoFactorStatusKey } from "./keys";
import { RecoveryCodes } from "./RecoveryCodes";
import { api, type Schemas } from "~/shared/api/client";
import { useSession, withAuth } from "~/shared/auth/session";
import { CodeInput } from "~/shared/forms/CodeInput";
import { FormError } from "~/shared/forms/FormError";
import { PasswordInput } from "~/shared/forms/PasswordInput";
import { useSubmit } from "~/shared/forms/useSubmit";
import { useTranslation } from "~/shared/i18n/i18n";
import { authed } from "~/shared/query/query";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { Field } from "~/shared/ui/Field";
import { Skeleton } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";

type Status = Schemas["TwoFactorStatus"];

export function useTwoFactorStatus(enabled = true) {
  return useQuery({
    queryKey: twoFactorStatusKey,
    queryFn: () => authed<Status>(() => api.GET("/me/two-factor")),
    enabled,
  });
}

type Action = "regenerate" | "disable";

/** Settings section for administrators: status, recovery codes, turn off. */
export function TwoFactorSettings() {
  const { t } = useTranslation();
  const status = useTwoFactorStatus();
  const [enrolling, setEnrolling] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  if (status.isPending) return <Skeleton className="h-24 rounded-panel" />;
  const s = status.data;
  if (codes) return <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />;
  if (!s?.enabled) {
    return enrolling
      ? <TwoFactorEnroll onDone={() => setEnrolling(false)} />
      : (
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="zafaron">{t("twoFactor.off")}</Badge>
          {s?.required && <span className="text-sm text-ink-2">{t("twoFactor.required")}</span>}
          <Button type="button" size="sm" onClick={() => setEnrolling(true)}>{t("twoFactor.start")}</Button>
        </div>
      );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="firuza"><ShieldCheck className="size-3.5" />{t("twoFactor.on")}</Badge>
        <span className="text-sm text-ink-2">{t("twoFactor.left", { n: s.recovery_codes_left })}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setAction("regenerate")}>{t("twoFactor.regenerate")}</Button>
        <Button type="button" variant="ghost" size="sm" className="text-anor-ink" onClick={() => setAction("disable")}>{t("twoFactor.disable")}</Button>
      </div>
      {action && <ReauthDialog action={action} onClose={() => setAction(null)} onCodes={setCodes} />}
    </div>
  );
}

/** Password (when the account has one) and a current code, then the action. */
function ReauthDialog({ action, onClose, onCodes }: { action: Action; onClose: () => void; onCodes: (c: string[]) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { user } = useSession();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const { pending, error, fields, run } = useSubmit();
  const body = { password, code };
  const finish = () => {
    void qc.invalidateQueries({ queryKey: twoFactorStatusKey });
    onClose();
  };
  const submit = () => {
    if (action === "regenerate") {
      void run(() => withAuth(() => api.POST("/me/two-factor/recovery-codes", { body })), (res) => {
        onCodes(res.data!.data.recovery_codes);
        finish();
      });
    } else {
      void run(() => withAuth(() => api.POST("/me/two-factor/disable", { body })), () => {
        toast({ tone: "success", title: t("twoFactor.disabled") });
        finish();
      });
    }
  };
  return (
    <DialogRoot open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={action === "regenerate" ? t("twoFactor.regenerate") : t("twoFactor.disable")}
        description={action === "disable" && user?.role === "admin" ? `${t("twoFactor.reauth")}. ${t("twoFactor.disableWarn")}` : t("twoFactor.reauth")}
        closeLabel={t("common.close")}
      >
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <FormError>{error}</FormError>
          {user?.has_password && (
            <Field label={t("form.password")} error={fields.password}>
              <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
          )}
          <CodeInput value={code} onChange={setCode} label={t("twoFactor.code")} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" variant={action === "disable" ? "danger" : "primary"} loading={pending} disabled={code.length !== 6}>
              {action === "regenerate" ? t("twoFactor.regenerate") : t("twoFactor.disable")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
