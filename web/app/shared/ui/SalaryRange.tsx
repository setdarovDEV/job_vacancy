import { CircleAlert } from "lucide-react";
import { useId, type ReactNode } from "react";

import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { MoneyInput, type Currency } from "./MoneyInput";

type Range = { from: number | null; to: number | null };

export type SalaryRangeProps = {
  from: number | null;
  to: number | null;
  onChange: (v: Range) => void;
  /** Blur / Enter on either field, only when that field changed (URL filters). */
  onCommit?: (v: Range) => void;
  currency?: Currency;
  /** Shows a so'm / $ switch above the fields. */
  onCurrencyChange?: (c: Currency) => void;
  nameFrom?: string;
  nameTo?: string;
  /** Form name for the currency switch (radio inputs). */
  nameCurrency?: string;
  /** Short prefixes inside the fields, also their accessible names. Default "From" / "To". */
  labelFrom?: string;
  labelTo?: string;
  /** Visible group label ("Salary"); names the group for screen readers. */
  legend?: ReactNode;
  /** Server-side error for the pair (the inline from ≤ to check wins). */
  error?: ReactNode;
  size?: "md" | "lg";
  disabled?: boolean;
  className?: string;
};

/**
 * Salary from–to: two MoneyInputs side by side (stacked when the container is narrower than
 * 20rem), an inline "from ≤ to" check and optional currency switch.
 */
export function SalaryRange({
  from, to, onChange, onCommit, currency = "UZS", onCurrencyChange, nameFrom, nameTo, nameCurrency,
  labelFrom, labelTo, legend, error, size = "md", disabled, className,
}: SalaryRangeProps) {
  const { t } = useTranslation();
  const id = useId();
  const legendId = `${id}-legend`;
  const errId = `${id}-err`;
  const inverted = from != null && to != null && from > to;
  const message = inverted ? t("validation.gtefield") : error;
  const fromLabel = labelFrom ?? t("inputs.from");
  const toLabel = labelTo ?? t("inputs.to");

  return (
    <div
      role={legend ? "group" : undefined}
      aria-labelledby={legend ? legendId : undefined}
      className={cn("flex w-full min-w-0 flex-col gap-2", className)}
    >
      {(legend != null || onCurrencyChange) && (
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          {legend != null ? <span id={legendId} className="text-sm font-medium text-ink">{legend}</span> : <span />}
          {onCurrencyChange && (
            <CurrencySwitch value={currency} onChange={onCurrencyChange} name={nameCurrency ?? `${id}-currency`} disabled={disabled} />
          )}
        </div>
      )}
      {/* Container query: stacks in narrow sidebars / phones under 360px, side by side otherwise. */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-2 @xs:grid-cols-2">
          <MoneyInput
            value={from}
            onChange={(v) => onChange({ from: v, to })}
            onCommit={onCommit && ((v) => onCommit({ from: v, to }))}
            currency={currency}
            name={nameFrom}
            prefix={fromLabel}
            aria-label={fromLabel}
            size={size}
            disabled={disabled}
          />
          <MoneyInput
            value={to}
            onChange={(v) => onChange({ from, to: v })}
            onCommit={onCommit && ((v) => onCommit({ from, to: v }))}
            currency={currency}
            name={nameTo}
            prefix={toLabel}
            aria-label={toLabel}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? errId : undefined}
            size={size}
            disabled={disabled}
          />
        </div>
      </div>
      {message && (
        <p id={errId} role="alert" className="anim-fade flex items-start gap-1.5 text-sm text-anor-ink">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{message}</span>
        </p>
      )}
    </div>
  );
}

/** so'm | $ as a two-option radio group (native radios: arrow keys and form values for free). */
function CurrencySwitch({ value, onChange, name, disabled }: { value: Currency; onChange: (c: Currency) => void; name: string; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={t("inputs.currency")} className="inline-flex rounded-pill bg-sunken p-0.5">
      {(["UZS", "USD"] as const).map((c) => (
        <label key={c} className="relative cursor-pointer has-disabled:cursor-not-allowed has-disabled:opacity-50">
          <input
            type="radio"
            name={name}
            value={c}
            checked={value === c}
            disabled={disabled}
            onChange={() => onChange(c)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "grid h-8 min-w-11 place-items-center rounded-pill px-3 text-sm font-medium text-ink-2 transition-[background-color,color,box-shadow] duration-150 pointer-coarse:h-10",
              "hover:text-ink peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-1",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-focus",
            )}
          >
            {t(`salary.currency.${c}`)}
          </span>
        </label>
      ))}
    </div>
  );
}
