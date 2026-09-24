import * as R from "@radix-ui/react-radio-group";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";

/**
 * A single-choice group drawn as cards (resume picker, account role, resume visibility).
 * Radix RadioGroup: roving focus, arrow keys, and a native input for form posts via `name`.
 * Lay the cards out with `className` (e.g. "grid gap-2 sm:grid-cols-2").
 */
export function SelectableCardGroup({
  value, onValueChange, label, name, required, disabled, className, children, "aria-describedby": describedBy,
}: {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name of the group (use the visible question text). */
  label: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  "aria-describedby"?: string;
}) {
  return (
    <R.Root
      value={value}
      onValueChange={onValueChange}
      aria-label={label}
      aria-describedby={describedBy}
      name={name}
      required={required}
      disabled={disabled}
      className={cn("grid gap-2", className)}
    >
      {children}
    </R.Root>
  );
}

/**
 * One option. Selected: 2px lapis border on lapis-soft; unselected: 1px line-strong border with
 * 1px more padding, so the content never shifts when the selection moves.
 * `layout="stack"` puts the icon on top (compact tiles in a 2-column grid).
 */
export function SelectableCard({
  value, title, description, icon, disabled, layout = "row", className,
}: {
  value: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  layout?: "row" | "stack";
  className?: string;
}) {
  const stack = layout === "stack";
  return (
    <R.Item
      value={value}
      disabled={disabled}
      className={cn(
        "group relative flex w-full min-w-0 cursor-pointer select-none rounded-control text-start",
        // 1px border + 15px padding (unselected) = 2px border + 14px padding (selected).
        "border border-line-strong bg-surface p-[0.9375rem]",
        "data-[state=checked]:border-2 data-[state=checked]:border-lapis data-[state=checked]:bg-lapis-soft data-[state=checked]:p-3.5",
        "transition-[border-color,background-color,transform] duration-150 hover:border-ink-3 data-[state=checked]:hover:border-lapis",
        "active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50",
        stack ? "flex-col items-start gap-2" : "items-center gap-3",
        className,
      )}
    >
      {!stack && <Dot />}
      {icon && (
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-control bg-sunken text-ink-2 transition-colors duration-150 group-data-[state=checked]:bg-surface group-data-[state=checked]:text-lapis-ink [&_svg]:size-5"
        >
          {icon}
        </span>
      )}
      {/* Offsets shrink by the extra 1px of border so the dot stays put. */}
      {stack && <Dot className="absolute right-3.5 top-3.5 group-data-[state=checked]:right-[0.8125rem] group-data-[state=checked]:top-[0.8125rem]" />}
      <span className={cn("block min-w-0 flex-1 break-words", stack && !icon && "pr-7")}>
        <span className="block text-md font-semibold text-ink">{title}</span>
        {description && <span className="mt-0.5 block text-sm text-ink-2">{description}</span>}
      </span>
    </R.Item>
  );
}

function Dot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border-2 border-line-strong bg-surface transition-colors duration-150 group-data-[state=checked]:border-lapis",
        className,
      )}
    >
      <R.Indicator className="anim-fade size-2.5 rounded-full bg-lapis" />
    </span>
  );
}
