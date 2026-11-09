import { Bell, LogOut, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { api, dataOf } from "../api/client";
import { signOut, useSession, withAuth } from "../auth/session";
import { localizedPath } from "../i18n/config";
import { LocalizedLink, useLocale, useRootData } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Popover, popoverItem } from "../ui/Popover";
import { Skeleton } from "../ui/Skeleton";
import { accountLinks, headerShortcut } from "./account-nav";
import { toast } from "../ui/toast-store";

/** Unread counters for the header badges; refreshed when the window regains focus. */
function useUnread(enabled: boolean) {
  const [counts, setCounts] = useState({ notifications: 0, chats: 0 });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      const [n, c] = await Promise.all([
        withAuth(() => api.GET("/me/notifications/unread-count")),
        withAuth(() => api.GET("/conversations/unread-count")),
      ]);
      if (!alive) return;
      setCounts({
        notifications: dataOf<{ unread: number }>(n)?.unread ?? 0,
        chats: dataOf<{ conversations: number }>(c)?.conversations ?? 0,
      });
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
    };
  }, [enabled]);
  return counts;
}

function CountBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="num absolute -right-0.5 -top-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-anor px-1 text-[0.6875rem] font-semibold text-white">
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

export function UserArea() {
  const { t } = useTranslation();
  const { hasSession } = useRootData();
  const { status, user } = useSession();
  const counts = useUnread(status === "authed");
  const onSignOut = useSignOut();

  if (status === "loading" && hasSession) {
    return <Skeleton className="ml-2 size-9 rounded-full" />;
  }
  if (status !== "authed" || !user) {
    return (
      <>
        <Button asChild variant="ghost" className="ml-1">
          <LocalizedLink to="/login">{t("nav.signIn")}</LocalizedLink>
        </Button>
        <Button asChild>
          <LocalizedLink to="/register">{t("nav.signUp")}</LocalizedLink>
        </Button>
      </>
    );
  }
  const cta = headerShortcut(user);
  const iconLink = "relative grid size-11 place-items-center rounded-control text-ink-2 transition-colors hover:bg-sunken hover:text-ink";
  return (
    <>
      {cta && (
        <Button asChild variant="soft" className="ml-1" icon={<cta.icon className="size-4" />}>
          <LocalizedLink to={cta.to}>{t(cta.key)}</LocalizedLink>
        </Button>
      )}
      <LocalizedLink to="/chat" className={iconLink} aria-label={t("nav.messages")} title={t("nav.messages")}>
        <MessageSquare className="size-5" />
        <CountBadge n={counts.chats} />
      </LocalizedLink>
      <LocalizedLink to="/me/notifications" className={iconLink} aria-label={t("account.notifications")} title={t("account.notifications")}>
        <Bell className="size-5" />
        <CountBadge n={counts.notifications} />
      </LocalizedLink>
      <Popover
        label={t("account.menu")}
        className="w-64"
        trigger={(p) => (
          <button popoverTarget={p.popoverTarget} aria-label={p["aria-label"]} className="ml-1 rounded-full">
            <Avatar name={user.full_name} src={user.avatar_url} size="sm" className="size-9" />
          </button>
        )}
      >
        <div className="border-b border-line px-2.5 pb-2.5 pt-1.5">
          <p className="truncate text-sm font-semibold">{user.full_name}</p>
          <p className="truncate text-xs text-ink-3">{user.email ?? user.phone}</p>
        </div>
        <nav className="py-1">
          {accountLinks(user).map((l) => (
            <LocalizedLink key={l.to} to={l.to} className={popoverItem}>{t(l.key)}</LocalizedLink>
          ))}
        </nav>
        <div className="border-t border-line pt-1">
          <button onClick={onSignOut} className={cn(popoverItem, "text-anor-ink")}>
            <LogOut className="size-4" />
            {t("nav.signOut")}
          </button>
        </div>
      </Popover>
    </>
  );
}
