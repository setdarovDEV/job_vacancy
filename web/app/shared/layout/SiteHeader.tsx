import { Briefcase, Building2, Handshake, Menu as MenuIcon, Plus, Search } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";

import { useSession } from "../auth/session";
import { LogoMark } from "../brand/Logo";
import { localizedPath } from "../i18n/config";
import { LocalizedLink, useLocale } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { Button, IconButton } from "../ui/Button";
import { Kbd } from "../ui/Kbd";
import { Tooltip } from "../ui/Tooltip";
import type { MenuNavItem } from "./MobileMenu";
import { PreferencesMenu } from "./Switchers";
import { postVacancyHref, UserArea } from "./UserArea";

// Both overlays are separate chunks, fetched on first intent (pointerdown / hover / shortcut).
const loadMenu = () => import("./MobileMenu");
const loadPalette = () => import("./CommandPalette");
const MobileMenu = lazy(loadMenu);
const CommandPalette = lazy(loadPalette);

export const primaryNav: readonly MenuNavItem[] = [
  { to: "/vacancies", key: "nav.vacancies", icon: Briefcase },
  { to: "/companies", key: "nav.companies", icon: Building2 },
  { to: "/employers", key: "nav.forEmployers", icon: Handshake },
];

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * Sticky header that materializes rather than shrinks: clear over the page top, glass once content
 * scrolls under it (the header-glass layer; always glass where scroll-driven animations are
 * missing). The height never changes (h-16), so nothing re-lays out while scrolling.
 * Phones (< md): logo, search, menu — the tab bar carries the main destinations. md–lg: logo
 * mark, nav pills, search, sign-in / messages, menu sheet for the rest. lg+: full set with
 * language, appearance, the "Post a vacancy" CTA and the avatar menu.
 * `mobileHidden` drops it below md for screens with their own top bar (chat thread); `autoHide`
 * lets it slide away on scroll-down below md (list routes, handle.autoHideHeader).
 */
