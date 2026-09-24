import * as T from "@radix-ui/react-tabs";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "../lib/cn";
import { groupDigits } from "../lib/format";

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Underlined tabs. The lapis indicator is one 1px-wide bar moved and stretched with a transform
 * (translateX + scaleX), so it glides between tabs of any width without animating layout and
 * without loading an animation library. On narrow screens the strip scrolls sideways; focus rings
 * are drawn inside the triggers so the scroller never clips them.
 */
export function Tabs({
  value, onValueChange, tabs, children, className, label,
}: {
  value: string;
  onValueChange: (v: string) => void;
  tabs: { value: string; label: ReactNode; count?: number; disabled?: boolean }[];
  children?: ReactNode;
  className?: string;
  /** Optional accessible name for the tab list. */
  label?: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  // Until measured (SSR, first paint) the active trigger draws its own static underline.
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);

  useLayoutEffect(() => {
    const l = list.current;
    const b = bar.current;
    if (!l || !b) return;
    const current = () => l.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    const place = () => {
      const tab = current();
      if (!tab) {
        b.style.opacity = "0";
        return;
      }
      // Underline the label, not the trigger's padding.
      const pad = parseFloat(getComputedStyle(tab).paddingLeft) || 0;
      b.style.opacity = "";
      b.style.transform = `translateX(${tab.offsetLeft + pad}px) scaleX(${Math.max(0, tab.offsetWidth - pad * 2)})`;
    };
    place();

    const tab = current();
    if (tab && l.scrollWidth > l.clientWidth) {
      const left = tab.offsetLeft;
      const right = left + tab.offsetWidth;
      if (left < l.scrollLeft || right > l.scrollLeft + l.clientWidth) {
        l.scrollTo({ left: left - 16, behavior: readyRef.current && !reducedMotion() ? "smooth" : "auto" });
      }
    }
    if (!readyRef.current) {
      readyRef.current = true;
      setReady(true);
    }

    // Font swap, locale switch or count change resizes a trigger: follow it.
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(place);
    ro.observe(l);
    l.querySelectorAll('[role="tab"]').forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [value, tabs.length]);

  return (
    <T.Root value={value} onValueChange={onValueChange} className={className}>
      <div className="border-b border-line">
        {/* -mb-px lets the indicator cover the hairline below the strip. */}
        <T.List
          ref={list}
          aria-label={label}
          className="relative -mb-px flex gap-1 overflow-x-auto scrollbar-none"
        >
          {tabs.map((tab) => {
            const on = tab.value === value;
            return (
              <T.Trigger
                key={tab.value}
                value={tab.value}
                disabled={tab.disabled}
                className={cn(
                  "relative flex h-11 shrink-0 select-none items-center gap-2 whitespace-nowrap rounded-control px-3 text-md font-medium",
                  "text-ink-2 transition-colors duration-150 hover:text-ink data-[state=active]:text-ink",
                  "focus-visible:-outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
                  !ready &&
                    "data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-lapis",
                )}
              >
                {tab.label}
                {tab.count != null && (
                  <span
                    className={cn(
                      "num rounded-pill px-1.5 text-xs font-semibold transition-colors duration-150",
                      on ? "bg-lapis-soft text-lapis-ink" : "bg-sunken text-ink-2",
                    )}
                  >
                    {groupDigits(tab.count)}
                  </span>
                )}
              </T.Trigger>
            );
          })}
          <span
            ref={bar}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left bg-lapis",
              ready ? "transition-transform duration-(--dur-3) ease-spring" : "opacity-0",
            )}
          />
        </T.List>
      </div>
      {children}
    </T.Root>
  );
}

export const TabPanel = T.Content;
