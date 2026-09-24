import { useSyncExternalStore } from "react";

import { htmlLang, type Locale } from "../i18n/config";
import { useLocale } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { monthNames, relativeTime } from "../lib/format";

// The server doesn't know the viewer's time zone. Server HTML and the hydration pass use
// Tashkent time (the audience's zone, so the markup matches), then the client re-renders once
// in the browser's own zone. Components mounted later on the client use it right away.
const SERVER_TZ = "Asia/Tashkent";
const noop = () => () => {};
function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}

/**
 * "12-sentabr 2026, 14:05" / "12 сентября 2026 г., 14:05" / "September 12, 2026 at 2:05 PM".
 * Uzbek has no Intl data in most browsers, so uz / uz-Cyrl spell months from our own table.
 */
export function absoluteDate(iso: string | Date, locale: Locale, timeZone?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (locale === "uz" || locale === "uz-Cyrl") {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(d);
    const p = (type: string) => parts.find((x) => x.type === type)?.value ?? "";
    return `${Number(p("day"))}-${monthNames(locale, "long")[Number(p("month")) - 1]} ${p("year")}, ${p("hour")}:${p("minute")}`;
  }
  return new Intl.DateTimeFormat(htmlLang[locale], { timeZone, dateStyle: "long", timeStyle: "short" }).format(d);
}

/**
 * "5 daqiqa oldin", with the absolute date and time as a tooltip (`title`). Server and browser
 * compute the relative text a moment apart, so it can differ across a minute boundary; that
 * difference is expected and must not fail hydration.
 */
export function RelTime({ iso, template, className }: {
  iso: string;
  template?: (when: string) => string;
  className?: string;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const hydrated = useHydrated();
  const when = relativeTime(iso, t);
  return (
    <time dateTime={iso} title={absoluteDate(iso, locale, hydrated ? undefined : SERVER_TZ)} className={className} suppressHydrationWarning>
      {template ? template(when) : when}
    </time>
  );
}
