import { BriefcaseBusiness, UserRound } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import type { Route } from "./+types/register";
import { AuthCard, authLink, rich } from "./AuthCard";
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
import { SelectableCard, SelectableCardGroup } from "~/shared/ui/SelectableCard";

export function meta({ matches, location }: Route.MetaArgs) {
  const { t } = metaT(matches);
  return seo({ title: `${t("auth.registerTitle")} | ${t("brand.name")}`, description: t("authPage.metaRegister"), path: location.pathname });
}

type Role = "seeker" | "employer";

export default function Register() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const next = useNext();
  const { pending, error, fields, run, setError } = useSubmit();
  const [params] = useSearchParams();
  const [role, setRole] = useState<Role>(params.get("role") === "employer" ? "employer" : "seeker");
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  // "Email taken" arrives as a form-level error: also mark the email field, so focus lands there.
  const [taken, setTaken] = useState(false);
  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (k === "email") setTaken(false);
  };

  const afterSignup = (email: string) => {
    const q = new URLSearchParams({ email });
    if (next) q.set("next", next);
    else if (role === "employer") q.set("next", localizedPath(locale, "/employer"));
    navigate(`${localizedPath(locale, "/verify-email")}?${q}`, { replace: true });
  };

  const onGoogle = useCallback(
    (isNew: boolean) => (isNew && role === "employer" ? navigate(localizedPath(locale, "/employer")) : navigate(next ?? localizedPath(locale, "/"))),
    [role, locale, next, navigate],
  );

  return (
    <AuthCard
      title={t("auth.registerTitle")}
      subtitle={t("auth.registerSubtitle")}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <LocalizedLink to={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} viewTransition prefetch="intent" className={authLink}>
            {t("nav.signIn")}
          </LocalizedLink>
        </>
      }
    >
      {/* The role comes first: Google sign-up needs it too. */}
      <div className="mb-6">
        {/* Visible question; the radiogroup carries the same text as its accessible name. */}
        <p aria-hidden="true" className="mb-2 text-sm font-medium text-ink">{t("auth.roleQuestion")}</p>
        <SelectableCardGroup value={role} onValueChange={(v) => setRole(v as Role)} label={t("auth.roleQuestion")}>
          <SelectableCard value="seeker" icon={<UserRound />} title={t("auth.roleSeeker")} description={t("auth.roleSeekerHint")} />
          <SelectableCard value="employer" icon={<BriefcaseBusiness />} title={t("auth.roleEmployer")} description={t("auth.roleEmployerHint")} />
        </SelectableCardGroup>
      </div>
      <GoogleButton role={role} onDone={onGoogle} onError={setError} />
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            () => api.POST("/auth/register", { body: { ...form, role, locale } }),
            (res) => {
              signedIn(res.data!.data as never);
              afterSignup(form.email);
            },
            (e) => setTaken(e.code === "email_taken"),
          );
        }}
      >
        <FormError>{error}</FormError>
        <Field label={t("auth.fullName")} error={fields.full_name}>
          <Input autoComplete="name" autoCapitalize="words" enterKeyHint="next" required value={form.full_name} onChange={upd("full_name")} />
        </Field>
        <Field label={t("form.email")} error={fields.email}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            required
            value={form.email}
            aria-invalid={taken || undefined}
            onChange={upd("email")}
          />
        </Field>
        <Field label={t("form.password")} hint={t("auth.passwordHint")} error={fields.password}>
          <PasswordInput strength autoComplete="new-password" enterKeyHint="go" required minLength={8} value={form.password} onChange={upd("password")} />
        </Field>
        <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">{t("auth.submitRegister")}</Button>
        <p className="text-center text-sm text-ink-2">
          {rich(t("authPage.consent"), {
            terms: (s) => <LocalizedLink to="/terms" className={authLink}>{s}</LocalizedLink>,
            privacy: (s) => <LocalizedLink to="/privacy" className={authLink}>{s}</LocalizedLink>,
          })}
        </p>
      </form>
    </AuthCard>
  );
}
