import type { TFunction } from "../i18n/i18n";

import type { Locale } from "../i18n/config";

type Currency = "UZS" | "USD";

/** Groups digits with a non-breaking space (U+00A0 — Unbounded has no U+202F glyph): 15 000 000. */
export function groupDigits(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
}

/** 4.5 → "4,5" (uz, ru) or "4.5" (en); trailing zeros dropped. */
export function decimal(n: number, digits: number, locale: Locale): string {
  const s = String(Number(n.toFixed(digits)));
  return locale === "en" ? s : s.replace(".", ",");
}

/**
 * Formats an amount the way people say it: sums of a million and up are shortened
 * ("15 mln so'm", "1,5 млн сум"), dollars keep full digits ("$1 200").
 */
export function money(amount: number, currency: Currency, t: TFunction, locale: Locale): string {
  if (currency === "USD") return `$${groupDigits(amount)}`;
  const unit = t("salary.currency.UZS");
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return `${decimal(m, m < 10 ? 1 : 0, locale)} ${t("salary.million")} ${unit}`;
  }
  return `${groupDigits(amount)} ${unit}`;
}

/** "5–8 mln so'm", "from $1 200", "Negotiable". */
export function salary(
  s: { min?: number | null; max?: number | null; currency?: string } | null | undefined,
  t: TFunction,
  locale: Locale,
): string {
  if (!s || (s.min == null && s.max == null)) return t("salary.negotiable");
  const cur = (s.currency === "USD" ? "USD" : "UZS") as Currency;
  if (s.min != null && s.max != null) {
    if (s.min === s.max) return money(s.min, cur, t, locale);
    // Share the unit: "5–8 mln so'm" instead of "5 mln so'm – 8 mln so'm".
    const bothMillions = cur === "UZS" && s.min >= 1_000_000;
    if (bothMillions) {
      return `${decimal(s.min / 1e6, 1, locale)}–${decimal(s.max / 1e6, 1, locale)} ${t("salary.million")} ${t("salary.currency.UZS")}`;
    }
    return t("salary.range", { min: money(s.min, cur, t, locale), max: money(s.max, cur, t, locale) });
  }
  if (s.min != null) return t("salary.from", { amount: money(s.min, cur, t, locale) });
  return t("salary.upTo", { amount: money(s.max!, cur, t, locale) });
}

// Uzbek isn't in every browser's Intl data, so relative times use our own strings.
const units: [string, number][] = [["months", 2_592_000], ["weeks", 604_800], ["days", 86_400], ["hours", 3_600], ["minutes", 60]];

/** "3 kun oldin", "2 часа назад", "kecha"; under a minute: "hozirgina". */
export function relativeTime(iso: string | Date, t: TFunction, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return t("time.justNow");
  const days = Math.floor(seconds / 86_400);
  if (days === 1) return t("time.yesterday");
  for (const [unit, size] of units) {
    if (seconds >= size) return t(`time.${unit}`, { count: Math.floor(seconds / size) });
  }
  return t("time.justNow");
}

/** "4 yil 7 oy" from a month count. */
export function experienceText(months: number, t: TFunction): string {
  if (months <= 0) return t("enums.experience.none");
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? t("time.years", { count: y }) : "", m ? t("time.monthsCount", { count: m }) : ""].filter(Boolean).join(" ");
}

/** "14:05" in the viewer's time zone. */
export function clock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Intl has no Uzbek month names in most browsers, so ours are spelled out.
const MONTHS_OWN: Partial<Record<Locale, { long: string[]; short: string[] }>> = {
  uz: {
    long: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
    short: ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"],
  },
  "uz-Cyrl": {
    long: ["январ", "феврал", "март", "апрел", "май", "июн", "июл", "август", "сентабр", "октабр", "ноябр", "декабр"],
    short: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"],
  },
};

/** Month names for the UI language; "long" is the stand-alone form ("Январь", "January"). */
export function monthNames(locale: Locale, style: "long" | "short" = "long"): string[] {
  const own = MONTHS_OWN[locale];
  if (own) return own[style];
  const f = new Intl.DateTimeFormat(locale, { month: style });
  return Array.from({ length: 12 }, (_, m) => f.format(new Date(2024, m, 15)));
}

/** "2022-03" → "mar 2022" / "мар. 2022" / "Mar 2022". */
export function monthLabel(ym: string, locale: Locale, style: "long" | "short" = "short"): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return "";
  return `${monthNames(locale, style)[m - 1]} ${y}`;
}

/** Day separator: "Bugun", "Kecha" or "12-sentabr" / "12 сентября" / "September 12". */
export function dayLabel(iso: string, t: TFunction, locale: Locale): string {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86_400_000);
  if (diff === 0) return t("chat.today");
  if (diff === 1) return t("chat.yesterday");
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const own = MONTHS_OWN[locale];
  if (own) return `${d.getDate()}-${own.long[d.getMonth()]}${sameYear ? "" : ` ${d.getFullYear()}`}`;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) }).format(d);
}

/** "2,4 MB" style file sizes. */
export function fileSize(bytes: number, locale: Locale): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${decimal(bytes / 1024, 0, locale)} KB`;
  return `${decimal(bytes / 1024 / 1024, 1, locale)} MB`;
}
