import {
  forwardRef, useId, useLayoutEffect, useRef, useState,
  type ClipboardEvent, type FocusEvent, type KeyboardEvent, type MouseEvent,
} from "react";

import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { fieldControl, fieldShell } from "./Field";

const CODE = "+998";
const NATIONAL = 9; // (90) 123-45-67
const heights = { md: "h-11 text-md", lg: "h-13 text-base" } as const;

const isDigit = (c: string | undefined) => c != null && c >= "0" && c <= "9";

/** National digits from anything people paste or autofill: "+998 90 123 45 67", "00998…", "90 123-45-67". */
function nationalDigits(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.length >= 14 && d.startsWith("00998")) d = d.slice(5);
  else if (d.length >= 12 && d.startsWith("998")) d = d.slice(3);
  return d.slice(0, NATIONAL);
}

/** The national part of a stored value ("+99890…" while typing, or a full E.164 number). */
function fromValue(v: string) {
  return v.startsWith(CODE) ? v.slice(CODE.length).replace(/\D/g, "").slice(0, NATIONAL) : nationalDigits(v);
}

/** "901234567" → "(90) 123-45-67", growing as digits arrive. */
function mask(d: string) {
  if (!d) return "";
  let s = `(${d.slice(0, 2)}`;
  if (d.length > 2) s += `) ${d.slice(2, 5)}`;
  if (d.length > 5) s += `-${d.slice(5, 7)}`;
  if (d.length > 7) s += `-${d.slice(7, 9)}`;
  return s;
}

/** Index in `s` right after its n-th digit (0 → before the first digit). */
function caretAfter(s: string, n: number) {
  let seen = 0;
  for (let i = 0; i < s.length; i++) {
    if (!isDigit(s[i])) continue;
    if (seen === n) return i;
    seen++;
  }
  return s.length;
}

export type PhoneInputProps = {
  /** E.164 (+998901234567), a partial "+99890…" while typing, or "". */
  value: string;
  onChange: (e164: string) => void;
  /** Renders a hidden input with the E.164 value for native forms. */
  name?: string;
  id?: string;
  placeholder?: string;
  size?: "md" | "lg";
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
 * Uzbek phone number: a fixed +998 prefix and a (XX) XXX-XX-XX mask. Any pasted or autofilled
 * format is normalised; the value is E.164. Complete when `value.length === 13`.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { value, onChange, name, placeholder = "(90) 123-45-67", size = "md", id, "aria-describedby": describedBy, disabled, className, ...rest },
  forwardedRef,
) {
  const { t } = useTranslation();
  const codeId = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const [text, setText] = useState(() => mask(fromValue(value)));
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(mask(fromValue(value)));
  }
  const [, setEdits] = useState(0);
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = input.current;
    if (caret.current != null && el && document.activeElement === el) el.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  const apply = (raw: string, rawCaret: number) => {
    const all = raw.replace(/\D/g, "");
    let digits: string;
    let before: number;
    if (all.length > NATIONAL) {
      // A whole number arrived (autofill, paste over the field): normalise, caret to the end.
      digits = nationalDigits(raw);
      before = digits.length;
    } else {
      digits = all;
      before = raw.slice(0, rawCaret).replace(/\D/g, "").length;
    }
    const next = digits ? CODE + digits : "";
    const nextText = mask(digits);
    caret.current = caretAfter(nextText, Math.min(before, digits.length));
    setText(nextText);
    setShown(next);
    setEdits((n) => n + 1);
    if (next !== value) onChange(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const at = el.selectionStart ?? 0;
    if (at !== el.selectionEnd) return;
    // Backspace / Delete next to "(", ")", " " or "-" removes the digit beyond it.
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
    const pasted = e.clipboardData.getData("text");
    const el = e.currentTarget;
    // A full number replaces the field; a few digits go where the caret is.
    if (pasted.replace(/\D/g, "").length >= NATIONAL) return apply(pasted, pasted.length);
    const d = pasted.replace(/\D/g, "");
    const a = el.selectionStart ?? text.length;
    const b = el.selectionEnd ?? text.length;
    apply(text.slice(0, a) + d + text.slice(b), a + d.length);
  };

  const focusInput = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input")) return;
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
      <span aria-hidden="true" className="num shrink-0 pl-3.5 text-ink-2">{CODE}</span>
      <span id={codeId} className="sr-only">{t("inputs.phoneCountry")}</span>
      <input
        ref={setRef}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        // Native validation: a started number must be complete.
        pattern={"\\(\\d{2}\\) \\d{3}-\\d{2}-\\d{2}"}
        aria-describedby={[describedBy, codeId].filter(Boolean).join(" ")}
        onChange={(e) => apply(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className={cn(fieldControl, "num h-full flex-1 rounded-control pl-2 pr-3.5")}
        {...rest}
      />
      {name && <input type="hidden" name={value ? name : undefined} value={value} />}
    </div>
  );
});
