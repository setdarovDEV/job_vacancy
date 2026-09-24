import { KeyRound, MailCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import type { Route } from "./+types/forgot-password";
import { AuthCard, authLink, ResendRow, rich, useCooldown } from "./AuthCard";
import { api, apiError } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { CodeInput } from "~/shared/forms/CodeInput";
import { FormError } from "~/shared/forms/FormError";
import { PasswordInput } from "~/shared/forms/PasswordInput";
import { useSubmit } from "~/shared/forms/useSubmit";
import { localizedPath } from "~/shared/i18n/config";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { metaT } from "~/shared/seo/meta";
import { seo } from "~/shared/seo/seo";
import { Button } from "~/shared/ui/Button";
import { Field, Input } from "~/shared/ui/Field";
import { toast } from "~/shared/ui/toast-store";

export function meta({ matches, location }: Route.MetaArgs) {
  const { t } = metaT(matches);
  return seo({ title: `${t("auth.forgotTitle")} | ${t("brand.name")}`, path: location.pathname, noindex: true });
}

/**
 * Two steps on one URL: email → code + new password. Success lands on the login page with a
 * toast. The reset step can resend the code (the same forgot call) or go back to fix the email.
 */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const { pending, error, fields, run, setError } = useSubmit();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  // A rejected or expired code: red cells, cleared for the next try, focus back on them.
  const [codeBad, setCodeBad] = useState(false);
  const [password, setPassword] = useState("");
  const [cooldown, setCooldown] = useCooldown(0);
  const [sending, setSending] = useState(false);

  const backToLogin = (
    <LocalizedLink to="/login" viewTransition prefetch="intent" className={authLink}>{t("authPage.backToLogin")}</LocalizedLink>
  );

  const resend = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await api.POST("/auth/password/forgot", { body: { email } });
      const e = res.response.ok ? null : apiError(res);
      if (e) setError(errorText(t, e));
      else toast({ tone: "success", title: t("auth.codeSent") });
      setCooldown(e?.retry_after ?? 60);
    } catch {
      setError(t("errors.network"));
    } finally {
      setSending(false);
    }
  };

  if (step === "email") {
    return (
      <AuthCard icon={<KeyRound className="size-6" />} title={t("auth.forgotTitle")} subtitle={t("auth.forgotBody")} footer={backToLogin}>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault();
          void run(() => api.POST("/auth/password/forgot", { body: { email } }), () => {
            setCode("");
            setCodeBad(false);
            setCooldown(60);
            setStep("reset");
          });
        }}>
          <FormError>{error}</FormError>
          <Field label={t("form.email")} error={fields.email}>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="send"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">{t("auth.sendCode")}</Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={<MailCheck className="size-6" />}
      title={t("auth.resetTitle")}
      subtitle={rich(t("authPage.resetBody", { email }), { b: (s) => <b className="break-all font-semibold text-ink">{s}</b> })}
      footer={backToLogin}
    >
      <form className="flex flex-col gap-5" onSubmit={(e) => {
        e.preventDefault();
        void run(
          () => api.POST("/auth/password/reset", { body: { email, code, password } }),
          () => {
            toast({ tone: "success", title: t("auth.resetDone") });
            navigate(localizedPath(locale, "/login"), { replace: true });
          },
          (e) => {
            if (!e.code.startsWith("code_")) return;
            setCode("");
            setCodeBad(true);
          },
        );
      }}>
        <FormError>{error}</FormError>
        <Field error={fields.code}>
          <CodeInput
            value={code}
            onChange={(v) => {
              setCode(v);
              setCodeBad(false);
            }}
            label={t("auth.code")}
            aria-invalid={codeBad || undefined}
          />
        </Field>
        <Field label={t("auth.newPassword")} hint={t("auth.passwordHint")} error={fields.password}>
          <PasswordInput strength autoComplete="new-password" enterKeyHint="go" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" loading={pending} disabled={code.length !== 6} className="w-full">{t("auth.resetSubmit")}</Button>
        <ResendRow
          cooldown={cooldown}
          sending={sending}
          onResend={() => void resend()}
          extra={
            <Button
              type="button"
              variant="ghost"
              className="px-2"
              onClick={() => {
                setError(null);
                setStep("email");
              }}
            >
              {t("authPage.changeEmail")}
            </Button>
          }
        />
      </form>
    </AuthCard>
  );
}
