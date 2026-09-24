import { ChevronRight, LogOut, Plus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router";

import { useSession } from "../auth/session";
import { localizedPath, type Locale } from "../i18n/config";
import { LocalizedLink } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { DialogRoot, SheetContent } from "../ui/Dialog";
import { InlineSwitchers } from "./Switchers";
import { accountLinks, postVacancyHref, useSignOut, useUnread } from "./UserArea";

export type MenuNavItem = { to: string; key: string; icon?: LucideIcon };

// 44px rows; the current page is tinted and announced (NavLink sets aria-current="page").
const row = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex min-h-11 items-center gap-3 rounded-control px-3 py-2 text-base font-medium transition-[background-color,color,scale] duration-150 ease-spring active:scale-[0.99]",
    isActive ? "bg-lapis-soft text-lapis-ink" : "text-ink hover:bg-sunken",
  );

function MenuSection({ id, title, children }: { id: string; title: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 id={id} className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-caps text-ink-3">{title}</h3>
      {children}
    </section>
  );
}

// Loaded on demand (see SiteHeader): Radix Dialog only ships to people who open the menu.
export default function MobileMenu({
  open, onOpenChange, nav, locale,
}: { open: boolean; onOpenChange: (v: boolean) => void; nav: readonly MenuNavItem[]; locale: Locale }) {
  const { t } = useTranslation();
  const { status, user } = useSession();
  const authed = status === "authed" && user ? user : null;
  const counts = useUnread(Boolean(authed));
  const onSignOut = useSignOut();
  const close = () => onOpenChange(false);
  const to = (p: string) => localizedPath(locale, p);

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={t("nav.menu")}
        closeLabel={t("common.close")}
        footer={
          authed ? (
            <Button variant="secondary" className="flex-1" icon={<LogOut className="size-4" />} onClick={() => { close(); void onSignOut(); }}>
              {t("nav.signOut")}
            </Button>
          ) : (
            <>
              <Button asChild variant="secondary" className="flex-1">
                <LocalizedLink to="/login" onClick={close}>{t("nav.signIn")}</LocalizedLink>
              </Button>
              <Button asChild className="flex-1">
                <LocalizedLink to="/register" onClick={close}>{t("nav.signUp")}</LocalizedLink>
              </Button>
            </>
          )
        }
      >
        <div className="flex flex-col gap-4">
          {authed && (
            <LocalizedLink
              to="/me"
              onClick={close}
              className="flex items-center gap-3 rounded-panel bg-sunken p-3 transition-[background-color,scale] duration-150 ease-spring active:scale-[0.99]"
            >
              <Avatar name={authed.full_name} src={authed.avatar_url} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-md font-semibold text-ink">{authed.full_name}</span>
                <span className="block truncate text-sm text-ink-2">{authed.email ?? authed.phone}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden="true" />
            </LocalizedLink>
          )}

          <MenuSection id="menu-main" title={t("shell.menuMain")}>
            <nav aria-labelledby="menu-main">
              <ul className="flex flex-col gap-0.5">
                {nav.map((n) => {
                  const Icon = n.icon;
                  return (
                    <li key={n.to}>
                      <NavLink to={to(n.to)} prefetch="intent" onClick={close} className={row}>
                        {Icon && <Icon className="size-5 shrink-0 text-ink-3" aria-hidden="true" />}
                        <span className="min-w-0 flex-1 break-words">{t(n.key)}</span>
                      </NavLink>
                    </li>
                  );
                })}
                <li>
                  <NavLink to={to(postVacancyHref(authed))} end onClick={close} className={(s) => cn(row(s), !s.isActive && "text-lapis-ink")}>
                    <Plus className="size-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 break-words">{t("nav.postVacancy")}</span>
                  </NavLink>
                </li>
              </ul>
            </nav>
          </MenuSection>

          {authed && (
            <MenuSection id="menu-account" title={t("account.menu")}>
              <nav aria-labelledby="menu-account">
                <ul className="flex flex-col gap-0.5">
                  {accountLinks(authed).map((l) => {
                    const Icon = l.icon;
                    const n = l.to === "/chat" ? counts.chats : l.to === "/me/notifications" ? counts.notifications : 0;
                    return (
                      <li key={l.to}>
                        <NavLink to={to(l.to)} end={l.to === "/me" || l.to === "/employer"} prefetch="intent" onClick={close} className={row}>
                          {Icon && <Icon className="size-5 shrink-0 text-ink-3" aria-hidden="true" />}
                          <span className="min-w-0 flex-1 break-words">{t(l.key)}</span>
                          {n > 0 && (
                            <span className="num rounded-pill bg-anor px-2 py-0.5 text-xs font-semibold text-on-anor">
                              {n > 99 ? "99+" : n}
                            </span>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </MenuSection>
          )}

          <MenuSection id="menu-settings" title={t("account.settings")}>
            <div className="px-1 pt-1">
              <InlineSwitchers onNavigate={close} />
            </div>
          </MenuSection>
        </div>
      </SheetContent>
    </DialogRoot>
  );
}
