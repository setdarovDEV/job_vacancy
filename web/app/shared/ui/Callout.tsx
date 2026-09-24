import { CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

const tones = {
  info: { box: "bg-lapis-soft text-lapis-ink", Icon: Info },
  success: { box: "bg-firuza-soft text-firuza-ink", Icon: CircleCheck },
  warning: { box: "bg-zafaron-soft text-zafaron-ink", Icon: TriangleAlert },
  danger: { box: "bg-anor-soft text-anor-ink", Icon: OctagonAlert },
} as const;

/**
 * Inline notice inside content: moderation status, fuzzy-search hint, "unverified company".
 * Static by default; pass role="status" / role="alert" when it appears in response to an action.
 */
export function Callout({
  tone = "info", title, children, action, icon, className, ...props
}: {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  /** Replaces the tone icon. */
  icon?: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "title" | "children">) {
  const { box, Icon } = tones[tone];
  return (
    <div
      className={cn(
        // A faint currentColor edge keeps the soft fill distinct from the card in dark mode.
        "flex flex-col gap-3 rounded-panel border border-current/15 p-4 sm:flex-row sm:items-start",
        box,
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <span aria-hidden="true" className="mt-0.5 shrink-0 [&_svg]:size-5">{icon ?? <Icon />}</span>
        <div className="min-w-0 flex-1 break-words text-md">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={cn(title && "mt-0.5", "[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-3")}>{children}</div>}
        </div>
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2 pl-8 sm:pl-0">{action}</div>}
    </div>
  );
}
