import { useState } from "react";
import { useNavigate } from "react-router";

import { AuthCard } from "./AuthCard";
import { api } from "~/shared/api/client";
import { CodeInput } from "~/shared/forms/CodeInput";
import { FormError } from "~/shared/forms/FormError";
import { PasswordInput } from "~/shared/forms/PasswordInput";
import { useSubmit } from "~/shared/forms/useSubmit";
import { localizedPath } from "~/shared/i18n/config";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";
import { Field, Input } from "~/shared/ui/Field";
import { toast } from "~/shared/ui/toast-store";

export function meta() {
  return [{ title: "Password · Job Vacancy" }, { name: "robots", content: "noindex" }];
}

export default function ForgotPassword() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const { pending, error, fields, run } = useSubmit();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  if (step === "email") {
    return (
      <AuthCard title={t("auth.forgotTitle")} subtitle={t("auth.forgotBody")}
        footer={<LocalizedLink to="/login" className="font-medium text-lapis-ink hover:underline">{t("common.back")}</LocalizedLink>}>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault();
          void run(() => api.POST("/auth/password/forgot", { body: { email } }), () => setStep("reset"));
        }}>
          <FormError>{error}</FormError>
          <Field label={t("form.email")} error={fields.email}>
            <Input type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" loading={pending}>{t("auth.sendCode")}</Button>
        </form>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={t("auth.resetTitle")} subtitle={t("auth.resetBody", { email })}>
      <form className="flex flex-col gap-4" onSubmit={(e) => {
        e.preventDefault();
        void run(() => api.POST("/auth/password/reset", { body: { email, code, password } }), () => {
          toast({ tone: "success", title: t("auth.resetDone") });
          navigate(localizedPath(locale, "/login"), { replace: true });
        });
      }}>
        <FormError>{error}</FormError>
        <CodeInput value={code} onChange={setCode} label={t("auth.code")} />
        <Field label={t("auth.newPassword")} hint={t("auth.passwordHint")} error={fields.password}>
          <PasswordInput autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" loading={pending} disabled={code.length !== 6}>{t("auth.resetSubmit")}</Button>
      </form>
    </AuthCard>
  );
}
