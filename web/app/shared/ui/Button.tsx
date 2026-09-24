import { Slot, Slottable } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "../lib/cn";
import { Spinner } from "./Spinner";

const variants = {
  primary: "bg-lapis text-on-lapis shadow-2 hover:bg-lapis-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-sunken",
  soft: "bg-lapis-soft text-lapis-ink hover:bg-[color-mix(in_oklab,var(--lapis-soft),var(--lapis)_10%)]",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  // on-anor keeps ≥ 5.6:1 in both themes (plain white on the light dark-mode anor was 2.7:1).
  danger: "bg-anor text-on-anor shadow-2 hover:bg-anor-hover",
  // Only over the aurora / hero / media. glass-interactive owns hover tint, press scale and transitions.
  glass: "glass-panel glass-interactive text-ink",
} as const;

// Spinner colour when it replaces the whole label (the label turns transparent then).
const spinnerTone = {
  primary: "text-on-lapis", secondary: "text-ink", soft: "text-lapis-ink", ghost: "text-ink-2", danger: "text-on-anor", glass: "text-ink",
} as const;

const sizes = {
  sm: "h-9 gap-1.5 px-3 text-sm",
  md: "h-11 gap-2 px-4 text-md",
  lg: "h-13 gap-2.5 px-6 text-base",
} as const;

const spinnerSize = { sm: "size-4", md: "size-4.5", lg: "size-5" } as const;

const shapes = { default: "rounded-control", pill: "rounded-pill" } as const;

// sm (36px) is a dense desktop size: on touch screens an invisible hit area grows it to 44px.
// Glass owns ::before/::after, so a glass sm button simply becomes 44px tall on touch instead.
const touchHit = "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.25";

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;
export type ButtonShape = keyof typeof shapes;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** `pill` for header / hero CTAs; `default` is the rounded-control rectangle. */
  shape?: ButtonShape;
  /** Shows a spinner, keeps the button's width, sets aria-busy and blocks repeated clicks. */
  loading?: boolean;
  /** Icon shown before the label (a spinner takes its place while loading). */
  icon?: ReactNode;
  /** Render the child element (e.g. a <Link>) with button styles. */
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", shape = "default", loading, icon, asChild, className, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  const spinning = Boolean(loading) && !asChild;
  const hasIcon = icon != null && icon !== false;
  // Without an icon the spinner sits over the (transparent) label, so the width never changes.
  const overlay = spinning && !hasIcon;
  return (
    <Comp
      ref={ref}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap",
        variant === "primary" || variant === "danger" ? "font-semibold" : "font-medium",
        variant !== "glass" &&
          "transition-[background-color,border-color,color,box-shadow,scale] duration-150 ease-spring active:scale-[0.98]",
        "disabled:pointer-events-none aria-disabled:pointer-events-none",
        // A loading button stays fully opaque: it's busy, not unavailable.
        !loading && "disabled:opacity-50 aria-disabled:opacity-50",
        variants[variant],
        sizes[size],
        shapes[shape],
        size === "sm" && (variant === "glass" ? "pointer-coarse:h-11" : touchHit),
        overlay && "text-transparent [&>*:not([data-spinner])]:opacity-0",
        className,
      )}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* Slottable puts the icon inside the child element when asChild (e.g. a <Link>). */}
      {hasIcon && (
        <span className="relative grid shrink-0 place-items-center">
          <span className={cn("grid place-items-center", spinning && "opacity-0")}>{icon}</span>
          {spinning && <Spinner className={cn("absolute", spinnerSize[size])} />}
        </span>
      )}
      <Slottable>{children}</Slottable>
      {overlay && (
        <span data-spinner="" className={cn("absolute inset-0 grid place-items-center", spinnerTone[variant])}>
          <Spinner className={spinnerSize[size]} />
        </span>
      )}
    </Comp>
  );
});

export type IconButtonProps = Omit<ButtonProps, "icon" | "children"> & {
  /** Required: icon-only buttons need an accessible name (also shown as the native hover title). */
  label: string;
  children: ReactNode;
};

// Square boxes; sm grows to 44px on touch screens.
const iconBox = { sm: "size-9 px-0 pointer-coarse:size-11", md: "size-11 px-0", lg: "size-13 px-0" } as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", variant = "ghost", className, children, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      // The box is already 44px on touch, so the sm hit area collapses back onto it.
      className={cn(iconBox[size], "pointer-coarse:after:inset-y-0", className)}
      {...props}
    >
      {children}
    </Button>
  );
});
