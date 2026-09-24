import * as C from "@radix-ui/react-checkbox";
import * as R from "@radix-ui/react-radio-group";
import * as Sw from "@radix-ui/react-switch";
import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "../lib/cn";

// The whole row is the <label>, so a tap anywhere on the text toggles; rows are ≥ 44px on touch.
const row = (disabled?: boolean) => (disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer");

/** Settings-style row: label (+ description) on the left, switch on the right. */
export function Switch({
  checked, onCheckedChange, label, description, disabled,
}: { checked: boolean; onCheckedChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("group flex min-h-11 items-center justify-between gap-4 py-1.5", row(disabled))}>
      <span className="min-w-0 flex-1">
        <span id={`${id}-label`} className="block text-md font-medium text-ink">{label}</span>
        {description && <span id={`${id}-desc`} className="mt-0.5 block text-sm text-ink-2">{description}</span>}
      </span>
      <Sw.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        // Name = the label only; the description is announced as a description.
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        className={cn(
          "relative inline-flex h-6 w-10 shrink-0 items-center rounded-pill bg-line-strong transition-colors duration-200",
          "group-hover:data-[state=unchecked]:bg-ink-3 data-[state=checked]:bg-lapis disabled:pointer-events-none",
        )}
      >
        <Sw.Thumb
          className={cn(
            "pointer-events-none block size-5 translate-x-0.5 rounded-full bg-on-lapis shadow-1",
            "transition-transform duration-(--dur-2) ease-spring data-[state=checked]:translate-x-4.5",
          )}
        />
      </Sw.Root>
    </label>
  );
}

export function Checkbox({
  checked, onCheckedChange, label, disabled,
}: { checked: boolean; onCheckedChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("group flex items-center gap-2.5 py-1 text-sm text-ink pointer-coarse:min-h-11", row(disabled))}>
      <C.Root
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-check border-2 border-line-strong bg-surface",
          "transition-[background-color,border-color,scale] duration-150 ease-spring active:scale-90",
          "group-hover:data-[state=unchecked]:border-ink-3 data-[state=checked]:border-lapis data-[state=checked]:bg-lapis",
          "disabled:pointer-events-none",
        )}
      >
        <C.Indicator className="grid place-items-center transition-[opacity,scale] duration-(--dur-2) ease-spring starting:scale-50 starting:opacity-0">
          <Check className="size-3.5 text-on-lapis" strokeWidth={3} />
        </C.Indicator>
      </C.Root>
      <span className="min-w-0">{label}</span>
    </label>
  );
}

export function RadioGroup({
  value, onValueChange, options, className, label,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: ReactNode; disabled?: boolean }[];
  className?: string;
  /** Accessible name of the group when no visible heading labels it. */
  label?: string;
}) {
  const base = useId();
  return (
    <R.Root value={value} onValueChange={onValueChange} aria-label={label} className={cn("flex flex-col gap-0.5", className)}>
      {options.map((o) => (
        <label
          key={o.value}
          htmlFor={`${base}-${o.value}`}
          className={cn("group flex items-center gap-2.5 py-1 text-sm text-ink pointer-coarse:min-h-11", row(o.disabled))}
        >
          <R.Item
            id={`${base}-${o.value}`}
            value={o.value}
            disabled={o.disabled}
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-full border-2 border-line-strong bg-surface",
              "transition-[border-color,scale] duration-150 ease-spring active:scale-90",
              "group-hover:data-[state=unchecked]:border-ink-3 data-[state=checked]:border-lapis disabled:pointer-events-none",
            )}
          >
            <R.Indicator className="size-2.5 rounded-full bg-lapis transition-[opacity,scale] duration-(--dur-2) ease-spring starting:scale-0 starting:opacity-0" />
          </R.Item>
          <span className="min-w-0">{o.label}</span>
        </label>
      ))}
    </R.Root>
  );
}
