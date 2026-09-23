import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export const DialogRoot = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

type ContentProps = {
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/** Centered modal for short, focused tasks (confirmations, small forms). */
export function DialogContent({ title, description, closeLabel, children, footer, className }: ContentProps) {
  return (
    <D.Portal>
      <D.Overlay className="anim-overlay fixed inset-0 z-50 bg-overlay" />
      <D.Content
        className={cn(
          "anim-dialog fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-sheet border border-line bg-surface p-6 shadow-pop outline-none",
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <D.Title className="font-display text-lg font-semibold tracking-[-0.01em]">{title}</D.Title>
            {description && <D.Description className="mt-1.5 text-sm text-ink-2">{description}</D.Description>}
          </div>
          <D.Close className="-m-2 grid size-9 shrink-0 place-items-center rounded-control text-ink-3 hover:bg-sunken hover:text-ink" aria-label={closeLabel}>
            <X className="size-5" />
          </D.Close>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}

/** Side panel: slides up from the bottom on phones, in from the right on larger screens. */
export function SheetContent({ title, description, closeLabel, children, footer, className }: ContentProps) {
  return (
    <D.Portal>
      <D.Overlay className="anim-overlay fixed inset-0 z-50 bg-overlay" />
      <D.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface shadow-pop outline-none",
          "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-sheet anim-sheet-up",
          "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[26rem] md:rounded-none md:rounded-l-sheet md:anim-sheet-right",
          className,
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong md:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4 md:px-6 md:pt-6">
          <div>
            <D.Title className="font-display text-lg font-semibold tracking-[-0.01em]">{title}</D.Title>
            {description && <D.Description className="mt-1 text-sm text-ink-2">{description}</D.Description>}
          </div>
          <D.Close className="-m-2 grid size-9 shrink-0 place-items-center rounded-control text-ink-3 hover:bg-sunken hover:text-ink" aria-label={closeLabel}>
            <X className="size-5" />
          </D.Close>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5 md:px-6">{children}</div>
        {footer && <div className="flex gap-2 border-t border-line px-5 py-4 md:px-6">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}
