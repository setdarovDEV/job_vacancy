import type { HTMLAttributes, PointerEvent, ReactNode } from "react";

import { cn } from "../lib/cn";

const tones = {
  neutral: "bg-sunken text-ink-2",
  lapis: "bg-lapis-soft text-lapis-ink",
  firuza: "bg-firuza-soft text-firuza-ink",
  zafaron: "bg-zafaron-soft text-zafaron-ink",
  anor: "bg-anor-soft text-anor-ink",
  outline: "border border-line-strong text-ink-2",
} as const;

export type BadgeTone = keyof typeof tones;

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  /** Leading icon (lucide at any size is normalised to 14px). */
  icon?: ReactNode;
};

// Show the full text as a native tooltip only when it's actually cut off (checked lazily on hover).
function titleIfTruncated(e: PointerEvent<HTMLSpanElement>) {
  const el = e.currentTarget;
  el.title = el.scrollWidth > el.clientWidth ? (el.textContent ?? "") : "";
}

/** Static pill label (status, skill, "TOP"). Plain-text labels truncate within their container. */
export function Badge({ tone = "neutral", icon, className, children, title, ...props }: BadgeProps) {
  const text = typeof children === "string" || typeof children === "number";
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1 overflow-hidden whitespace-nowrap rounded-pill px-2.5 align-middle text-xs font-semibold",
        tones[tone],
        className,
      )}
      title={title}
      {...props}
    >
      {icon != null && icon !== false && (
        <span aria-hidden="true" className="grid shrink-0 place-items-center [&_svg]:size-3.5">{icon}</span>
      )}
      {text ? (
        <span className="min-w-0 truncate" onPointerEnter={title ? undefined : titleIfTruncated}>{children}</span>
      ) : (
        children
      )}
    </span>
  );
}
