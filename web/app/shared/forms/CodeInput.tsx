import { useId } from "react";

import { cn } from "../lib/cn";

type CodeInputProps = {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  label: string;
  length?: number;
  id?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
};

/**
 * One input for a 6-digit code, drawn as six large cells. A single real input keeps paste,
 * SMS/email autofill (autocomplete=one-time-code) and screen readers working; a paste of
 * "Your code: 123 456" fills every cell at once.
 */
export function CodeInput({
  value, onChange, onComplete, label, length = 6, id: idProp, autoFocus = true, disabled,
  "aria-invalid": invalid, "aria-describedby": describedBy,
}: CodeInputProps) {
  const genId = useId();
  const id = idProp ?? genId;
  const bad = invalid === true || invalid === "true";
  const set = (raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, length);
    if (v === value) return;
    onChange(v);
    if (v.length === length) onComplete?.(v);
  };
  return (
    <div className="group relative">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        autoFocus={autoFocus}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        value={value}
        // No maxLength: the browser would cut "123 456" to "123 45" before we strip the space.
        onChange={(e) => set(e.target.value)}
        onPaste={(e) => {
          e.preventDefault();
          set(e.clipboardData.getData("text"));
        }}
        className="absolute inset-0 z-10 size-full cursor-text text-transparent caret-transparent opacity-0 outline-hidden disabled:cursor-not-allowed"
      />
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }} aria-hidden="true">
        {Array.from({ length }, (_, i) => {
          const active = i === Math.min(value.length, length - 1);
          const digit = value[i];
          return (
            <div
              key={i}
              className={cn(
                "num grid h-14 place-items-center rounded-control border bg-surface font-display text-xl font-semibold text-ink",
                "transition-[border-color,box-shadow] duration-150 group-has-disabled:bg-sunken group-has-disabled:opacity-60",
                bad ? "border-anor" : digit ? "border-ink-3" : "border-line-strong",
                active && (bad ? "group-focus-within:shadow-ring-danger" : "group-focus-within:border-focus group-focus-within:shadow-ring"),
              )}
            >
              {digit ?? (active && <span className="hidden h-6 w-0.5 animate-pulse rounded-pill bg-lapis group-focus-within:block" />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
