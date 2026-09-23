import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

import { useSession } from "~/shared/auth/session";
import { localizedPath } from "~/shared/i18n/config";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { accountLinks } from "~/shared/layout/UserArea";
import { cn } from "~/shared/lib/cn";
import { EmptyState } from "~/shared/ui/EmptyState";

/** Account area: section navigation (sidebar on desktop, scrolling tabs on phones). */
export default function AccountLayout() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { user } = useSession();
  const links = accountLinks(user!);
  const nav = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  // Phones: keep the current section's tab in view in the scrolling strip.
  useEffect(() => {
    nav.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);
  return (
    <div className="container-page pb-20 pt-6 md:pt-10">
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <nav ref={nav} aria-label={t("account.menu")} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ul className="flex gap-1 lg:sticky lg:top-24 lg:flex-col">
            {links.map((l) => (
              <li key={l.to} className="shrink-0">
                <NavLink
                  to={localizedPath(locale, l.to)}
                  end={l.to === "/me" || l.to === "/employer"}
                  className={({ isActive }) =>
                    cn(
                      "flex h-10 items-center whitespace-nowrap rounded-control px-3.5 text-sm font-medium transition-colors",
                      isActive ? "bg-lapis-soft text-lapis-ink" : "text-ink-2 hover:bg-sunken hover:text-ink",
                    )
                  }
                >
                  {t(l.key)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

/** Wraps seeker-only pages: an employer who follows a link gets an explanation, not an error. */
export function SeekerOnly({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useSession();
  if (user?.role !== "employer") return <>{children}</>;
  return <EmptyState title={t("apiErrors.seeker_only")} />;
}
