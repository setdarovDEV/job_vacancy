import {
  Bell, Building2, FileText, Heart, LayoutDashboard, ListFilter, LogOut, MessageSquare, Send, Settings, Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { api, dataOf } from "../api/client";
import { signOut, useSession, withAuth, type User } from "../auth/session";
import { localizedPath } from "../i18n/config";
import { LocalizedLink, useLocale, useRootData } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { Avatar } from "../ui/Avatar";
import { Button, IconButton } from "../ui/Button";
import { Popover, popoverItem } from "../ui/Popover";
import { Skeleton } from "../ui/Skeleton";
import { toast } from "../ui/toast-store";

export type AccountLink = { to: string; key: string; icon?: LucideIcon };

export function accountLinks(user: User): AccountLink[] {
  return user.role === "employer"
    ? [
        { to: "/employer", key: "account.dashboard", icon: LayoutDashboard },
        { to: "/employer/candidates", key: "account.candidates", icon: Users },
        { to: "/employer/company", key: "employer.company", icon: Building2 },
        { to: "/chat", key: "nav.messages", icon: MessageSquare },
        { to: "/me/notifications", key: "account.notifications", icon: Bell },
        { to: "/me", key: "account.settings", icon: Settings },
      ]
    : [
        { to: "/me/resumes", key: "account.myResumes", icon: FileText },
        { to: "/me/applications", key: "nav.applications", icon: Send },
        { to: "/me/saved", key: "nav.saved", icon: Heart },
        { to: "/me/searches", key: "account.searches", icon: ListFilter },
        { to: "/chat", key: "nav.messages", icon: MessageSquare },
        { to: "/me/notifications", key: "account.notifications", icon: Bell },
        { to: "/me", key: "account.settings", icon: Settings },
      ];
}

/** Where the primary "Post a vacancy" CTA leads: the editor for employers, the pitch for everyone else. */
export function postVacancyHref(user: User | null): string {
  return user?.role === "employer" ? "/employer/vacancies/new" : "/employers";
}

/*
 * Unread counters for the header, the tab bar and the menu. One module-level store, so the
 * three places share a single fetch and socket subscription instead of three. It runs while
 * at least one signed-in component is mounted and refreshes on focus, on realtime events and
 * when a page dispatches "jv:unread" (after reading notifications or messages).
 */
type Unread = { notifications: number; chats: number };
const NONE: Unread = { notifications: 0, chats: 0 };
let unread: Unread = NONE;
const unreadListeners = new Set<() => void>();
let users = 0;
let stopUnread: (() => void) | null = null;

function setUnread(next: Unread) {
  if (next.notifications === unread.notifications && next.chats === unread.chats) return;
  unread = next;
  unreadListeners.forEach((l) => l());
}

function startUnread() {
  let alive = true;
  const load = async () => {
    try {
      const [n, c] = await Promise.all([
        withAuth(() => api.GET("/me/notifications/unread-count")),
        withAuth(() => api.GET("/conversations/unread-count")),
      ]);
      if (!alive) return;
      setUnread({
        notifications: dataOf<{ unread: number }>(n)?.unread ?? 0,
        chats: dataOf<{ conversations: number }>(c)?.conversations ?? 0,
      });
    } catch {
      /* offline: keep the last known counts */
    }
  };
  void load();
  // Live badges: the socket module loads only for signed-in users.
  let off: (() => void) | undefined;
  void import("../realtime/socket").then((rt) => {
    if (!alive) return;
    rt.connect();
    off = rt.onRealtime((e) => {
      if (e.type === "notification.new" || e.type === "message.new" || e.type === "message.read") void load();
    });
  });
  window.addEventListener("focus", load);
  window.addEventListener("jv:unread", load); // pages that read notifications/messages
  return () => {
    alive = false;
    off?.();
    window.removeEventListener("focus", load);
    window.removeEventListener("jv:unread", load);
    setUnread(NONE);
  };
}

const subscribeUnread = (l: () => void) => {
  unreadListeners.add(l);
  return () => unreadListeners.delete(l);
};

/** Unread notifications and conversations; zeros while `enabled` is false or on the server. */
export function useUnread(enabled: boolean): Unread {
  useEffect(() => {
    if (!enabled) return;
    if (users++ === 0) stopUnread = startUnread();
    return () => {
      if (--users === 0) {
        stopUnread?.();
        stopUnread = null;
      }
    };
  }, [enabled]);
  const counts = useSyncExternalStore(subscribeUnread, () => unread, () => NONE);
  return enabled ? counts : NONE;
}

/** Small anor count bubble on an icon (99+ cap). Decorative: the owner's accessible name carries the number. */
export function CountBadge({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "num pointer-events-none absolute grid h-4.5 min-w-4.5 place-items-center rounded-pill bg-anor px-1 text-2xs font-semibold leading-none text-on-anor ring-2 ring-surface",
        className ?? "right-1 top-1",
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function useSignOut() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  return async () => {
    await signOut();
    toast({ tone: "info", title: t("auth.signedOut") });
    navigate(localizedPath(locale, "/"));
  };
}

/**
 * Right side of the desktop header. md–lg: sign-in / messages / notifications (everything else
 * lives in the menu sheet); lg and up adds the avatar menu. `cta` (the header's primary action)
 * goes after "Sign in" or before the avatar. While a session is being restored the signed-in
 * shape is drawn as skeletons of the same size, so nothing shifts.
 */
export function UserArea({ cta }: { cta?: ReactNode } = {}) {
  const { t } = useTranslation();
  const { hasSession } = useRootData();
  const { status, user } = useSession();
  const counts = useUnread(status === "authed");
  const onSignOut = useSignOut();

  if (status === "loading" && hasSession) {
    return (
      <>
        <Skeleton className="mx-1.5 size-8 rounded-full" />
        <Skeleton className="mx-1.5 size-8 rounded-full" />
        {cta}
        <Skeleton className="mx-1.5 hidden size-8 rounded-full lg:block" />
      </>
    );
  }
  if (status !== "authed" || !user) {
    return (
      <>
        <Button asChild variant="ghost" shape="pill" className="text-ink">
          <LocalizedLink to="/login" prefetch="intent">{t("nav.signIn")}</LocalizedLink>
        </Button>
        {cta}
      </>
    );
  }
  const chatLabel = counts.chats > 0 ? t("shell.unreadChats", { count: counts.chats }) : t("nav.messages");
  const bellLabel = counts.notifications > 0 ? t("shell.unreadNotifications", { count: counts.notifications }) : t("account.notifications");
  return (
    <>
      <IconButton asChild label={chatLabel} shape="pill">
        <LocalizedLink to="/chat" prefetch="intent">
          <MessageSquare className="size-5" />
          <CountBadge n={counts.chats} />
        </LocalizedLink>
      </IconButton>
      <IconButton asChild label={bellLabel} shape="pill">
        <LocalizedLink to="/me/notifications" prefetch="intent">
          <Bell className="size-5" />
          <CountBadge n={counts.notifications} />
        </LocalizedLink>
      </IconButton>
      {cta}
      <div className="hidden lg:contents">
        <Popover
          label={t("account.menu")}
          className="w-72"
          trigger={(p) => (
            <button
              type="button"
              popoverTarget={p.popoverTarget}
              aria-label={p["aria-label"]}
              title={user.full_name}
              className="grid size-11 shrink-0 place-items-center rounded-pill transition-[background-color,scale] duration-150 ease-spring hover:bg-sunken active:scale-[0.96]"
            >
              <Avatar name={user.full_name} src={user.avatar_url} size="sm" priority className="ring-1 ring-line" />
            </button>
          )}
        >
          <LocalizedLink to="/me" className="mb-1 flex items-center gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-sunken focus-visible:bg-sunken focus-visible:-outline-offset-2">
            <Avatar name={user.full_name} src={user.avatar_url} size="md" />
            <span className="min-w-0">
              <span className="block truncate text-md font-semibold text-ink">{user.full_name}</span>
              <span className="block truncate text-sm text-ink-3">{user.email ?? user.phone}</span>
            </span>
          </LocalizedLink>
          <nav aria-label={t("account.menu")} className="border-t border-line pt-1">
            {accountLinks(user).map((l) => {
              const Icon = l.icon;
              const n = l.to === "/chat" ? counts.chats : l.to === "/me/notifications" ? counts.notifications : 0;
              return (
                <LocalizedLink key={l.to} to={l.to} prefetch="intent" className={popoverItem}>
                  {Icon && <Icon className="size-4.5 shrink-0 text-ink-3" aria-hidden="true" />}
                  <span className="min-w-0 flex-1 truncate">{t(l.key)}</span>
                  {n > 0 && (
                    <span className="num rounded-pill bg-anor-soft px-2 text-xs font-semibold text-anor-ink">
                      {n > 99 ? "99+" : n}
                    </span>
                  )}
                </LocalizedLink>
              );
            })}
          </nav>
          <div className="mt-1 border-t border-line pt-1">
            <button type="button" onClick={onSignOut} className={cn(popoverItem, "text-anor-ink")}>
              <LogOut className="size-4.5 shrink-0" aria-hidden="true" />
              {t("nav.signOut")}
            </button>
          </div>
        </Popover>
      </div>
    </>
  );
}
