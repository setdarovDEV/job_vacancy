import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { AuthCard } from "./AuthCard";
import { useNext } from "./layout";
import { api, apiError, dataOf } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { updateUser, useSession, withAuth, type User } from "~/shared/auth/session";
import { CodeInput } from "~/shared/forms/CodeInput";
import { FormError } from "~/shared/forms/FormError";
import { useSubmit } from "~/shared/forms/useSubmit";
import { localizedPath } from "~/shared/i18n/config";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";
import { toast } from "~/shared/ui/toast-store";

export function meta() {
  return [{ title: "Email · Job Vacancy" }, { name: "robots", content: "noindex" }];
}

export default function VerifyEmail() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const next = useNext();
  const [params] = useSearchParams();
  const { user } = useSession();
  const email = params.get("email") ?? user?.email ?? "";
  const { pending, error, run, setError } = useSubmit();
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(60); // a code was just sent at sign-up

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const goOn = () => navigate(next ?? localizedPath(locale, "/"), { replace: true });

  const submit = (value: string) =>
    run(
      () => withAuth(() => api.POST("/auth/email/verify", { body: { code: value } })),
      (res) => {
        const u = dataOf<User>(res);
        if (u) updateUser(u);
        toast({ tone: "success", title: t("auth.verified") });
        goOn();
      },
      (e) => {
        if (e.code === "already_verified") { goOn(); return true; }
        setCode("");
      },
    );

  const resend = async () => {
    const res = await withAuth(() => api.POST("/auth/email/send-code"));
    const e = res.response.ok ? null : apiError(res);
    if (e) setError(errorText(t, e));
    else toast({ tone: "success", title: t("auth.codeSent") });
    setCooldown(e?.retry_after ?? 60);
  };

  return (
    <AuthCard title={t("auth.verifyTitle")} subtitle={t("auth.verifyBody", { email })}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void submit(code); }}>
        <FormError>{error}</FormError>
        <CodeInput value={code} onChange={setCode} onComplete={(v) => void submit(v)} label={t("auth.code")} />
        <Button type="submit" size="lg" loading={pending} disabled={code.length !== 6}>{t("auth.verifySubmit")}</Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={resend} disabled={cooldown > 0} className="text-lapis-ink hover:underline disabled:text-ink-3 disabled:no-underline">
            {cooldown > 0 ? t("auth.resendIn", { s: cooldown }) : t("auth.resend")}
          </button>
          <button type="button" onClick={goOn} className="text-ink-2 hover:text-ink">{t("auth.later")}</button>
        </div>
      </form>
    </AuthCard>
  );
}
