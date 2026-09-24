import { useState } from "react";
import { useNavigate } from "react-router";

import type { Route } from "./+types/login";
import { AuthCard, authLink } from "./AuthCard";
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
import { metaT } from "~/shared/seo/meta";
import { seo } from "~/shared/seo/seo";
import { Button } from "~/shared/ui/Button";
import { Field, Input } from "~/shared/ui/Field";
import { toast } from "~/shared/ui/toast-store";

export function meta({ matches, location }: Route.MetaArgs) {
  const { t } = metaT(matches);
  return seo({ title: `${t("auth.loginTitle")} | ${t("brand.name")}`, path: location.pathname, noindex: true });
}

export default function Login() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const next = useNext();
  const { pending, error, fields, run, setError } = useSubmit();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Wrong credentials: mark the password so useSubmit puts focus (and the caret) back there.
  const [badCreds, setBadCreds] = useState(false);

  const done = (name?: string) => {
    if (name) toast({ tone: "success", title: t("auth.welcome", { name }) });
    navigate(next ?? localizedPath(locale, "/"), { replace: true });
  };

  return (
    <AuthCard
      title={t("auth.loginTitle")}
      subtitle={t("auth.loginSubtitle")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <LocalizedLink to={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} viewTransition prefetch="intent" className={authLink}>
            {t("nav.signUp")}
          </LocalizedLink>
        </>
      }
    >
      <GoogleButton onDone={() => done()} onError={setError} />
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
            (e) => setBadCreds(e.code === "invalid_credentials"),
          );
        }}
      >
        <FormError>{error}</FormError>
        <Field label={t("form.email")} error={fields.email}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="flex flex-col">
          <Field label={t("form.password")} error={fields.password}>
            <PasswordInput
              autoComplete="current-password"
              enterKeyHint="go"
              required
              value={password}
              aria-invalid={badCreds || undefined}
              onChange={(e) => {
                setPassword(e.target.value);
                setBadCreds(false);
              }}
            />
          </Field>
          {/* 44px tall for touch, pulled up so the row reads as part of the password field. */}
          <LocalizedLink
            to="/forgot-password"
            viewTransition
            className="-mb-2 -mr-1 inline-flex min-h-11 items-center self-end rounded-control px-1 text-sm font-medium text-lapis-ink hover:underline"
          >
            {t("auth.forgot")}
          </LocalizedLink>
        </div>
        <Button type="submit" size="lg" loading={pending} className="w-full">{t("auth.submitLogin")}</Button>
      </form>
    </AuthCard>
  );
}
