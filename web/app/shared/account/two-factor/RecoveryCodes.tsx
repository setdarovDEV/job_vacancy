import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";

/** Recovery codes, shown once right after they are created. */
export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Job Vacancy — ${t("twoFactor.codesTitle")}\n\n${text}\n`], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "jobvacancy-recovery-codes.txt" });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-medium text-ink">{t("twoFactor.codesTitle")}</p>
        <p className="mt-1 text-sm text-ink-2">{t("twoFactor.codesHint")}</p>
      </div>
      <ul className="grid grid-cols-2 gap-2 rounded-panel border border-line bg-sunken p-4 font-mono text-[0.9375rem] tracking-wide text-ink" data-testid="recovery-codes">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true))}>
          {copied ? t("twoFactor.copied") : t("twoFactor.copy")}
        </Button>
        <Button type="button" variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={download}>{t("twoFactor.download")}</Button>
        <Button type="button" size="sm" className="ml-auto" onClick={onDone}>{t("twoFactor.saved")}</Button>
      </div>
    </div>
  );
}
