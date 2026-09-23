import {
  cloneElement, forwardRef, isValidElement, useId,
  type InputHTMLAttributes, type ReactElement, type ReactNode, type TextareaHTMLAttributes,
} from "react";

import { cn } from "../lib/cn";

const control =
  "w-full rounded-control border border-line-strong bg-surface text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 " +
  "outline-none focus:border-lapis focus:shadow-[0_0_0_4px_var(--lapis-soft)] " +
  "disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3 " +
  "aria-[invalid=true]:border-anor aria-[invalid=true]:focus:shadow-[0_0_0_4px_var(--anor-soft)]";

type FieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: string; // e.g. t("common.optional")
  className?: string;
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
};

/** Label + control + hint/error, wired together for screen readers. */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? msgId : undefined,
      })
    : children;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {optional && <span className="ml-1.5 font-normal text-ink-3">{optional}</span>}
        </label>
      )}
      {control}
      {(error || hint) && (
        <p id={msgId} className={cn("text-xs", error ? "text-anor-ink" : "text-ink-3")} role={error ? "alert" : undefined}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  leading?: ReactNode;
  trailing?: ReactNode;
  inputSize?: "md" | "lg";
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leading, trailing, inputSize = "md", className, ...props },
  ref,
) {
  const h = inputSize === "lg" ? "h-13 text-base" : "h-11 text-[0.9375rem]";
  if (!leading && !trailing) {
    return <input ref={ref} className={cn(control, h, "px-3.5", className)} {...props} />;
  }
  return (
    <div className={cn("relative flex items-center", className)}>
      {leading && <span className="pointer-events-none absolute left-3.5 flex text-ink-3">{leading}</span>}
      <input ref={ref} className={cn(control, h, leading ? "pl-10.5" : "pl-3.5", trailing ? "pr-11" : "pr-3.5")} {...props} />
      {trailing && <span className="absolute right-1.5 flex">{trailing}</span>}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    // field-sizing grows the box with its content where supported; rows is the fallback.
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(control, "min-h-24 resize-y px-3.5 py-2.5 text-[0.9375rem] leading-relaxed [field-sizing:content]", className)}
        {...props}
      />
    );
  },
);
