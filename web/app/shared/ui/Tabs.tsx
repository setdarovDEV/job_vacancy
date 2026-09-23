import * as T from "@radix-ui/react-tabs";
import { m } from "motion/react";
import { useId, type ReactNode } from "react";

import { cn } from "../lib/cn";
import { Motion } from "../motion/Motion";

/**
 * Underlined tabs; the indicator glides to the selected tab (a shared-layout animation,
 * so it follows tabs of any width).
 */
export function Tabs({
  value, onValueChange, tabs, children, className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  tabs: { value: string; label: ReactNode; count?: number }[];
  children?: ReactNode;
  className?: string;
}) {
  const layoutId = useId();
  return (
    <Motion>
    <T.Root value={value} onValueChange={onValueChange} className={className}>
      <T.List className="flex gap-6 overflow-x-auto border-b border-line [scrollbar-width:none]">
        {tabs.map((tab) => (
          <T.Trigger
            key={tab.value}
            value={tab.value}
            className="relative flex h-11 shrink-0 items-center gap-2 text-sm font-medium text-ink-3 outline-none transition-colors hover:text-ink data-[state=active]:text-ink"
          >
            {tab.label}
            {tab.count != null && (
              <span className={cn("num rounded-md px-1.5 text-xs", tab.value === value ? "bg-lapis-soft text-lapis-ink" : "bg-sunken text-ink-3")}>
                {tab.count}
              </span>
            )}
            {tab.value === value && (
              <m.span
                layoutId={layoutId}
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-lapis"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </T.Trigger>
        ))}
      </T.List>
      {children}
    </T.Root>
    </Motion>
  );
}

export const TabPanel = T.Content;
