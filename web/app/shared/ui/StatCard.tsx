import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";

import { useLocale } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { decimal } from "../lib/format";
import { Skeleton } from "./Skeleton";

const valueTones = {
  ink: "text-ink",
  lapis: "text-lapis-ink",
  firuza: "text-firuza-ink",
  zafaron: "text-zafaron-ink",
  anor: "text-anor-ink",
} as const;

type Size = "sm" | "md";

// Shared with the skeleton so placeholder line boxes are exactly as tall as the text (h-lh).
const labelText = { sm: "text-xs sm:text-sm", md: "text-sm" } as const;
const valueText = {
  // Three compact tiles side by side at 360px: one line, a step smaller on the narrowest phones.
  sm: "mt-1 whitespace-nowrap text-base min-[380px]:text-lg sm:text-xl",
  md: "mt-2 break-words text-2xl",
} as const;

function shell(material: "solid" | "glass", size: Size) {
  return cn(
    "min-w-0",
    material === "glass" ? "glass-panel rounded-panel" : "surface-card",
    // sm: compact centred hero tile (three fit side by side at 360px); md: dashboard KPI.
    size === "sm" ? "px-2 py-3 text-center sm:px-4 sm:py-4" : "p-4 md:p-5",
  );
}

/**
 * KPI tile: label, big tabular value, optional delta pill and sparkline. `material="glass"`
 * only over the aurora (home hero, employers); dashboards use the solid default.
 */
export function StatCard({
  label, value, delta, icon, material = "solid", hint, sparkline, size = "md", tone = "ink", className,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Change vs the previous period. `value` is signed; shown with `suffix` (default "%"). */
  delta?: { value: number; label?: string; suffix?: string };
  icon?: ReactNode;
  material?: "solid" | "glass";
  hint?: ReactNode;
  /** A few points (oldest first) drawn as a tiny inline chart. */
  sparkline?: number[];
  size?: Size;
  /** Value color. */
  tone?: keyof typeof valueTones;
  className?: string;
}) {
  const sm = size === "sm";
  const trend = delta ? Math.sign(delta.value) : 0;
  return (
    <div className={cn(shell(material, size), className)}>
      <dl className={cn("flex min-w-0 flex-col", sm && "items-center")}>
        <div className={cn("flex min-w-0 items-center gap-3", sm ? "justify-center" : "justify-between")}>
          <dt className={cn("min-w-0 truncate text-ink-2", labelText[size])}>{label}</dt>
          {icon && !sm && (
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-control bg-lapis-soft text-lapis-ink [&_svg]:size-4.5">
              {icon}
            </span>
          )}
        </div>
        <dd
          className={cn(
            "num min-w-0 font-display font-semibold tracking-heading",
            valueText[size],
            valueTones[tone],
          )}
        >
          {value}
        </dd>
        {(delta || hint) && (
          <dd className={cn("mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", sm && "justify-center")}>
            {delta && <DeltaPill value={delta.value} suffix={delta.suffix} />}
            {(delta?.label || hint) && <span className="min-w-0 text-sm text-ink-2">{delta?.label || hint}</span>}
          </dd>
        )}
        {delta?.label && hint && <dd className="mt-1 text-sm text-ink-2">{hint}</dd>}
      </dl>
      {sparkline && sparkline.length > 1 && (
        <Sparkline
          points={sparkline}
          className={cn(
            "mt-3 h-10 w-full",
            trend > 0 ? "text-firuza" : trend < 0 ? "text-anor" : "text-lapis",
          )}
        />
      )}
    </div>
  );
}

function DeltaPill({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const amount = `${decimal(Math.abs(value), 1, locale)}${suffix}`;
  const up = value > 0;
  const down = value < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "num inline-flex h-6 shrink-0 items-center gap-0.5 rounded-pill pl-1.5 pr-2 text-xs font-semibold",
        up ? "bg-firuza-soft text-firuza-ink" : down ? "bg-anor-soft text-anor-ink" : "bg-sunken text-ink-2",
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      {/* The arrow and sign are visual; screen readers get the direction in words. */}
      <span aria-hidden="true">{up ? "+" : down ? "−" : ""}{amount}</span>
      <span className="sr-only">
        {up ? t("states.deltaUp", { value: amount }) : down ? t("states.deltaDown", { value: amount }) : t("states.deltaFlat")}
      </span>
    </span>
  );
}

/** Tiny trend line (no chart library): a stroke plus a soft area fill, colored by currentColor. */
function Sparkline({ points, className }: { points: number[]; className?: string }) {
  const w = 100;
  const h = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  // 2px inset top and bottom so the stroke never clips.
  const xy = points.map((p, i) => [i * step, h - 2 - ((p - min) / span) * (h - 4)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" focusable="false" className={className}>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="currentColor" fillOpacity={0.12} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Loading placeholder with the StatCard's exact outer size. */
export function StatCardSkeleton({
  material = "solid", size = "md", icon = true, sparkline, className,
}: { material?: "solid" | "glass"; size?: Size; icon?: boolean; sparkline?: boolean; className?: string }) {
  const sm = size === "sm";
  return (
    <div aria-hidden="true" className={cn(shell(material, size), sm && "flex flex-col items-center", className)}>
      {sm ? (
        <>
          <div className={cn("flex h-lh items-center", labelText.sm)}><Skeleton className="h-[0.8em] w-16 sm:w-24" /></div>
          <div className={cn("flex h-lh items-center font-display", valueText.sm)}><Skeleton className="h-[0.9em] w-14 rounded-control sm:w-20" /></div>
        </>
      ) : (
        <>
          <div className={cn("flex items-center justify-between gap-3", icon ? "h-9" : cn("h-lh", labelText.md))}>
            <Skeleton className="h-4 w-28" />
            {icon && <Skeleton className="size-9 rounded-control" />}
          </div>
          <div className={cn("flex h-lh items-center font-display", valueText.md)}><Skeleton className="h-[0.9em] w-24 rounded-control" /></div>
          <Skeleton className="mt-2 h-6 w-16" />
          {sparkline && <Skeleton className="mt-3 h-10 w-full rounded-control" />}
        </>
      )}
    </div>
  );
}