export function SiteHeader({ mobileHidden = false, autoHide = false }: { mobileHidden?: boolean; autoHide?: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { user, status } = useSession();

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuWanted, setMenuWanted] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteWanted, setPaletteWanted] = useState(false);
  // ⌘K on Apple devices, Ctrl K elsewhere. Unknown on the server: the hint appears after mount
  // inside a fixed-size slot, so nothing moves.
  const [mac, setMac] = useState<boolean | null>(null);
  const searchBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMac(isMac());
    const onKey = (e: KeyboardEvent) => {
      // The typed letter on Latin layouts (Colemak's K key types "e", so no Ctrl+E theft); the
      // physical key on others (Cyrillic). Autofill fires keydowns without a key.
      const key = e.key?.toLowerCase() ?? "";
      const k = /^[a-z]$/.test(key) ? key === "k" : e.code === "KeyK";
      if (!k || e.defaultPrevented || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.repeat) return;
      e.preventDefault();
      setPaletteWanted(true);
      setPaletteOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPalette = () => {
    setPaletteWanted(true);
    setPaletteOpen(true);
  };

  const pill = ({ isActive }: { isActive: boolean }) =>
    cn(
      "inline-flex h-10 items-center whitespace-nowrap rounded-pill px-3.5 text-md font-medium",
      "transition-[background-color,color,scale] duration-150 ease-spring active:scale-[0.97]",
      isActive ? "bg-lapis-soft text-lapis-ink" : "text-ink-2 hover:bg-sunken hover:text-ink",
    );

  const shortcut = mac == null ? null : mac ? "⌘K" : "Ctrl K";
  const searchLabel = t("shell.search");

  return (
    <header
      id="site-header"
      data-mobile-hidden={mobileHidden || undefined}
      className={cn("sticky top-0 z-40 isolate pt-safe", autoHide && "autohide", mobileHidden && "max-md:hidden")}
    >
      {/* The material lives on a sibling layer: backdrop-filter on the header itself would make it
          the containing block of fixed descendants. Menus and the palette are top-layer / portals. */}
      <div aria-hidden="true" className="header-glass glass-bar" />
      <a
        href="#main"
        // Visually hidden in place until focused (no off-screen parking the browser would scroll
        // to, nothing to reveal on overscroll); fades in below the notch. Opacity only.
        className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 rounded-pill bg-raised px-4 py-2.5 text-md font-medium text-ink shadow-3 not-focus:sr-only focus:anim-fade"
      >
        {t("nav.skipToContent")}
      </a>
      <div className="container-page flex h-16 items-center gap-3 lg:gap-4">
        <LocalizedLink to="/" aria-label={t("brand.name")} className="-ml-1 flex shrink-0 items-center gap-2.5 rounded-control p-1">
          <LogoMark className="size-7" />
          {/* The wordmark gives way to the nav pills between md and xl. */}
          <span className="font-display text-lead font-semibold leading-none tracking-heading text-ink md:max-xl:hidden" aria-hidden="true">
            {t("brand.name")}
          </span>
        </LocalizedLink>

        <nav aria-label={t("shell.mainNav")} className="hidden min-w-0 items-center gap-1 md:flex">
          {primaryNav.map((n) => (
            <NavLink key={n.to} to={localizedPath(locale, n.to)} prefetch="intent" className={pill}>
              {t(n.key)}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Tooltip
            content={
              <span className="inline-flex items-center gap-2">
                {searchLabel}
                {shortcut && <Kbd className="pointer-coarse:hidden">{shortcut}</Kbd>}
              </span>
            }
          >
            <button
              ref={searchBtn}
              type="button"
              onPointerEnter={() => void loadPalette()}
              onPointerDown={() => setPaletteWanted(true)}
              onClick={openPalette}
              aria-label={searchLabel}
              aria-haspopup="dialog"
              aria-expanded={paletteOpen}
              aria-keyshortcuts="Meta+K Control+K"
              className={cn(
                "inline-flex size-11 shrink-0 items-center justify-center gap-2 rounded-pill text-ink-2",
                "transition-[background-color,color,border-color,scale] duration-150 ease-spring hover:bg-sunken hover:text-ink active:scale-[0.97]",
                // xl with a mouse: a quiet field-like pill with the shortcut in a fixed-width slot.
                "xl:pointer-fine:w-auto xl:pointer-fine:border xl:pointer-fine:border-line xl:pointer-fine:bg-surface/60 xl:pointer-fine:pl-3 xl:pointer-fine:pr-2",
              )}
            >
              <Search className="size-5 xl:pointer-fine:size-4.5" aria-hidden="true" />
              <span className="hidden w-12 justify-end xl:pointer-fine:flex" aria-hidden="true">
                {shortcut && <Kbd className="anim-fade">{shortcut}</Kbd>}
              </span>
            </button>
          </Tooltip>

          <div className="hidden lg:contents">
            <PreferencesMenu />
          </div>
          <div className="hidden items-center gap-1 md:flex">
            <UserArea
              cta={
                // Same label and size for every role, so it never shifts; only the target differs.
                <Button asChild shape="pill" icon={<Plus className="size-4.5" strokeWidth={2.5} />} className="mx-1 hidden lg:inline-flex">
                  <LocalizedLink to={postVacancyHref(status === "authed" ? user : null)} prefetch="intent">
                    {t("nav.postVacancy")}
                  </LocalizedLink>
                </Button>
              }
            />
          </div>

          <IconButton
            label={t("nav.menu")}
            shape="pill"
            className="-mr-1.5 lg:hidden"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onPointerDown={() => setMenuWanted(true)}
            onClick={() => {
              setMenuWanted(true);
              setMenuOpen(true);
            }}
          >
            <MenuIcon className="size-6" />
          </IconButton>
        </div>
      </div>
      {menuWanted && (
        <Suspense fallback={null}>
          <MobileMenu open={menuOpen} onOpenChange={setMenuOpen} nav={primaryNav} locale={locale} />
        </Suspense>
      )}
      {paletteWanted && (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} returnFocus={searchBtn} />
        </Suspense>
      )}
    </header>
  );
}
