import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { useLocale } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { monthLabel, monthNames } from "../lib/format";
import { placeUnder } from "./anchor";

type Props = {
  /** "month": value "YYYY-MM" (work experience). "year": value "YYYY" (studies, founding year). */
  mode?: "month" | "year";
  value: string;
  onChange: (v: string) => void;
  /** Same format as value; months/years outside are disabled. */
  min?: string;
  max?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

const PAGE = 12; // years per page in the year grid

/**
 * Month or year picker drawn by us: `<input type="month">` is missing in Firefox and Safari
 * and looks different everywhere else. A 3×4 grid of months with year paging (click the
 * year to jump by years), or a grid of years. Arrow keys move, Enter picks, Escape closes.
 */
export function MonthPicker({
  mode = "month", value, onChange, min, max, placeholder, required, disabled, className, id, ...aria
}: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const uid = useId().replace(/:/g, "");
  const popId = `${uid}-pop`;
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const now = new Date();
  const thisYear = now.getFullYear();
  const valueYear = value ? Number(value.slice(0, 4)) : null;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"months" | "years">(mode === "year" ? "years" : "months");
  const [year, setYear] = useState(valueYear ?? thisYear); // year shown in the month grid
  const [pageStart, setPageStart] = useState(pageOf(valueYear ?? thisYear));
  const [focus, setFocus] = useState(0);

  const minY = min ? Number(min.slice(0, 4)) : 1950;
  const maxY = max ? Number(max.slice(0, 4)) : thisYear + 10;
  const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
  const monthOff = (y: number, m: number) => (min ? ym(y, m) < min.slice(0, 7) : false) || (max ? ym(y, m) > max.slice(0, 7) : false);
  const yearOff = (y: number) => y < minY || y > maxY;
  const names = monthNames(locale, "short");

  const label = value ? (mode === "year" ? value : capitalize(monthLabel(value, locale, "long"))) : "";

  const place = useCallback(() => {
    if (pop.current && trigger.current) placeUnder(pop.current, trigger.current, { width: 288, maxHeight: 420 });
  }, []);
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  // Roving focus inside the grid.
  useEffect(() => {
    if (open) grid.current?.querySelector<HTMLButtonElement>(`[data-i="${focus}"]`)?.focus({ preventScroll: true });
  }, [open, focus, view, year, pageStart]);

  const onToggle = (e: React.ToggleEvent<HTMLDivElement>) => {
    const isOpen = e.newState === "open";
    setOpen(isOpen);
    if (isOpen) {
      const y = valueYear ?? Math.min(thisYear, maxY);
      setYear(y);
      setPageStart(pageOf(y));
      setView(mode === "year" ? "years" : "months");
      setFocus(mode === "year" ? y - pageOf(y) : value ? Number(value.slice(5, 7)) - 1 : Math.min(now.getMonth(), 11));
      requestAnimationFrame(place);
    } else if (pop.current?.contains(document.activeElement) || document.activeElement === document.body) {
      trigger.current?.focus({ preventScroll: true });
    }
  };

  const close = () => pop.current?.hidePopover();
  const pickMonth = (m: number) => { onChange(ym(year, m)); close(); };
  const pickYear = (y: number) => {
    if (mode === "year") { onChange(String(y)); close(); return; }
    setYear(y);
    setView("months");
    setFocus(value && valueYear === y ? Number(value.slice(5, 7)) - 1 : 0);
  };

  const step = (dir: -1 | 1) => {
    if (view === "months") setYear((y) => Math.min(Math.max(y + dir, minY), maxY));
    else setPageStart((p) => p + dir * PAGE);
  };
  const canStep = (dir: -1 | 1) => (view === "months" ? (dir < 0 ? year > minY : year < maxY) : dir < 0 ? pageStart > minY : pageStart + PAGE <= maxY);

  const onGridKey = (e: KeyboardEvent) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key];
    if (d !== undefined) {
      e.preventDefault();
      const next = focus + d;
      if (next < 0) { if (canStep(-1)) { step(-1); setFocus(next + 12); } }
      else if (next > 11) { if (canStep(1)) { step(1); setFocus(next - 12); } }
      else setFocus(next);
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const dir = e.key === "PageUp" ? -1 : 1;
      if (canStep(dir)) step(dir);
    } else if (e.key === "Home") { e.preventDefault(); setFocus(0); }
    else if (e.key === "End") { e.preventDefault(); setFocus(11); }
  };

  const cell = "h-10 rounded-control text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:text-ink-3/50 disabled:hover:bg-transparent";
  const title = view === "months" ? String(year) : `${pageStart} – ${pageStart + PAGE - 1}`;

  return (
    <div className={cn("relative", className)}>
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        {...aria}
        disabled={disabled}
        popoverTarget={popId}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-control border border-line-strong bg-surface pl-3.5 pr-3 text-left text-[0.9375rem] text-ink outline-none",
          "transition-[border-color,box-shadow] duration-150 hover:border-ink-3 focus-visible:border-lapis focus-visible:shadow-[0_0_0_4px_var(--lapis-soft)]",
          "aria-[invalid=true]:border-anor disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3 disabled:hover:border-line-strong",
          open && "border-lapis shadow-[0_0_0_4px_var(--lapis-soft)]",
        )}
      >
        <span className={cn("num min-w-0 flex-1 truncate", !label && "text-ink-3")}>{label || placeholder || (mode === "year" ? t("picker.chooseYear") : t("picker.chooseMonth"))}</span>
        <CalendarDays className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
      </button>

      {required && (
        <input tabIndex={-1} aria-hidden="true" required value={value} onChange={() => {}} onFocus={() => trigger.current?.focus()}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0" />
      )}

      <div
        ref={pop}
        id={popId}
        popover="auto"
        role="dialog"
        aria-label={aria["aria-label"] ?? (mode === "year" ? t("picker.chooseYear") : t("picker.chooseMonth"))}
        onToggle={onToggle}
        className="popover-panel select-panel fixed inset-auto m-0 overflow-y-auto rounded-panel border border-line bg-surface p-3 text-ink shadow-pop"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <button type="button" onClick={() => step(-1)} disabled={!canStep(-1)} aria-label={view === "months" ? t("picker.prevYear") : t("picker.prevYears")}
            className="grid size-9 place-items-center rounded-control text-ink-2 hover:bg-sunken hover:text-ink disabled:opacity-30">
            <ChevronLeft className="size-4.5" />
          </button>
          {view === "months" ? (
            <button type="button" onClick={() => { setPageStart(pageOf(year)); setView("years"); setFocus(year - pageOf(year)); }}
              aria-label={t("picker.pickYear")}
              className="num h-9 rounded-control px-3 font-display text-[0.9375rem] font-semibold tracking-[-0.01em] hover:bg-sunken">
              {title}
            </button>
          ) : (
            <span className="num font-display text-[0.9375rem] font-semibold tracking-[-0.01em]" aria-live="polite">{title}</span>
          )}
          <button type="button" onClick={() => step(1)} disabled={!canStep(1)} aria-label={view === "months" ? t("picker.nextYear") : t("picker.nextYears")}
            className="grid size-9 place-items-center rounded-control text-ink-2 hover:bg-sunken hover:text-ink disabled:opacity-30">
            <ChevronRight className="size-4.5" />
          </button>
        </div>

        <div ref={grid} role="grid" onKeyDown={onGridKey} className="grid grid-cols-3 gap-1">
          {view === "months"
            ? names.map((n, m) => {
                const selected = value === ym(year, m);
                const current = year === thisYear && m === now.getMonth();
                return (
                  <button key={m} type="button" data-i={m} tabIndex={focus === m ? 0 : -1} disabled={monthOff(year, m)} aria-pressed={selected}
                    aria-label={capitalize(monthLabel(ym(year, m), locale, "long"))} onClick={() => pickMonth(m)}
                    className={cn(cell, selected ? "bg-lapis font-semibold text-on-lapis" : "hover:bg-sunken", !selected && current && "ring-1 ring-inset ring-line-strong")}>
                    {capitalize(n)}
                  </button>
                );
              })
            : Array.from({ length: PAGE }, (_, i) => pageStart + i).map((y, i) => {
                const selected = valueYear === y && (mode === "year" || view === "years");
                return (
                  <button key={y} type="button" data-i={i} tabIndex={focus === i ? 0 : -1} disabled={yearOff(y)} aria-pressed={selected}
                    onClick={() => pickYear(y)}
                    className={cn(cell, "num", selected ? "bg-lapis font-semibold text-on-lapis" : "hover:bg-sunken", !selected && y === thisYear && "ring-1 ring-inset ring-line-strong")}>
                    {y}
                  </button>
                );
              })}
        </div>

        {value && !required && (
          <div className="mt-2 border-t border-line pt-2">
            <button type="button" onClick={() => { onChange(""); close(); }} className="h-9 w-full rounded-control text-sm text-ink-2 hover:bg-sunken hover:text-ink">
              {t("common.clear")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const pageOf = (y: number) => y - (((y % PAGE) + PAGE) % PAGE);
const capitalize = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);
