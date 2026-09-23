import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <div className="rounded-sheet border border-line bg-surface p-6 shadow-pop sm:p-8">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.03em]">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink-2">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </div>
      {footer && <p className="mt-6 text-center text-sm text-ink-2">{footer}</p>}
    </>
  );
}
