import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { groupDigits, shortDate } from "~/shared/lib/format";

export type DailyPoint = { date: string; value: number };

const PLOT_H = 112;
const AXIS_H = 22;
const PAD = { top: 10, right: 34, left: 4 };

/** Rounds up to 1 / 2 / 5 × 10^k so the top gridline lands on a clean number. */
export function niceMax(v: number): number {
  if (v <= 1) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * One series over days: a 2px line over a 10% wash in the accent hue, hairline grid at
 * 0 / half / top, an end dot on today (the card's headline carries the total). Hover or arrow keys move a
 * crosshair that snaps to the nearest day and shows its value; a visually hidden table
 * carries every value for screen readers.
 */
export function DailyChart({ label, points }: { label: string; points: DailyPoint[] }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [box, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();

  const n = points.length;
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => PAD.top + PLOT_H - (v / max) * PLOT_H;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const area = n ? `${line} L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z` : "";

  const total = points.reduce((s, p) => s + p.value, 0);
  const peak = points.reduce<DailyPoint | null>((b, p) => (!b || p.value > b.value ? p : b), null);
  const summary = n
    ? t("admin.charts.summary", {
        label, from: shortDate(points[0].date, locale), to: shortDate(points[n - 1].date, locale),
        total: groupDigits(total), max: groupDigits(peak?.value ?? 0), maxDate: peak ? shortDate(peak.date, locale) : "",
      })
    : label;

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (!n || !plotW) return;
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - PAD.left) / plotW) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
    if (e.key in step) {
      e.preventDefault();
      setActive((a) => Math.min(n - 1, Math.max(0, (a ?? n - 1) + step[e.key])));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : n - 1);
    } else if (e.key === "Escape") setActive(null);
  };

  const last = n ? points[n - 1] : null;
  const ticks = n ? [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i) : [];
  const tip = active != null ? points[active] : null;

  return (
    <div ref={box} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={PLOT_H + PAD.top + AXIS_H}
          role="img"
          aria-label={summary}
          aria-describedby={tableId}
          tabIndex={0}
          onPointerMove={pick}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((a) => a ?? n - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
          className="block touch-pan-y overflow-visible rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {[0, max / 2, max].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={PAD.left + plotW + 6} y={y(v)} dy="0.32em" className="num fill-ink-3 text-[11px]">{groupDigits(v)}</text>
            </g>
          ))}
          <path d={area} fill="var(--lapis)" fillOpacity={0.1} />
          <path d={line} fill="none" stroke="var(--lapis)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {last && active == null && (
            <circle cx={x(n - 1)} cy={y(last.value)} r={4} fill="var(--lapis)" stroke="var(--paper)" strokeWidth={2} />
          )}
          {tip && active != null && (
            <g pointerEvents="none">
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--line-strong)" strokeWidth={1} shapeRendering="crispEdges" />
              <circle cx={x(active)} cy={y(tip.value)} r={4} fill="var(--lapis)" stroke="var(--paper)" strokeWidth={2} />
            </g>
          )}
          {ticks.map((i) => (
            <text key={i} x={x(i)} y={PAD.top + PLOT_H + 16} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-ink-3 text-[11px]">
              {shortDate(points[i].date, locale)}
            </text>
          ))}
        </svg>
      )}
      {tip && active != null && (
        <div
          aria-hidden="true"
          className="glass-float pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-control border border-line px-2.5 py-1.5"
          style={{ left: Math.min(Math.max(x(active), 48), width - 48) }}
        >
          <p className="num font-display text-sm font-semibold text-ink">{groupDigits(tip.value)}</p>
          <p className="text-xs text-ink-3">{shortDate(tip.date, locale)}</p>
        </div>
      )}
      <table id={tableId} className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th scope="col">{t("admin.charts.date")}</th><th scope="col">{label}</th></tr></thead>
        <tbody>
          {points.map((p) => <tr key={p.date}><td>{shortDate(p.date, locale)}</td><td>{p.value}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}
