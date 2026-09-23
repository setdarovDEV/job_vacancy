import { useId } from "react";

import { cn } from "../lib/cn";

/**
 * One input for a 6-digit code, drawn as six cells. A single real input keeps paste,
 * SMS/email autofill (autocomplete=one-time-code) and screen readers working.
 */
export function CodeInput({
  value, onChange, onComplete, label, length = 6,
}: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; label: string; length?: number }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="relative">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={length}
          autoFocus
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, length);
            onChange(v);
            if (v.length === length) onComplete?.(v);
          }}
          className="peer absolute inset-0 z-10 w-full cursor-text text-transparent caret-transparent opacity-0"
        />
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }} aria-hidden="true">
          {Array.from({ length }, (_, i) => {
            const active = i === Math.min(value.length, length - 1);
            return (
              <div
                key={i}
                className={cn(
                  "num grid h-14 place-items-center rounded-control border bg-surface font-display text-2xl font-semibold transition-[border-color,box-shadow]",
                  "border-line-strong peer-focus:[&.is-active]:border-lapis peer-focus:[&.is-active]:shadow-[0_0_0_4px_var(--lapis-soft)]",
                  active && "is-active",
                )}
              >
                {value[i] ?? ""}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
