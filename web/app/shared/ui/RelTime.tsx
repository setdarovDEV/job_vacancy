import { useTranslation } from "../i18n/i18n";
import { relativeTime } from "../lib/format";

/**
 * "5 daqiqa oldin". Server and browser compute it a moment apart, so the text can differ
 * across a minute boundary; that difference is expected and must not fail hydration.
 */
export function RelTime({ iso, template }: { iso: string; template?: (when: string) => string }) {
  const { t } = useTranslation();
  const when = relativeTime(iso, t);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {template ? template(when) : when}
    </time>
  );
}
