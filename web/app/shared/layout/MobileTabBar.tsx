import {
  Briefcase, Building2, Handshake, Heart, LogIn, MessageSquare, Search, Send, UserRound, Users,
  type LucideIcon,
} from "lucide-react";
import { useLocation } from "react-router";

import { useSession, type User } from "../auth/session";
import { stripLocale } from "../i18n/config";
import { LocalizedLink, useRootData } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { Skeleton } from "../ui/Skeleton";
import { CountBadge, useUnread } from "./UserArea";

type Tab = {
  to: string;
  key: string;
  icon: LucideIcon;
  /** Path prefixes that make this tab current (the longest match wins). */
  match: string[];
  badge?: "chats" | "notifications";
};

// Same role split as UserArea's accountLinks: employers vs everyone else signed in.
function tabsFor(user: User | null): Tab[] {
  if (!user) {
    return [
      { to: "/vacancies", key: "shell.tabs.search", icon: Search, match: ["/vacancies"] },
      { to: "/companies", key: "shell.tabs.companies", icon: Building2, match: ["/companies"] },
      { to: "/employers", key: "shell.tabs.employers", icon: Handshake, match: ["/employers"] },
      { to: "/login", key: "shell.tabs.login", icon: LogIn, match: ["/login", "/register", "/forgot-password", "/verify-email"] },
    ];
  }
  if (user.role === "employer") {
    return [
      { to: "/employer", key: "shell.tabs.vacancies", icon: Briefcase, match: ["/employer"] },
      { to: "/employer/candidates", key: "shell.tabs.candidates", icon: Users, match: ["/employer/candidates", "/resumes"] },
      { to: "/chat", key: "shell.tabs.chat", icon: MessageSquare, match: ["/chat"], badge: "chats" },
      { to: "/employer/company", key: "shell.tabs.company", icon: Building2, match: ["/employer/company"] },
      { to: "/me", key: "shell.tabs.profile", icon: UserRound, match: ["/me"], badge: "notifications" },
    ];
  }
  return [
    { to: "/vacancies", key: "shell.tabs.search", icon: Search, match: ["/vacancies"] },
    { to: "/me/saved", key: "shell.tabs.saved", icon: Heart, match: ["/me/saved"] },
    { to: "/me/applications", key: "shell.tabs.applications", icon: Send, match: ["/me/applications"] },
    { to: "/chat", key: "shell.tabs.chat", icon: MessageSquare, match: ["/chat"], badge: "chats" },
    { to: "/me", key: "shell.tabs.profile", icon: UserRound, match: ["/me"], badge: "notifications" },
  ];
}

function currentTab(tabs: Tab[], path: string): number {
  let best = -1;
  let len = 0;
  tabs.forEach((tab, i) => {
    for (const m of tab.match) {
      if ((path === m || path.startsWith(m + "/")) && m.length > len) {
        best = i;
        len = m.length;
      }
    }
  });
  return best;
}

/**
 * Floating glass tab bar for phones (< md): 4–5 role-aware destinations with unread badges.
 * It is fixed 0.75rem above the home indicator and exactly --tabbar-h tall; app.css derives
 * --tabbar-space from its presence (#mobile-tabbar), so toasts and sticky bars sit above it
 * and <main> reserves room for it (pb-tabbar). Routes hide it with handle.tabBar = false.
 */
export function MobileTabBar() {
  const { t } = useTranslation();
  const { hasSession } = useRootData();
  const { status, user } = useSession();
  const counts = useUnread(status === "authed");
  const path = stripLocale(useLocation().pathname);

  // Restoring a session: the signed-in bar has 5 slots whatever the role, so draw 5 quiet
  // placeholders instead of guessing (no flash of the wrong items, no size change).
  const restoring = status === "loading" && hasSession;
  const tabs = tabsFor(status === "authed" ? user : null);
  const active = currentTab(tabs, path);

  return (
    <nav
      id="mobile-tabbar"
      aria-label={t("shell.tabBar")}
      className="glass-chrome fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 h-(--tabbar-h) rounded-sheet md:hidden"
    >
      {restoring ? (
        <ul aria-hidden="true" className="grid h-full grid-cols-5 px-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex flex-col items-center justify-center gap-1.5">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-2 w-10" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className={cn("grid h-full px-1.5", tabs.length === 5 ? "grid-cols-5" : "grid-cols-4")}>
          {tabs.map((tab, i) => {
            const on = i === active;
            const Icon = tab.icon;
            const n = tab.badge ? counts[tab.badge] : 0;
            const label = t(tab.key);
            return (
              <li key={tab.to} className="min-w-0">
                <LocalizedLink
                  to={tab.to}
                  prefetch="intent"
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "group flex h-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-panel px-0.5",
                    "transition-[color,scale] duration-150 ease-spring active:scale-[0.97] focus-visible:-outline-offset-4",
                    on ? "text-lapis-ink" : "text-ink-2",
                  )}
                >
                  {/* The pill behind the active icon springs open; others stay collapsed. */}
                  <span className="relative grid h-7 w-12 place-items-center">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-0 rounded-pill bg-lapis-soft transition-[opacity,scale] duration-(--dur-3) ease-spring",
                        on ? "opacity-100" : "scale-x-50 opacity-0",
                      )}
                    />
                    <Icon className="relative size-5.5" strokeWidth={on ? 2.25 : 1.9} aria-hidden="true" />
                    <CountBadge n={n} className="-right-0.5 -top-1" />
                  </span>
                  <span className={cn("max-w-full truncate text-2xs leading-tight", on ? "font-semibold" : "font-medium")}>
                    {label}
                  </span>
                  {n > 0 && <span className="sr-only">, {t("shell.newCount", { count: n })}</span>}
                </LocalizedLink>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
