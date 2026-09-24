import { Check } from "lucide-react";

import { cn } from "~/shared/lib/cn";

/**
 * A single choice drawn as chips: native radios (one tab stop, arrow keys, a group legend),
 * styled exactly like the shared Chip so filters and forms read the same. Chips wrap by whole
 * words, which radio cards in a narrow grid can't do in every language.
 */
export function ChoiceChips<T extends string>({ name, label, value, options, onChange }: {
  name: string;
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 text-sm font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "relative inline-flex h-9 cursor-pointer select-none items-center whitespace-nowrap rounded-pill border px-3 text-sm font-medium",
                "transition-[background-color,border-color,color,scale] duration-150 ease-spring active:scale-[0.97]",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus",
                // 44px hit area on touch, same look.
                "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.25",
                on ? "border-lapis bg-lapis-soft text-lapis-ink" : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink",
              )}
            >
              <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              <span
                aria-hidden="true"
                className={cn(
                  "grid place-items-center",
                  on ? "-ml-0.5 mr-1.5 scale-100 opacity-100 transition-[opacity,scale] duration-200 ease-spring" : "w-0 scale-50 opacity-0",
                )}
              >
                <Check className="size-4 shrink-0" strokeWidth={2.5} />
              </span>
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
