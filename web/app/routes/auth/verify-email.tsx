import { MailCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import type { Route } from "./+types/verify-email";
import { AuthCard, ResendRow, rich, useCooldown } from "./AuthCard";
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
import { metaT } from "~/shared/seo/meta";
import { seo } from "~/shared/seo/seo";
import { Button } from "~/shared/ui/Button";
import { toast } from "~/shared/ui/toast-store";

export function meta({ matches, location }: Route.MetaArgs) {
  const { t } = metaT(matches);
  return seo({ title: `${t("auth.verifyTitle")} | ${t("brand.name")}`, path: location.pathname, noindex: true });
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
  // Only a rejected code turns the cells red (not a failed resend).
  const [codeBad, setCodeBad] = useState(false);
  const [cooldown, setCooldown] = useCooldown(60); // a code was just sent at sign-up
  const [sending, setSending] = useState(false);

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
        setCodeBad(true);
      },
    );

  const resend = async () => {
    setSending(true);
    try {
      const res = await withAuth(() => api.POST("/auth/email/send-code"));
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

  const body = email
    ? rich(t("authPage.verifyBody", { email }), { b: (s) => <b className="break-all font-semibold text-ink">{s}</b> })
    : t("authPage.verifyBodyNoEmail");

  return (
    <AuthCard icon={<MailCheck className="size-6" />} title={t("auth.verifyTitle")} subtitle={body}>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void submit(code); }}>
        <FormError>{error}</FormError>
        <CodeInput
          value={code}
          onChange={(v) => {
            setCode(v);
            // A fresh attempt: drop the red state of the last one.
            setCodeBad(false);
            if (error) setError(null);
          }}
          onComplete={(v) => void submit(v)}
          label={t("auth.code")}
          aria-invalid={codeBad || undefined}
        />
        <Button type="submit" size="lg" loading={pending} disabled={code.length !== 6} className="w-full">{t("auth.verifySubmit")}</Button>
        <ResendRow
          cooldown={cooldown}
          sending={sending}
          onResend={() => void resend()}
          extra={<Button type="button" variant="ghost" onClick={goOn} className="px-2">{t("auth.later")}</Button>}
        />
      </form>
    </AuthCard>
  );
}
