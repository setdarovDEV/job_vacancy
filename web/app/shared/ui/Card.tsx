import type { ComponentPropsWithRef, ElementType, HTMLAttributes, ReactNode } from "react";
import type { LinkProps } from "react-router";

import { LocalizedLink } from "../i18n/hooks";
import { cn } from "../lib/cn";

const paddings = { none: "", sm: "p-4", md: "p-5 md:p-6", lg: "p-6 md:p-8" } as const;
// The radius is a prop (not a className override) so every card picks from the three
// system radii.
const radii = { control: "rounded-control", panel: "rounded-panel", sheet: "rounded-sheet" } as const;

type CardOwnProps = {
  /** "solid" (default) for content; "glass" only for tiles floating over the aurora. */
  material?: "solid" | "glass";
  /** Hover lift + press. Put exactly one <CardLink> inside so the whole card is the target. */
  interactive?: boolean;
  padding?: keyof typeof paddings;
  /** Default "panel"; "sheet" for page-level header cards and editors. */
  radius?: keyof typeof radii;
  className?: string;
  children?: ReactNode;
};

export type CardProps<E extends ElementType = "div"> = CardOwnProps & { as?: E } &
  Omit<ComponentPropsWithRef<E>, keyof CardOwnProps | "as">;

/**
 * The one card surface. Solid cards carry all dense content (rows, forms, descriptions);
 * glass cards are for stat tiles and badges over the aurora only (never nested in glass).
 */
export function Card<E extends ElementType = "div">({
  as, material = "solid", interactive, padding = "md", radius = "panel", className, children, ...rest
}: CardProps<E>) {
  const Comp: ElementType = as ?? "div";
  return (
    <Comp
      className={cn(
        material === "glass" ? "glass-panel" : "surface-card",
        radii[radius],
        paddings[padding],
        interactive && (material === "glass" ? "glass-interactive" : "surface-card-interactive relative"),
        // A CardLink inside makes the card its containing block, and its keyboard focus rings
        // the whole card (the link hides its own outline).
        "has-[[data-card-link]]:relative has-[[data-card-link]:focus-visible]:outline-2",
        "has-[[data-card-link]:focus-visible]:outline-offset-2 has-[[data-card-link]:focus-visible]:outline-focus",
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/**
 * The card's single primary link, stretched over the whole card (`after:inset-0`). Secondary
 * buttons inside the card need `relative z-10` to stay clickable above it. Only inside a Card
 * (it draws the focus ring); solid cards only, since glass owns its ::after layer.
 */
export function CardLink({ to, className, children, ...props }: Omit<LinkProps, "to"> & { to: string }) {
  return (
    <LocalizedLink
      to={to}
      data-card-link=""
      className={cn("after:absolute after:inset-0 focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </LocalizedLink>
  );
}

const headerTitle = {
  md: "text-lead font-semibold tracking-snug text-ink",
  lg: "font-display text-lg font-semibold tracking-heading text-ink",
} as const;

/** Title row of a card: heading + optional description, actions on the right (wrap below on phones). */
export function CardHeader({
  title, description, actions, as: Heading = "h2", size = "md", id, className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  as?: "h2" | "h3";
  /** "lg" = page-level panel title in the display face. */
  size?: keyof typeof headerTitle;
  /** Heading id, e.g. for aria-labelledby on the card. */
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0 flex-1 basis-56">
        <Heading id={id} className={`break-words ${headerTitle[size]}`}>{title}</Heading>
        {description && <p className="mt-1 break-words text-md text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4 min-w-0 first:mt-0", className)} {...props} />;
}

/** Actions row under a hairline; primary action last (rightmost). */
export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4 first:mt-0", className)}
      {...props}
    />
  );
}
