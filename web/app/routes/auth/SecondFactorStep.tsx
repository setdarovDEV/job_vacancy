import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import { api } from "~/shared/api/client";
import { signedIn } from "~/shared/auth/session";
import { CodeInput } from "~/shared/forms/CodeInput";
import { FormError } from "~/shared/forms/FormError";
import { useSubmit } from "~/shared/forms/useSubmit";
import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";
import { Field, Input } from "~/shared/ui/Field";

/** A 202 from /auth/login or /auth/google carries this instead of a session. */
export type TwoFactorChallenge = { challenge_token: string; expires_in: number };

export function challengeOf(res: { response: Response; data?: unknown }): TwoFactorChallenge | null {
  if (res.response.status !== 202) return null;
  return (res.data as { data?: TwoFactorChallenge } | undefined)?.data ?? null;
}

/** Second step of signing in: the app code, or a recovery code. */
export function SecondFactorStep({ challenge, onDone, onRestart }: {
  challenge: TwoFactorChallenge;
  onDone: (firstName?: string) => void;
  onRestart: () => void;
}) {
  const { t } = useTranslation();
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const { pending, error, run } = useSubmit();

  const submit = (appCode = code) => void run(
    () => api.POST("/auth/two-factor/verify", {
      body: useRecovery
        ? { challenge_token: challenge.challenge_token, recovery_code: recovery }
        : { challenge_token: challenge.challenge_token, code: appCode },
    }),
    (res) => {
      signedIn(res.data!.data as never);
      onDone((res.data!.data as { user: { full_name: string } }).user.full_name.split(" ")[0]);
    },
    (e) => {
      if (e.code !== "two_factor_challenge_invalid") return false;
      onRestart(); // expired or out of attempts: back to the password step
      return true;
    },
  );

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lapis-soft text-lapis-ink"><ShieldCheck className="size-5" /></span>
        <div>
          <p className="font-medium text-ink">{t("twoFactor.loginTitle")}</p>
          <p className="text-sm text-ink-2">{useRecovery ? t("twoFactor.codesHint").split(".")[0] + "." : t("twoFactor.loginHint")}</p>
        </div>
      </div>
      <FormError>{error}</FormError>
      {useRecovery ? (
        <Field label={t("twoFactor.recovery")}>
          <Input value={recovery} onChange={(e) => setRecovery(e.target.value)} autoComplete="one-time-code" autoFocus required className="font-mono" placeholder="xxxxx-xxxxx" />
        </Field>
      ) : (
        <CodeInput value={code} onChange={setCode} onComplete={(v) => submit(v)} label={t("twoFactor.code")} />
      )}
      <Button type="submit" size="lg" loading={pending} disabled={useRecovery ? recovery.trim().length < 10 : code.length !== 6}>{t("twoFactor.confirm")}</Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" className="text-ink-2 hover:text-ink" onClick={onRestart}>{t("twoFactor.back")}</button>
        <button type="button" className="font-medium text-lapis-ink hover:underline" onClick={() => setUseRecovery((v) => !v)}>
          {useRecovery ? t("twoFactor.useApp") : t("twoFactor.useRecovery")}
        </button>
      </div>
    </form>
  );
}
