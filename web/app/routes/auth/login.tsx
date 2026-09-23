import { useState } from "react";
import { useNavigate } from "react-router";

import type { Route } from "./+types/login";
import { AuthCard } from "./AuthCard";
import { GoogleButton } from "./GoogleButton";
import { useNext } from "./layout";
import { api } from "~/shared/api/client";
import { signedIn } from "~/shared/auth/session";
import { FormError } from "~/shared/forms/FormError";
import { PasswordInput } from "~/shared/forms/PasswordInput";
import { useSubmit } from "~/shared/forms/useSubmit";
import { localizedPath } from "~/shared/i18n/config";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import type { Messages } from "~/shared/i18n/messages/uz";
import { Button } from "~/shared/ui/Button";
import { Field, Input } from "~/shared/ui/Field";
import { toast } from "~/shared/ui/toast-store";

export function meta({ matches }: Route.MetaArgs) {
  const m = (matches[0]?.loaderData as { messages?: Messages } | undefined)?.messages;
  return [{ title: `${m?.auth.loginTitle ?? "Sign in"} · Job Vacancy` }, { name: "robots", content: "noindex" }];
}

export default function Login() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const next = useNext();
  const { pending, error, fields, run, setError } = useSubmit();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const done = (name?: string) => {
    if (name) toast({ tone: "success", title: t("auth.welcome", { name }) });
    navigate(next ?? localizedPath(locale, "/"), { replace: true });
  };

  return (
    <AuthCard
      title={t("auth.loginTitle")}
      subtitle={t("auth.loginSubtitle")}
      footer={<>{t("auth.noAccount")} <LocalizedLink to={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-lapis-ink hover:underline">{t("nav.signUp")}</LocalizedLink></>}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            () => api.POST("/auth/login", { body: { email, password } }),
            (res) => {
              const d = res.data!.data as never as { user: { full_name: string } };
              signedIn(res.data!.data as never);
              done(d.user.full_name.split(" ")[0]);
            },
          );
        }}
      >
        <FormError>{error}</FormError>
        <Field label={t("form.email")} error={fields.email}>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label={t("form.password")} error={fields.password}>
          <PasswordInput autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <LocalizedLink to="/forgot-password" className="-mt-1 self-end text-sm text-lapis-ink hover:underline">{t("auth.forgot")}</LocalizedLink>
        <Button type="submit" size="lg" loading={pending} className="mt-1">{t("auth.submitLogin")}</Button>
      </form>
      <GoogleButton onDone={() => done()} onError={setError} />
    </AuthCard>
  );
}
