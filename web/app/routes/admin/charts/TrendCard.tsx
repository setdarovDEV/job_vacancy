import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { DailyChart, type DailyPoint } from "./DailyChart";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { groupDigits } from "~/shared/lib/format";

/** Change vs the previous period, or null when there's nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Stat tile + its daily chart: the period total as the headline, the change against the
 * previous period of the same length, then the days. `upIsGood` picks the delta's tone
 * (more reports is bad news); the tone always comes with an arrow and words.
 */
export function TrendCard({ label, current, previous, days, points, upIsGood = true }: {
  label: string; current: number; previous: number; days: number; points: DailyPoint[]; upIsGood?: boolean;
}) {
  const { t } = useTranslation();
  const pct = percentChange(current, previous);
  const dir = current === previous ? 0 : current > previous ? 1 : -1;
  const good = dir === 0 ? null : (dir > 0) === upIsGood;
  const Icon = dir > 0 ? ArrowUpRight : dir < 0 ? ArrowDownRight : Minus;
  const deltaText =
    dir === 0 ? t("admin.charts.noChange")
      : pct == null ? t("admin.charts.fromZero")
      : `${pct > 0 ? "+" : ""}${pct}%`;
  return (
    <section className="rounded-panel border border-line bg-surface p-5" aria-label={label}>
      <h3 className="text-sm text-ink-2">{label}</h3>
      <div className="mt-1 flex flex-col gap-1">
        <p className="font-display text-3xl font-semibold tracking-[-0.03em] text-ink">{groupDigits(current)}</p>
        <p className="flex items-center gap-1 text-xs">
          <span className={cn("inline-flex items-center gap-0.5 font-semibold",
            good == null ? "text-ink-3" : good ? "text-firuza-ink" : "text-anor-ink")}>
            <Icon className="size-3.5" aria-hidden="true" />
            <span className="num">{deltaText}</span>
          </span>
          <span className="text-ink-3">{t("admin.charts.vsPrevious", { n: days })}</span>
        </p>
      </div>
      <div className="mt-4">
        <DailyChart label={label} points={points} />
      </div>
    </section>
  );
}
