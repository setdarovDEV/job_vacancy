import type { HTMLAttributes } from "react";

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

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium whitespace-nowrap", tones[tone], className)}
      {...props}
    />
  );
}
