import * as M from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export const MenuRoot = M.Root;
export const MenuTrigger = M.Trigger;

const panel =
  "anim-pop z-50 min-w-48 rounded-panel border border-line bg-surface p-1.5 shadow-pop outline-none";
const item =
  "flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-[0.625rem] px-2.5 text-sm text-ink outline-none " +
  "data-[highlighted]:bg-sunken data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export function MenuContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "end" | "center" }) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={8} className={panel}>
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({
  icon, children, onSelect, className, asChild,
}: { icon?: ReactNode; children: ReactNode; onSelect?: () => void; className?: string; asChild?: boolean }) {
  if (asChild) {
    // e.g. a <Link>: keeps arrow-key navigation and typeahead inside the menu
    return <M.Item asChild onSelect={onSelect} className={cn(item, className)}>{children}</M.Item>;
  }
  return (
    <M.Item onSelect={onSelect} className={cn(item, className)}>
      {icon && <span className="flex text-ink-3">{icon}</span>}
      {children}
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
    <M.RadioItem value={value} className={item}>
      {icon && <span className="flex text-ink-3">{icon}</span>}
      <span className="flex-1">{children}</span>
      <M.ItemIndicator>
        <Check className="size-4 text-lapis" strokeWidth={2.5} />
      </M.ItemIndicator>
    </M.RadioItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-2.5 pb-1 pt-1.5 text-xs text-ink-3">{children}</M.Label>;
}

export function MenuSeparator() {
  return <M.Separator className="-mx-1.5 my-1.5 h-px bg-line" />;
}
