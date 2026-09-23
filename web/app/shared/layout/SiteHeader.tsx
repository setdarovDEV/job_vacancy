import { Menu as MenuIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "~/shared/i18n/i18n";
import { NavLink } from "react-router";

import { Logo } from "../brand/Logo";
import { localizedPath } from "../i18n/config";
import { LocalizedLink, useLocale } from "../i18n/hooks";
import { cn } from "../lib/cn";
import { IconButton } from "../ui/Button";
import { LanguageMenu, ThemeMenu } from "./Switchers";
import { UserArea } from "./UserArea";

const MobileMenu = lazy(() => import("./MobileMenu"));

const nav = [
  { to: "/vacancies", key: "nav.vacancies" },
  { to: "/companies", key: "nav.companies" },
  { to: "/employers", key: "nav.forEmployers" },
] as const;

export function SiteHeader() {
  const { t } = useTranslation();
  const locale = useLocale();
  // A hairline appears once the page scrolls, instead of a permanent heavy border.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // The mobile menu's code is fetched on first touch, before the tap completes.
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRequested, setMenuRequested] = useState(false);
  const loadMenu = () => setMenuRequested(true);

  const link = ({ isActive }: { isActive: boolean }) =>
    cn("rounded-control px-3 py-2 text-[0.9375rem] font-medium transition-colors",
      isActive ? "text-ink" : "text-ink-2 hover:text-ink");

  return (
    <header className={cn("sticky top-0 z-40 border-b bg-paper transition-colors duration-200", scrolled ? "border-line" : "border-transparent")}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2">
        {t("nav.skipToContent")}
      </a>
      <div className="container-page flex h-16 items-center gap-6">
        <LocalizedLink to="/" aria-label={t("brand.name")} className="rounded-control">
          <Logo />
        </LocalizedLink>
        <nav className="hidden items-center gap-1 md:flex" aria-label={t("nav.menu")}>
          {nav.map((n) => (
            <NavLink key={n.to} to={localizedPath(locale, n.to)} className={link}>
              {t(n.key)}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <div className="hidden items-center gap-1 md:flex">
            <LanguageMenu />
            <ThemeMenu />
            <UserArea />
          </div>
          <IconButton
            label={t("nav.menu")}
            className="md:hidden"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onPointerDown={loadMenu}
            onClick={() => { loadMenu(); setMenuOpen(true); }}
          >
            <MenuIcon className="size-6" />
          </IconButton>
          {menuRequested && (
            <Suspense fallback={null}>
              <MobileMenu open={menuOpen} onOpenChange={setMenuOpen} nav={nav} locale={locale} />
            </Suspense>
          )}
        </div>
      </div>
    </header>
  );
}
