import { useState } from "react";

import { cn } from "../lib/cn";

// Deterministic tint per name, from the brand palette (never the error red).
const tints = [
  "bg-lapis-soft text-lapis-ink", "bg-firuza-soft text-firuza-ink", "bg-zafaron-soft text-zafaron-ink",
  "bg-sunken text-ink-2",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.codePointAt(0)!) | 0;
  return Math.abs(h);
}

const sizes = { xs: "size-6 text-[0.625rem]", sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg", xl: "size-20 text-2xl" };

/** Person or company picture with an initials fallback. square=true for company logos. */
export function Avatar({
  name, src, size = "md", square, className,
}: { name: string; src?: string | null; size?: keyof typeof sizes; square?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  const shape = square ? "rounded-[28%]" : "rounded-full";
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn("shrink-0 bg-sunken object-cover", sizes[size], shape, className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("inline-grid shrink-0 place-items-center font-display font-semibold", sizes[size], shape, tints[hash(name) % tints.length], className)}
    >
      {initials(name)}
    </span>
  );
}
