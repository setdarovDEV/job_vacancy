import { NavLink } from "react-router";

import { localizedPath, type Locale } from "../i18n/config";
import { LocalizedLink } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { Button } from "../ui/Button";
import { DialogRoot, SheetContent } from "../ui/Dialog";
import { useSession } from "../auth/session";
import { Avatar } from "../ui/Avatar";
import { InlineSwitchers } from "./Switchers";
import { accountLinks, useSignOut } from "./UserArea";

// Loaded on demand (see SiteHeader): Radix Dialog only ships to people who open the menu.
export default function MobileMenu({
  open, onOpenChange, nav, locale,
}: { open: boolean; onOpenChange: (v: boolean) => void; nav: readonly { to: string; key: string }[]; locale: Locale }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const onSignOut = useSignOut();
  const close = () => onOpenChange(false);
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={t("nav.menu")}
        closeLabel={t("common.close")}
        footer={
          user ? (
            <Button variant="secondary" className="flex-1" onClick={() => { close(); void onSignOut(); }}>{t("nav.signOut")}</Button>
          ) : (
            <>
              <Button asChild variant="secondary" className="flex-1"><LocalizedLink to="/login" onClick={close}>{t("nav.signIn")}</LocalizedLink></Button>
              <Button asChild className="flex-1"><LocalizedLink to="/register" onClick={close}>{t("nav.signUp")}</LocalizedLink></Button>
            </>
          )
        }
      >
        {user && (
          <div className="mb-4 flex items-center gap-3 rounded-panel bg-sunken p-3">
            <Avatar name={user.full_name} src={user.avatar_url} size="md" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{user.full_name}</p>
              <p className="truncate text-sm text-ink-3">{user.email ?? user.phone}</p>
            </div>
          </div>
        )}
        {user && (
          <nav className="mb-4 flex flex-col" aria-label={t("account.menu")}>
            {accountLinks(user).map((l) => (
              <NavLink key={l.to} to={localizedPath(locale, l.to)} onClick={close} end
                className={({ isActive }) => cn("border-b border-line py-3 text-base", isActive ? "text-lapis-ink" : "text-ink")}>
                {t(l.key)}
              </NavLink>
            ))}
          </nav>
        )}
        <nav className="mb-6 flex flex-col" aria-label={t("nav.menu")}>
          {nav.map((n) => (
            <NavLink key={n.to} to={localizedPath(locale, n.to)} onClick={close}
              className={({ isActive }) => cn("border-b border-line py-3.5 text-base font-medium", isActive ? "text-lapis-ink" : "text-ink")}>
              {t(n.key)}
            </NavLink>
          ))}
        </nav>
        <InlineSwitchers />
      </SheetContent>
    </DialogRoot>
  );
}
