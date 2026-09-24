import { useState, type CSSProperties } from "react";

import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { groupDigits } from "../lib/format";

// Deterministic tint per name, from the brand palette (never the error red).
const tints = [
  "bg-lapis-soft text-lapis-ink", "bg-firuza-soft text-firuza-ink", "bg-zafaron-soft text-zafaron-ink",
  "bg-sunken text-ink-2",
];

function initials(name: string, letters: 1 | 2 = 2) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (letters > 1 && parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.codePointAt(0)!) | 0;
  return Math.abs(h);
}

// px = the intrinsic width/height attributes (reserve the box before the image arrives: no CLS).
const sizes = {
  xs: { box: "size-6 text-2xs", px: 24, pad: "p-0.5" },
  sm: { box: "size-8 text-xs", px: 32, pad: "p-1" },
  md: { box: "size-10 text-sm", px: 40, pad: "p-1.5" },
  lg: { box: "size-14 text-lg", px: 56, pad: "p-2" },
  xl: { box: "size-20 text-2xl", px: 80, pad: "p-2.5" },
} as const;

export type AvatarSize = keyof typeof sizes;

export type AvatarProps = {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  /** Company logo: rounded square, logo shown whole (object-contain) on a bordered surface tile. */
  square?: boolean;
  /**
   * Accessible name. Leave empty (default) when the name is printed next to the picture;
   * pass the person/company name when the picture is the only thing identifying them.
   */
  alt?: string;
  /** Above-the-fold picture (profile header, company page): load eagerly with high priority. */
  priority?: boolean;
  className?: string;
  /** e.g. { viewTransitionName } for list → detail transitions. */
  style?: CSSProperties;
  /** Letters in the initials fallback (default 2). */
  letters?: 1 | 2;
};

/** Person or company picture with an initials fallback. square=true for company logos. */
export function Avatar({ name, src, size = "md", square, alt = "", priority, className, style, letters }: AvatarProps) {
  // Remember which src failed, so a new src (fresh upload) gets another chance.
  const [failed, setFailed] = useState<string | null>(null);
  const s = sizes[size];
  const shape = square ? (size === "lg" || size === "xl" ? "rounded-panel" : "rounded-control") : "rounded-full";

  if (src && failed !== src) {
    return (
      <img
        // An image that failed before hydration never fires onError in React: check on mount.
        // decode() tells broken files apart from SVGs that simply have no intrinsic size.
        ref={(el) => {
          if (el?.complete && el.naturalWidth === 0) el.decode().catch(() => setFailed(src));
        }}
        src={src}
        alt={alt}
        width={s.px}
        height={s.px}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        onError={() => setFailed(src)}
        className={cn(
          "shrink-0",
          s.box,
          shape,
          square ? cn("border border-line bg-surface object-contain", s.pad) : "bg-sunken object-cover",
          className,
        )}
        style={style}
      />
    );
  }
  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn(
        "inline-grid shrink-0 select-none place-items-center font-display font-semibold leading-none",
        s.box,
        shape,
        tints[hash(name) % tints.length],
        className,
      )}
      style={style}
    >
      {initials(name, letters)}
    </span>
  );
}

// ~15–20% overlap: enough to read as a group while initials stay legible.
const overlap = { xs: "-space-x-1", sm: "-space-x-1.5", md: "-space-x-2" } as const;
// The wide display face needs one step smaller initials so the next face doesn't cover them;
// at xs there is no smaller step, so those faces show a single letter.
const groupText = { xs: "", sm: "text-2xs", md: "text-xs" } as const;
const bubble = { xs: "h-6 min-w-6 px-1 text-2xs", sm: "h-8 min-w-8 px-1.5 text-xs", md: "h-10 min-w-10 px-2 text-sm" } as const;

/** Overlapping faces ("who applied", team members) with a "+N" bubble for the rest. */
export function AvatarGroup({
  items, max = 4, size = "sm", label, className,
}: {
  items: { name: string; src?: string | null }[];
  /** Faces shown before the "+N" bubble. */
  max?: number;
  size?: "xs" | "sm" | "md";
  /** Optional accessible name for the list, e.g. t("employer.team"). */
  label?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const shown = items.slice(0, Math.max(0, max));
  const rest = items.length - shown.length;
  return (
    <ul aria-label={label} className={cn("flex items-center", overlap[size], className)}>
      {shown.map((it, i) => (
        <li key={`${i}-${it.name}`} className="shrink-0" title={it.name}>
          {/* Faces are the only identification here, so each one is named. */}
          <Avatar name={it.name} src={it.src} size={size} alt={it.name} letters={size === "xs" ? 1 : 2} className={cn("ring-2 ring-surface", groupText[size])} />
        </li>
      ))}
      {rest > 0 && (
        <li className="shrink-0">
          <span
            className={cn(
              "num inline-grid place-items-center rounded-pill bg-sunken font-semibold text-ink-2 ring-2 ring-surface",
              bubble[size],
            )}
          >
            <span aria-hidden="true">+{groupDigits(rest)}</span>
            <span className="sr-only">{t("controls.moreCount", { count: rest })}</span>
          </span>
        </li>
      )}
    </ul>
  );
}
