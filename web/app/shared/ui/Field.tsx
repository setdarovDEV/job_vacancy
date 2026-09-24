import { CircleAlert, CircleCheck } from "lucide-react";
import {
  cloneElement, forwardRef, isValidElement, useId, useState,
  type InputHTMLAttributes, type ReactElement, type ReactNode, type TextareaHTMLAttributes,
} from "react";

import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { groupDigits } from "../lib/format";

/**
 * The box every text-like control sits in. `field-shell` (app.css) owns border, hover, focus ring
 * and the invalid state (it reacts to an aria-invalid control inside), so controls stay bare.
 */
export const fieldShell =
  "field-shell text-ink has-disabled:cursor-not-allowed has-disabled:bg-sunken has-disabled:opacity-60";

/** The bare control inside a field-shell: transparent, no own outline (the shell shows focus). */
export const fieldControl =
  "min-w-0 bg-transparent text-ink outline-hidden placeholder:text-ink-3 disabled:cursor-not-allowed";

const heights = { md: "h-11 text-md", lg: "h-13 text-base" } as const;

const joinIds = (...ids: (string | undefined | false)[]) => ids.filter(Boolean).join(" ") || undefined;

type FieldChildProps = { id?: string; "aria-invalid"?: boolean | "true" | "false"; "aria-describedby"?: string };

type FieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: string; // e.g. t("common.optional")
  /** Positive confirmation under the control (e.g. "Available"), shown when there's no error or hint. */
  success?: ReactNode;
  className?: string;
  children: ReactElement<FieldChildProps>;
};

/** Label + control + hint/error, wired together for screen readers. An error replaces the hint. */
export function Field({ label, hint, error, optional, success, className, children }: FieldProps) {
  const genId = useId();
  const child = isValidElement(children) ? children : null;
  const id = child?.props.id ?? genId;
  const msgId = `${id}-msg`;
  const hasMessage = Boolean(error || hint || success);
  const control = child
    ? cloneElement(child, {
        id,
        "aria-invalid": error ? true : child.props["aria-invalid"],
        "aria-describedby": joinIds(child.props["aria-describedby"], hasMessage && msgId),
      })
    : children;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {optional && <span className="ml-1.5 font-normal text-ink-3">{optional}</span>}
        </label>
      )}
      {control}
      {error ? (
        <p id={msgId} role="alert" className="anim-fade flex items-start gap-1.5 text-sm text-anor-ink">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      ) : hint ? (
        <p id={msgId} className="break-words text-sm text-ink-2">{hint}</p>
      ) : success ? (
        <p id={msgId} className="anim-fade flex items-start gap-1.5 text-sm text-firuza-ink">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{success}</span>
        </p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Decorative icon/text inside the box, before the text (clicks pass through to the input). */
  leading?: ReactNode;
  /** Interactive slot after the text (a show-password toggle, a unit, a clear button). */
  trailing?: ReactNode;
  inputSize?: "md" | "lg";
  /** Classes for the <input> itself; `className` styles the field-shell box around it. */
  inputClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leading, trailing, inputSize = "md", className, inputClassName, ...props },
  ref,
) {
  return (
    <div className={cn(fieldShell, "relative flex items-center", heights[inputSize], className)}>
      {leading && <span className="pointer-events-none absolute left-3.5 flex text-ink-3">{leading}</span>}
      <input
        ref={ref}
        className={cn(fieldControl, "h-full flex-1 rounded-control px-3.5", leading && "pl-10.5", trailing && "pr-1", inputClassName)}
        {...props}
      />
      {trailing && <span className="flex h-full shrink-0 items-center pr-1">{trailing}</span>}
    </div>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Classes for the <textarea> itself; `className` styles the field-shell box around it. */
  textareaClassName?: string;
  /** "12 / 3 000" counter under the text; on by default whenever maxLength is set. */
  counter?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, textareaClassName, rows = 4, counter = true, maxLength, value, defaultValue, onChange, style, ...props },
  ref,
) {
  const { t } = useTranslation();
  // Uncontrolled textareas still get a live counter.
  const [typed, setTyped] = useState(() => String(defaultValue ?? "").length);
  const length = value !== undefined ? String(value ?? "").length : typed;
  const max = counter && maxLength != null && maxLength > 0 ? maxLength : null;
  const near = max != null && length >= max * 0.95;
  return (
    <div className={cn(fieldShell, "flex flex-col text-md", className)}>
      <textarea
        ref={ref}
        rows={rows}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => {
          if (value === undefined) setTyped(e.target.value.length);
          onChange?.(e);
        }}
        // field-sizing grows the box with its content where supported, starting at `rows`
        // lines; elsewhere the rows attribute sizes it. Very long text scrolls inside, and
        // wrap-anywhere keeps an unbroken string (a URL) from widening the layout.
        style={{ minHeight: `calc(${rows}lh + 1.25rem)`, ...style }}
        className={cn(
          fieldControl,
          "max-h-[70dvh] w-full resize-y rounded-control px-3.5 py-2.5 leading-relaxed wrap-anywhere [field-sizing:content]",
          textareaClassName,
        )}
        {...props}
      />
      {max != null && (
        <>
          <p aria-hidden="true" className={cn("num -mt-1 px-3.5 pb-2 text-right text-xs transition-colors", near ? "text-anor-ink" : "text-ink-3")}>
            {groupDigits(length)} / {groupDigits(max)}
          </p>
          {/* Screen readers hear the count only when it matters: close to the limit. */}
          <span className="sr-only" aria-live="polite">
            {near ? t("inputs.charsLeft", { count: Math.max(0, max - length) }) : ""}
          </span>
        </>
      )}
    </div>
  );
});
