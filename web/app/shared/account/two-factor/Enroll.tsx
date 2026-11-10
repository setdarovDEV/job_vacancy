import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { twoFactorStatusKey } from "./keys";
import { RecoveryCodes } from "./RecoveryCodes";
import { api } from "~/shared/api/client";
import { withAuth } from "~/shared/auth/session";
import { CodeInput } from "~/shared/forms/CodeInput";
import { FormError } from "~/shared/forms/FormError";
import { useSubmit } from "~/shared/forms/useSubmit";
import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";
import { Spinner } from "~/shared/ui/Spinner";
import { toast } from "~/shared/ui/toast-store";

/** QR as inline SVG; the encoder is fetched only when this screen opens. */
function QrCode({ value }: { value: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void import("qrcode-generator").then(({ default: qrcode }) => {
      const qr = qrcode(0, "M");
      qr.addData(value);
      qr.make();
      if (live) setSvg(qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true }));
    });
    return () => { live = false; };
  }, [value]);
  // Always dark on white, also in dark mode: scanners need the contrast.
  return (
    <div className="grid size-48 shrink-0 place-items-center rounded-panel bg-white p-2 [&_svg]:size-full" role="img" aria-label="QR">
      {svg ? <span className="size-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <Spinner className="size-6 text-ink-3" />}
    </div>
  );
}

/** Turn on two-factor sign-in: scan, confirm with a code, keep the recovery codes. */
export function TwoFactorEnroll({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const start = useSubmit();
  const confirm = useSubmit();

  const begin = () => void start.run(
    () => withAuth(() => api.POST("/me/two-factor/setup")),
    (res) => setSetup(res.data!.data),
  );
  const submit = (value = code) => void confirm.run(
    () => withAuth(() => api.POST("/me/two-factor/confirm", { body: { code: value } })),
    (res) => setCodes(res.data!.data.recovery_codes),
  );

  if (codes) {
    // Status refreshes only now: the admin gate and settings switch views on it, which
    // would hide the codes before they were saved.
    const finish = () => {
      toast({ tone: "success", title: t("twoFactor.enabled") });
      void qc.invalidateQueries({ queryKey: twoFactorStatusKey });
      onDone?.();
    };
    return <RecoveryCodes codes={codes} onDone={finish} />;
  }
  if (!setup) {
    return (
      <div className="flex flex-col items-start gap-3">
        <FormError>{start.error}</FormError>
        <Button type="button" onClick={begin} loading={start.pending}>{t("twoFactor.start")}</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <QrCode value={setup.otpauth_uri} />
      <form className="flex min-w-0 flex-1 flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <p className="text-sm text-ink-2">{t("twoFactor.scan")}</p>
        <div>
          <p className="text-xs text-ink-3">{t("twoFactor.manual")}</p>
          <code className="mt-1 block break-all rounded-control bg-sunken px-3 py-2 font-mono text-sm text-ink" data-testid="totp-secret">{setup.secret}</code>
        </div>
        <FormError>{confirm.error}</FormError>
        <CodeInput value={code} onChange={setCode} onComplete={(v) => submit(v)} label={t("twoFactor.enterCode")} />
        <Button type="submit" className="self-start" loading={confirm.pending} disabled={code.length !== 6}>{t("twoFactor.confirm")}</Button>
      </form>
    </div>
  );
}
