import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import type { LinkProps } from "react-router";

import { LocalizedLink } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";

/** "← Orqaga" to a parent page (`to` is an app path, localized here). 44px tall for thumbs. */
export function BackLink({ to, children, className, ...props }: {
  to: string;
  /** Defaults to t("common.back"). */
  children?: ReactNode;
  className?: string;
} & Omit<LinkProps, "to" | "children" | "className">) {
  const { t } = useTranslation();
  return (
    <LocalizedLink
      to={to}
      prefetch="intent"
      className={cn(
        // Negative margin keeps the text aligned with the page edge while the focus ring breathes.
        "group -ml-2 inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-pill px-2 text-md font-medium text-ink-2 transition-colors duration-150 hover:text-ink",
        className,
      )}
      {...props}
    >
      <ArrowLeft aria-hidden="true" className="size-4 shrink-0 transition-transform duration-200 ease-spring group-hover:-translate-x-0.5" />
      <span className="truncate">{children ?? t("common.back")}</span>
    </LocalizedLink>
  );
}
