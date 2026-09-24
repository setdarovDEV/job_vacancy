import { Check, CircleAlert } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";

export type Step = { id: string; label: ReactNode; done?: boolean; error?: boolean };

type Orientation = "horizontal" | "vertical" | "responsive";

// "responsive" = a horizontal strip on phones/tablets, a vertical list in a desktop sidebar.
// The strip pads itself so focus outlines aren't clipped by its horizontal scroller.
// Vertical rails sit under the marker's centre: 6px button padding + 14px half marker.
const layout = {
  horizontal: {
    list: "flex-row items-center overflow-x-auto scrollbar-none p-1",
    rail: "h-px w-6 shrink-0 self-center",
    item: "flex-row",
    button: "rounded-pill",
    text: "whitespace-nowrap",
  },
  vertical: {
    list: "flex-col items-stretch",
    rail: "ml-[1.1875rem] h-4 w-px self-start",
    item: "flex-col items-stretch",
    button: "rounded-control",
    text: "break-words",
  },
  responsive: {
    list: "flex-row items-center overflow-x-auto scrollbar-none p-1 lg:flex-col lg:items-stretch lg:overflow-visible lg:p-0",
    rail: "h-px w-6 shrink-0 self-center lg:ml-[1.1875rem] lg:h-4 lg:w-px lg:self-start",
    item: "flex-row lg:flex-col lg:items-stretch",
    button: "rounded-pill lg:rounded-control",
    text: "whitespace-nowrap lg:whitespace-normal lg:break-words",
  },
} as const;

// Soft edges on the scrolling strip hint that more steps are off-screen on that side.
const fades: Record<string, string> = {
  l: "linear-gradient(90deg, transparent, black 2rem)",
  r: "linear-gradient(90deg, black calc(100% - 2rem), transparent)",
  lr: "linear-gradient(90deg, transparent, black 2rem, black calc(100% - 2rem), transparent)",
};

/**
 * Progress through a multi-part editor (resume, vacancy). Steps show a number, a tick when
 * done, or an alert when they have errors. With `onStepChange` every step is a button (Tab,
 * arrow keys, Home/End); without it the stepper is a read-only indicator.
 */
export function Stepper({ steps, current, onStepChange, orientation = "horizontal", className }: {
  steps: Step[];
  current: string;
  onStepChange?: (id: string) => void;
  orientation?: Orientation;
  className?: string;
}) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLOListElement>(null);
  const first = useRef(true);
  const L = layout[orientation];

  // Keep the current step visible in the horizontal strip (phones), without scrolling the page.
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>("[data-current]");
    if (!list || !el || list.scrollWidth <= list.clientWidth) return;
    const smooth = !first.current && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    first.current = false;
    list.scrollTo({ left: el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2, behavior: smooth ? "smooth" : "auto" });
  }, [current]);

  const [fade, setFade] = useState("");
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const max = list.scrollWidth - list.clientWidth;
      const l = max > 1 && list.scrollLeft > 1;
      const r = max > 1 && list.scrollLeft < max - 1;
      setFade(l && r ? "lr" : l ? "l" : r ? "r" : "");
    };
    // Passive + one measurement per frame: scrolling the strip never blocks or thrashes layout.
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    list.addEventListener("scroll", schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(list);
    return () => {
      list.removeEventListener("scroll", schedule);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  const mask: CSSProperties | undefined = fade ? { maskImage: fades[fade], WebkitMaskImage: fades[fade] } : undefined;

  const onKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!onStepChange || !keys.includes(e.key)) return;
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-step]") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? buttons.length - 1
      : e.key === "ArrowRight" || e.key === "ArrowDown" ? Math.min(buttons.length - 1, at + 1)
      : Math.max(0, at - 1);
    buttons[next]?.focus();
  };

  return (
    <ol
      ref={listRef}
      aria-label={t("states.steps")}
      onKeyDown={onKeyDown}
      style={mask}
      className={cn("relative flex min-w-0", L.list, className)}
    >
      {steps.map((s, i) => {
        const isCurrent = s.id === current;
        const state = s.error ? "error" : s.done ? "done" : isCurrent ? "current" : "todo";
        const marker = (
          <span
            aria-hidden="true"
            className={cn(
              "num grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors duration-150",
              state === "error" && "bg-anor-soft text-anor-ink",
              state === "done" && "bg-firuza-soft text-firuza-ink",
              state === "current" && "bg-lapis text-on-lapis shadow-1",
              state === "todo" && "border border-line-strong text-ink-2",
              // A done/errored current step keeps a lapis ring so "where am I" stays obvious.
              isCurrent && state !== "current" && "ring-2 ring-lapis ring-offset-2 ring-offset-surface",
            )}
          >
            {state === "error" ? <CircleAlert className="size-4" /> : state === "done" ? <Check className="size-4" strokeWidth={3} /> : i + 1}
          </span>
        );
        const text = (
          <span className={cn("min-w-0 text-sm", L.text, isCurrent ? "font-semibold text-ink" : "font-medium text-ink-2")}>
            {s.label}
            {s.done && !s.error && <span className="sr-only"> ({t("states.stepDone")})</span>}
            {s.error && <span className="sr-only"> ({t("states.stepError")})</span>}
          </span>
        );
        const body = onStepChange ? (
          <button
            type="button"
            data-step=""
            aria-current={isCurrent ? "step" : undefined}
            onClick={() => onStepChange(s.id)}
            className={cn(
              "flex min-h-11 w-full min-w-0 items-center gap-2.5 py-1.5 pl-1.5 pr-3 text-start transition-[background-color,scale] duration-150 hover:bg-sunken active:scale-[0.98]",
              L.button,
            )}
          >
            {marker}
            {text}
          </button>
        ) : (
          <span aria-current={isCurrent ? "step" : undefined} className="flex min-h-11 min-w-0 items-center gap-2.5 py-1.5 pl-1.5 pr-3">
            {marker}
            {text}
          </span>
        );
        return (
          <li key={s.id} data-current={isCurrent ? "" : undefined} className={cn("flex shrink-0", L.item)}>
            {i > 0 && <span aria-hidden="true" className={cn("bg-line", L.rail)} />}
            {body}
          </li>
        );
      })}
    </ol>
  );
}
