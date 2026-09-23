import { Slot, Slottable } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "../lib/cn";
import { Spinner } from "./Spinner";

const variants = {
  primary: "bg-lapis text-on-lapis hover:bg-lapis-hover",
  secondary: "bg-surface text-ink border border-line-strong hover:border-ink-3 hover:bg-sunken",
  soft: "bg-lapis-soft text-lapis-ink hover:bg-[color-mix(in_oklab,var(--lapis-soft),var(--lapis)_8%)]",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  danger: "bg-anor text-white hover:bg-anor-ink",
} as const;

const sizes = {
  sm: "h-9 gap-1.5 px-3 text-sm",
  md: "h-11 gap-2 px-4 text-[0.9375rem]",
  lg: "h-13 gap-2.5 px-6 text-base",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  /** Icon shown before the label (replaced by a spinner while loading). */
  icon?: ReactNode;
  /** Render the child element (e.g. a <Link>) with button styles. */
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, asChild, className, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-control font-medium",
        "transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* Slottable puts the icon inside the child element when asChild (e.g. a <Link>). */}
      {loading && !asChild ? <Spinner className="size-4" /> : icon}
      <Slottable>{children}</Slottable>
    </Comp>
  );
});

export type IconButtonProps = Omit<ButtonProps, "icon" | "children"> & {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", variant = "ghost", className, children, ...props },
  ref,
) {
  const box = { sm: "size-9 px-0", md: "size-11 px-0", lg: "size-13 px-0" }[size];
  return (
    <Button ref={ref} variant={variant} size={size} aria-label={label} title={label} className={cn(box, className)} {...props}>
      {children}
    </Button>
  );
});
