import * as M from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import { popoverItem, popoverPanel } from "./Popover";

export const MenuRoot = M.Root;
export const MenuTrigger = M.Trigger;

// Same glass panel and rows as the native Popover; Radix adds roving focus, typeahead and
// submenus for menus that need real menu keyboard semantics.
const panel = cn(
  popoverPanel,
  "anim-pop z-50 min-w-48 overflow-y-auto overscroll-contain",
  "max-h-(--radix-dropdown-menu-content-available-height) origin-(--radix-dropdown-menu-content-transform-origin)",
);
const item = cn(
  popoverItem,
  "data-[highlighted]:bg-sunken data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
);
const tones = { default: "", danger: "text-anor-ink data-[highlighted]:bg-anor-soft" } as const;

export function MenuContent({
  children, align = "end", side, className,
}: { children: ReactNode; align?: "start" | "end" | "center"; side?: "top" | "bottom"; className?: string }) {
  return (
    <M.Portal>
      <M.Content align={align} side={side} sideOffset={8} collisionPadding={8} className={cn(panel, className)}>
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({
  icon, children, onSelect, className, asChild, tone = "default", disabled,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onSelect?: () => void;
  className?: string;
  asChild?: boolean;
  /** "danger" for destructive rows (delete, withdraw). */
  tone?: keyof typeof tones;
  disabled?: boolean;
}) {
  if (asChild) {
    // e.g. a <Link>: keeps arrow-key navigation and typeahead inside the menu
    return <M.Item asChild disabled={disabled} onSelect={onSelect} className={cn(item, tones[tone], className)}>{children}</M.Item>;
  }
  return (
    <M.Item disabled={disabled} onSelect={onSelect} className={cn(item, tones[tone], className)}>
      {icon && <span className={cn("flex", tone === "danger" ? "text-anor-ink" : "text-ink-3")} aria-hidden="true">{icon}</span>}
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </M.Item>
  );
}

export function MenuRadioGroup<T extends string>({
  value, onValueChange, children,
}: { value: T; onValueChange: (v: T) => void; children: ReactNode }) {
  return (
    <M.RadioGroup value={value} onValueChange={(v) => onValueChange(v as T)}>
      {children}
    </M.RadioGroup>
  );
}

export function MenuRadioItem({ value, icon, children }: { value: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <M.RadioItem value={value} className={cn(item, "data-[state=checked]:font-medium")}>
      {icon && <span className="flex text-ink-3" aria-hidden="true">{icon}</span>}
      <span className="min-w-0 flex-1 break-words">{children}</span>
      <M.ItemIndicator>
        <Check className="size-4 text-lapis" strokeWidth={2.5} aria-hidden="true" />
      </M.ItemIndicator>
    </M.RadioItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-3 pb-1 pt-1.5 text-xs font-medium text-ink-3">{children}</M.Label>;
}

export function MenuSeparator() {
  return <M.Separator className="-mx-1.5 my-1.5 h-px bg-line" />;
}
