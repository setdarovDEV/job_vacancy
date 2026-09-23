import { BriefcaseBusiness, UserRound } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import type { Route } from "./+types/register";
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
import { cn } from "~/shared/lib/cn";
import { Button } from "~/shared/ui/Button";
import { Field, Input } from "~/shared/ui/Field";

export function meta({ matches }: Route.MetaArgs) {
  const m = (matches[0]?.loaderData as { messages?: Messages } | undefined)?.messages;
  return [{ title: `${m?.auth.registerTitle ?? "Sign up"} · Job Vacancy` }];
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
  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const afterSignup = (email: string) => {
    const q = new URLSearchParams({ email });
    if (next) q.set("next", next);
    else if (role === "employer") q.set("next", localizedPath(locale, "/employer"));
    navigate(`${localizedPath(locale, "/verify-email")}?${q}`, { replace: true });
  };

  const roles: { value: Role; icon: typeof UserRound; label: string; hint: string }[] = [
    { value: "seeker", icon: UserRound, label: t("auth.roleSeeker"), hint: t("auth.roleSeekerHint") },
    { value: "employer", icon: BriefcaseBusiness, label: t("auth.roleEmployer"), hint: t("auth.roleEmployerHint") },
  ];

  return (
    <AuthCard
      title={t("auth.registerTitle")}
      subtitle={t("auth.registerSubtitle")}
      footer={<>{t("auth.haveAccount")} <LocalizedLink to={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-lapis-ink hover:underline">{t("nav.signIn")}</LocalizedLink></>}
    >
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
          );
        }}
      >
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("auth.roleQuestion")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {roles.map((r) => (
              <label
                key={r.value}
                className={cn(
                  "flex cursor-pointer flex-col gap-2 rounded-panel border p-3.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus",
                  role === r.value ? "border-lapis bg-lapis-soft" : "border-line-strong hover:border-ink-3",
                )}
              >
                <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="sr-only" />
                <r.icon className={cn("size-5", role === r.value ? "text-lapis-ink" : "text-ink-3")} />
                <span className="text-sm font-semibold leading-tight">{r.label}</span>
                <span className="text-xs leading-snug text-ink-3">{r.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <FormError>{error}</FormError>
        <Field label={t("auth.fullName")} error={fields.full_name}>
          <Input autoComplete="name" required value={form.full_name} onChange={upd("full_name")} />
        </Field>
        <Field label={t("form.email")} error={fields.email}>
          <Input type="email" autoComplete="email" required value={form.email} onChange={upd("email")} />
        </Field>
        <Field label={t("form.password")} hint={t("auth.passwordHint")} error={fields.password}>
          <PasswordInput autoComplete="new-password" required minLength={8} value={form.password} onChange={upd("password")} />
        </Field>
        <Button type="submit" size="lg" loading={pending} className="mt-1">{t("auth.submitRegister")}</Button>
        <p className="text-center text-xs text-ink-3">{t("auth.agree")}</p>
      </form>
      <GoogleButton role={role} onDone={(isNew) => (isNew && role === "employer" ? navigate(localizedPath(locale, "/employer")) : navigate(next ?? localizedPath(locale, "/")))} onError={setError} />
    </AuthCard>
  );
}
