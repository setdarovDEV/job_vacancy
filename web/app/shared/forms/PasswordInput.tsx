import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";

import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { Input } from "../ui/Field";

const LEVELS = ["", "weak", "fair", "good", "strong"] as const;
const BAR = ["", "bg-anor", "bg-zafaron", "bg-firuza", "bg-firuza"] as const;
const TEXT = ["", "text-anor-ink", "text-zafaron-ink", "text-firuza-ink", "text-firuza-ink"] as const;

/**
 * A rough 0–4 score that matches what we ask for (8+ characters, letters and digits) and
 * rewards length and variety. No dictionary: the server's rules stay the real check.
 */
export function passwordStrength(p: string): 0 | 1 | 2 | 3 | 4 {
  if (!p) return 0;
  const kinds = [/\p{Ll}/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}]/u].filter((r) => r.test(p)).length;
  if (p.length < 8 || kinds < 2) return 1;
  const long = p.length >= 12;
  const varied = kinds >= 3;
  return (2 + (long || varied ? 1 : 0) + (long && varied ? 1 : 0)) as 2 | 3 | 4;
}

type PasswordInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Strength meter under the field (register, new password): 4 segments + a spoken level. */
  strength?: boolean;
  inputSize?: "md" | "lg";
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { strength, className, onChange, disabled, "aria-describedby": describedBy, ...props },
  ref,
) {
  const { t } = useTranslation();
  const meterId = useId();
  const [show, setShow] = useState(false);
  // Uncontrolled use still drives the meter.
  const [typed, setTyped] = useState(() => String(props.defaultValue ?? ""));
  const current = props.value !== undefined ? String(props.value ?? "") : typed;
  const level = strength ? passwordStrength(current) : 0;

  const input = (
    <Input
      ref={ref}
      type={show ? "text" : "password"}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      disabled={disabled}
      aria-describedby={[describedBy, strength && meterId].filter(Boolean).join(" ") || undefined}
      onChange={(e) => {
        if (props.value === undefined) setTyped(e.target.value);
        onChange?.(e);
      }}
      className={strength ? undefined : className}
      trailing={
        <button
          type="button"
          disabled={disabled}
          // Keep focus (and the caret) in the field when toggling with a pointer.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShow((v) => !v)}
          // The name says what a press does ("Hide password" while shown), no aria-pressed on top.
          aria-label={show ? t("form.hidePassword") : t("form.showPassword")}
          title={show ? t("form.hidePassword") : t("form.showPassword")}
          className={cn(
            "relative grid h-full w-11 place-items-center rounded-control text-ink-3 transition-colors duration-150 hover:text-ink",
            "focus-visible:-outline-offset-2 disabled:pointer-events-none",
            // 42px inside the 44px shell: the hit area reaches the full 44px.
            "after:absolute after:inset-x-0 after:-inset-y-px",
          )}
        >
          {show ? <EyeOff className="size-4.5" aria-hidden="true" /> : <Eye className="size-4.5" aria-hidden="true" />}
        </button>
      }
      {...props}
    />
  );
  if (!strength) return input;

  const name = LEVELS[level];
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {input}
      {/* Always rendered (empty until typing starts), so nothing below jumps. */}
      <div className="flex h-5 items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className="relative h-1.5 overflow-hidden rounded-pill bg-line">
              <span
                className={cn(
                  "absolute inset-0 origin-left rounded-pill transition-transform duration-300 ease-out-quint",
                  BAR[level],
                  level >= i ? "scale-x-100" : "scale-x-0",
                )}
              />
            </span>
          ))}
        </div>
        <span aria-hidden="true" className={cn("shrink-0 text-xs font-medium first-letter:uppercase", TEXT[level])}>
          {name && t(`inputs.strengthLevels.${name}`)}
        </span>
        <span id={meterId} className="sr-only" aria-live="polite">
          {name && t("inputs.strength", { level: t(`inputs.strengthLevels.${name}`) })}
        </span>
      </div>
    </div>
  );
});
