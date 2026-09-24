import { KeyRound, MailCheck } from "lucide-react";
import { useId, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router";

import type { Route } from "./+types/forgot-password";
import { AUTH_SUBTITLE_ID, AuthCard, authFooterLink, ResendRow, rich, useCooldown } from "./AuthCard";
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
  const codeId = useId();

  const backToLogin = (
    <LocalizedLink to="/login" viewTransition prefetch="intent" className={authFooterLink}>{t("authPage.backToLogin")}</LocalizedLink>
  );

  // The step change morphs the card like a route change does (app.css names it while a view
  // transition runs); browsers without view transitions just swap the content.
  const toStep = (next: "email" | "reset", before?: () => void) => {
    const apply = () => {
      before?.();
      setStep(next);
    };
    if (!document.startViewTransition) return apply();
    document.startViewTransition(() => flushSync(apply));
  };

  const resend = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await api.POST("/auth/password/forgot", { body: { email } });
      const e = res.response.ok ? null : apiError(res);
      if (e) setError(errorText(t, e));
      else {
        // A fresh code: the last attempt's red cells and digits no longer apply.
        setCode("");
        setCodeBad(false);
        toast({ tone: "success", title: t("auth.codeSent") });
      }
      setCooldown(e?.retry_after ?? 60);
    } catch {
      setError(t("errors.network"));
    } finally {
      setSending(false);
      // The resend button is disabled for the cooldown now: keep focus on the next step, the code.
      document.getElementById(codeId)?.focus();
    }
  };

  if (step === "email") {
    return (
      <AuthCard icon={<KeyRound className="size-6" />} title={t("auth.forgotTitle")} subtitle={t("auth.forgotBody")} footer={backToLogin}>
        {/* noValidate: the API's field errors show inline in the page's language. */}
        <form noValidate className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault();
          void run(() => api.POST("/auth/password/forgot", { body: { email } }), () =>
            toStep("reset", () => {
              setCode("");
              setCodeBad(false);
              setCooldown(60);
            }),
          );
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
      subtitle={rich(t("authPage.resetBody", { email }), { b: (s) => <b className="font-semibold text-ink">{s}</b> })}
      footer={backToLogin}
    >
      <form noValidate className="flex flex-col gap-5" onSubmit={(e) => {
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
            id={codeId}
            value={code}
            onChange={(v) => {
              setCode(v);
              setCodeBad(false);
            }}
            label={t("auth.code")}
            aria-invalid={codeBad || undefined}
            aria-describedby={AUTH_SUBTITLE_ID}
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
              onClick={() => toStep("email", () => setError(null))}
            >
              {t("authPage.changeEmail")}
            </Button>
          }
        />
      </form>
    </AuthCard>
  );
}
