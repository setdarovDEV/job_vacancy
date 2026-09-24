import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";

/**
 * Form-level error (network, conflict, rate limit) above the submit button. Announced as an
 * alert; `data-form-error` lets useSubmit scroll it into view when no field is to blame.
 */
export function FormError({ children, className }: { children?: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      data-form-error=""
      className={cn("anim-fade flex items-start gap-2.5 rounded-control bg-anor-soft px-3.5 py-3 text-sm text-anor-ink", className)}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 break-words">{children}</p>
    </div>
  );
}
