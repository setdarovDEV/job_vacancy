import { ChevronDown } from "lucide-react";
import {
  forwardRef, useEffect, useId, useLayoutEffect, useRef, useState,
  type ClipboardEvent, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode,
} from "react";

import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { groupDigits } from "../lib/format";
import { fieldControl, fieldShell } from "./Field";

export type Currency = "UZS" | "USD";

const MAX_DIGITS = 12; // up to 999 999 999 999: enough for any salary in so'm
const heights = { md: "h-11 text-md", lg: "h-13 text-base" } as const;

const isDigit = (c: string | undefined) => c != null && c >= "0" && c <= "9";
const format = (v: number | null) => (v == null ? "" : groupDigits(v));

/** Index in `s` right after its n-th digit (0 → the start). */
function caretAfter(s: string, n: number) {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < s.length; i++) if (isDigit(s[i]) && ++seen === n) return i + 1;
  return s.length;
}

/** "5 000 000 so'm", "$1,200.50", "1.200.000" → the whole-number digits. */
function pastedDigits(text: string) {
  return text.trim().replace(/[.,]\d{1,2}(?!\d)\D*$/, "").replace(/\D/g, "");
}

export type MoneyInputProps = {
  /** Controlled amount (null = empty). Omit it and use `defaultValue` for an uncontrolled field. */
  value?: number | null;
  defaultValue?: number | null;
  /** Every edit, with the parsed amount. */
  onChange?: (v: number | null) => void;
  /** On blur and Enter, only when the amount changed since the last commit (URL filters). */
  onCommit?: (v: number | null) => void;
  currency?: Currency;
  /** Shows a currency switcher inside the field. */
  onCurrencyChange?: (c: Currency) => void;
  /** Renders a hidden input with the raw digits for native GET/POST forms (omitted when empty). */
  name?: string;
  /** Form name for the currency switcher's value. */
  currencyName?: string;
  /** Short text before the amount ("From"), e.g. in SalaryRange. */
  prefix?: ReactNode;
  placeholder?: string;
  size?: "md" | "lg";
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  className?: string;
};

/**
 * Amount field: digits group as you type ("5 000 000") with the caret staying put, pastes of
 * any money format are cleaned, and the numeric keypad opens on phones. Works inside Field
 * (id / aria-invalid / aria-describedby land on the visible input).
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  {
    value, defaultValue = null, onChange, onCommit, currency = "UZS", onCurrencyChange, name, currencyName, prefix,
    placeholder, size = "md", id, "aria-describedby": describedBy, disabled, onBlur, className, ...rest
  },
  forwardedRef,
) {
  const { t } = useTranslation();
  const unitId = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const controlled = value !== undefined;
  const [inner, setInner] = useState<number | null>(defaultValue);
  const current = controlled ? value : inner;

  // `text` is what the box shows; it's re-derived only when the amount changes from outside.
  const [text, setText] = useState(() => format(current));
  const [shown, setShown] = useState(current);
  if (current !== shown) {
    setShown(current);
    setText(format(current));
  }
  // A re-render after every edit, so the caret is restored even when the text didn't change.
  const [, setEdits] = useState(0);
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = input.current;
    if (caret.current != null && el && document.activeElement === el) el.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  const committed = useRef(current);
  useEffect(() => {
    if (document.activeElement !== input.current) committed.current = current;
  }, [current]);
  const commit = () => {
    if (current === committed.current) return;
    committed.current = current;
    onCommit?.(current);
  };

  // Rebuilds the box from raw text: keeps the digits, remembers how many sat before the caret.
  const apply = (raw: string, rawCaret: number) => {
    let digits = "";
    let before = 0;
    for (let i = 0; i < raw.length; i++) {
      if (!isDigit(raw[i])) continue;
      digits += raw[i];
      if (i < rawCaret) before++;
    }
    const zeros = digits.length - digits.replace(/^0+(?=\d)/, "").length;
    digits = digits.slice(zeros, zeros + MAX_DIGITS);
    before = Math.min(Math.max(0, before - zeros), digits.length);
    const next = digits ? Number(digits) : null;
    const nextText = format(next);
    caret.current = caretAfter(nextText, before);
    setText(nextText);
    setShown(next);
    setEdits((n) => n + 1);
    if (!controlled) setInner(next);
    if (next !== current) onChange?.(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onCommit) {
      e.preventDefault();
      commit();
      return;
    }
    const el = e.currentTarget;
    const at = el.selectionStart ?? 0;
    if (at !== el.selectionEnd) return;
    // Backspace / Delete next to a group space removes the digit beyond it, not the space.
    if (e.key === "Backspace" && at > 0 && !isDigit(text[at - 1])) {
      let j = at - 1;
      while (j >= 0 && !isDigit(text[j])) j--;
      if (j >= 0) {
        e.preventDefault();
        apply(text.slice(0, j) + text.slice(j + 1), j);
      }
    } else if (e.key === "Delete" && at < text.length && !isDigit(text[at])) {
      let j = at;
      while (j < text.length && !isDigit(text[j])) j++;
      if (j < text.length) {
        e.preventDefault();
        apply(text.slice(0, j) + text.slice(j + 1), at);
      }
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const d = pastedDigits(e.clipboardData.getData("text"));
    const el = e.currentTarget;
    const a = el.selectionStart ?? text.length;
    const b = el.selectionEnd ?? text.length;
    apply(text.slice(0, a) + d + text.slice(b), a + d.length);
  };

  // Presses on the prefix, unit or padding focus the amount, as in a native input box.
  const focusInput = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input, select, button")) return;
    e.preventDefault();
    input.current?.focus();
  };

  const setRef = (el: HTMLInputElement | null) => {
    input.current = el;
    if (typeof forwardedRef === "function") forwardedRef(el);
    else if (forwardedRef) forwardedRef.current = el;
  };

  return (
    <div className={cn(fieldShell, "relative flex cursor-text items-center", heights[size], className)} onMouseDown={focusInput}>
      {prefix != null && (
        <span aria-hidden="true" className="shrink-0 pl-3.5 text-sm text-ink-3">{prefix}</span>
      )}
      <input
        ref={setRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={[describedBy, !onCurrencyChange && unitId].filter(Boolean).join(" ") || undefined}
        onChange={(e) => apply(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={(e) => {
          commit();
          onBlur?.(e);
        }}
        className={cn(fieldControl, "num h-full flex-1 rounded-control pr-2", prefix != null ? "pl-2" : "pl-3.5")}
        {...rest}
      />
      {onCurrencyChange ? (
        <span className="relative flex h-full shrink-0 items-center pr-1">
          <select
            name={currencyName}
            value={currency}
            disabled={disabled}
            aria-label={t("inputs.currency")}
            onChange={(e) => onCurrencyChange(e.target.value as Currency)}
            className="h-full cursor-pointer appearance-none rounded-control bg-transparent pl-2.5 pr-7 text-sm font-medium text-ink-2 outline-hidden transition-colors duration-150 hover:text-ink focus-visible:bg-sunken focus-visible:text-ink"
          >
            <option value="UZS">{t("salary.currency.UZS")}</option>
            <option value="USD">{t("salary.currency.USD")}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-ink-3" aria-hidden="true" />
        </span>
      ) : (
        <span id={unitId} className="shrink-0 pr-3.5 text-sm text-ink-3">{t(`salary.currency.${currency}`)}</span>
      )}
      {/* Nameless while empty, so GET forms don't add "salary=" (and no :disabled for the shell to pick up). */}
      {name && <input type="hidden" name={current == null ? undefined : name} value={current ?? ""} />}
    </div>
  );
});
