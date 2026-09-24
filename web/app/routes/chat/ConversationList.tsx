import { useInfiniteQuery } from "@tanstack/react-query";
import { Ban, Check, CheckCheck, FileText, Image as ImageIcon, Inbox, MapPin, Mic, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";

import { counterpart, type Conversation, type Message } from "./types";
import { api } from "~/shared/api/client";
import { useSession } from "~/shared/auth/session";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation, type TFunction } from "~/shared/i18n/i18n";
import { useUnread } from "~/shared/layout/UserArea";
import { cn } from "~/shared/lib/cn";
import { clock, dayLabel, groupDigits } from "~/shared/lib/format";
import { authedPage } from "~/shared/query/query";
import { LoadMore } from "~/shared/query/LoadMore";
import { onRealtime } from "~/shared/realtime/socket";
import { Avatar } from "~/shared/ui/Avatar";
import { Button } from "~/shared/ui/Button";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";

/** Text of a message preview plus the lucide icon of its attachment kind (never emoji). */
export function previewOf(m: Message | null, t: TFunction): { icon?: LucideIcon; text: string } {
  if (!m) return { text: t("chat.noMessages") };
  if (m.deleted) return { icon: Ban, text: t("chat.deleted") };
  switch (m.kind) {
    case "image": return { icon: ImageIcon, text: m.body || t("chat.photo") };
    case "file": return { icon: FileText, text: m.file?.name ?? t("chat.file") };
    case "voice": return { icon: Mic, text: t("chat.voice") };
    case "location": return { icon: MapPin, text: t("chat.location") };
    default: return { text: m.body };
  }
}

// Phones: rows inside one solid card with iOS-style inset hairlines. From md the list sits in its
// own pane of the chat card, so rows are plain with a tinted active state.
const listBox = "max-md:surface-card max-md:overflow-hidden md:flex md:flex-col md:gap-0.5";

export function ConversationList({ activeId }: { activeId?: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { user } = useSession();
  const company = user?.role === "employer";
  const { chats } = useUnread(true);
  const q = useInfiniteQuery({
    queryKey: ["conversations"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => authedPage<Conversation>(() => api.GET("/conversations", { params: { query: { cursor: pageParam } } })),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  const loading = useSkeletonHold(q.isPending);
  const typing = useTypingIds(user?.id);
  const narrow = useNarrow();
  // Only the rows of the first paint get the entrance stagger; later pages and refetches don't.
  // The class goes once it has played: a list shown again after display:none (phones, back from
  // a thread) would otherwise replay it.
  const entered = useRef<Set<string> | null>(null);
  if (!entered.current && items.length) entered.current = new Set(items.slice(0, 8).map((c) => c.id));
  const [settled, setSettled] = useState(false);
  const firstPaint = items.length > 0;
  useEffect(() => {
    if (!firstPaint) return;
    const timer = setTimeout(() => setSettled(true), 700);
    return () => clearTimeout(timer);
  }, [firstPaint]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <header className="px-4 pb-4 pt-6 md:px-5 md:pb-3 md:pt-6">
        <div className="flex items-center gap-2.5">
          <h1 id="chat-title" className="font-display text-2xl font-semibold tracking-heading text-ink">{t("nav.messages")}</h1>
          {chats > 0 && (
            <span className="num grid h-6 min-w-6 place-items-center rounded-pill bg-lapis px-2 text-xs font-semibold text-on-lapis">
              <span aria-hidden="true">{chats > 99 ? "99+" : groupDigits(chats)}</span>
              <span className="sr-only">{t("chatPage.unreadChats", { count: chats })}</span>
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-ink-2">{t(company ? "chatPage.subtitleCompany" : "chatPage.subtitleSeeker")}</p>
      </header>

      <div
        aria-busy={q.isRefetching || undefined}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 transition-opacity md:px-2 md:pb-2",
          // Realtime refetches are quick and constant: only a slow one dims the stale list.
          q.isRefetching && !q.isFetchingNextPage && "opacity-70 delay-500",
        )}
      >
        {loading ? (
          <SkeletonDelay><ConversationSkeleton /></SkeletonDelay>
        ) : q.isError ? (
          <div className="max-md:surface-card">
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          </div>
        ) : items.length === 0 ? (
          <div className="max-md:surface-card">
            <EmptyState
              icon={<Inbox />}
              headingAs="h2"
              title={t("chat.emptyTitle")}
              body={t("chat.emptyBody")}
              action={
                <Button asChild>
                  <LocalizedLink to={company ? "/employer" : "/vacancies"} prefetch="intent">
                    {t(company ? "chatPage.emptyActionCompany" : "chatPage.emptyActionSeeker")}
                  </LocalizedLink>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <ul aria-labelledby="chat-title" className={listBox}>
              {items.map((c, i) => {
                const enter = !settled && entered.current?.has(c.id);
                return (
                  <li key={c.id} className={cn("group/item", enter && "anim-enter")} style={enter ? ({ "--i": i } as CSSProperties) : undefined}>
                    <Row c={c} active={c.id === activeId} typing={typing.has(c.id)} slide={narrow} me={user?.id} t={t} locale={locale} />
                  </li>
                );
              })}
            </ul>
            <LoadMore hasNext={q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} loadedCount={items.length} />
          </>
        )}
      </div>
    </div>
  );
}

function Row({ c, active, typing, slide, me, t, locale }: {
  c: Conversation; active: boolean; typing: boolean; slide: boolean; me?: string; t: TFunction; locale: ReturnType<typeof useLocale>;
}) {
  const who = counterpart(c);
  const unread = c.unread > 0;
  const last = c.last_message;
  const mine = !!last && !last.deleted && last.sender?.id === me;
  const { icon: Icon, text } = previewOf(last, t);
  const day = c.last_message_at ? dayLabel(c.last_message_at, t, locale) : null;
  return (
    <LocalizedLink
      to={`/chat/${c.id}`}
      prefetch="intent"
      viewTransition={slide}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 pl-4 transition-colors focus-visible:-outline-offset-2 active:bg-sunken",
        "md:rounded-control md:px-3 md:py-2.5",
        active ? "md:bg-lapis-soft" : "md:hover:bg-sunken",
      )}
    >
      <Avatar name={who.name} src={who.avatar} square={who.square} className="size-12" />
      {/* The hairline starts at the text, like native lists; not above the first row. */}
      <div className="min-w-0 flex-1 border-line py-3 pr-4 max-md:border-t max-md:group-first/item:border-t-0 md:p-0">
        <div className="flex items-baseline gap-2">
          <p className={cn("min-w-0 flex-1 truncate text-md text-ink", unread ? "font-semibold" : "font-medium")}>{who.name}</p>
          {c.last_message_at && (
            <time dateTime={c.last_message_at} className={cn("num shrink-0 text-xs", unread ? "font-semibold text-lapis-ink" : "text-ink-3")}>
              {day === t("chat.today") ? clock(c.last_message_at) : day}
            </time>
          )}
        </div>
        <p className="truncate text-xs text-ink-3">{c.vacancy.title}</p>
        <div className="mt-0.5 flex items-center gap-2">
          {typing ? (
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-lapis-ink">{t("chat.typing")}</p>
          ) : (
            <p className={cn("flex min-w-0 flex-1 items-center gap-1 text-sm", unread ? "text-ink" : "text-ink-2")}>
              {mine && last.id > 0 && (last.id <= c.read_up_to
                ? <CheckCheck className="size-4 shrink-0 text-lapis-ink" aria-label={t("chat.seen")} role="img" />
                : <Check className="size-4 shrink-0 text-ink-3" aria-label={t("chat.sent")} role="img" />)}
              {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
              <span className="truncate">{mine ? t("chatPage.you", { text }) : text}</span>
            </p>
          )}
          {unread && (
            <span className="num grid h-5 min-w-5 shrink-0 place-items-center rounded-pill bg-lapis px-1.5 text-2xs font-semibold text-on-lapis">
              <span aria-hidden="true">{c.unread > 99 ? "99+" : groupDigits(c.unread)}</span>
              <span className="sr-only">{t("chatPage.unreadMessages", { count: c.unread })}</span>
            </span>
          )}
        </div>
      </div>
    </LocalizedLink>
  );
}

/** Rows with the exact line boxes of the real ones (same text classes), so nothing moves on arrival. */
export function ConversationSkeleton({ count = 7 }: { count?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <ul aria-hidden="true" className={listBox}>
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="group/item flex items-center gap-3 pl-4 md:px-3 md:py-2.5">
            <Skeleton className={cn("size-12 shrink-0", i % 3 === 1 ? "rounded-control" : "rounded-full")} />
            <div className="min-w-0 flex-1 border-line py-3 pr-4 max-md:border-t max-md:group-first/item:border-t-0 md:p-0">
              <div className="flex items-baseline gap-2">
                <div className="min-w-0 flex-1 text-md"><Skeleton className="inline-block h-3.5 w-3/5 align-middle" /></div>
                <div className="text-xs"><Skeleton className="inline-block h-3 w-9 align-middle" /></div>
              </div>
              <div className="text-xs"><Skeleton className="inline-block h-2.5 w-1/2 align-middle" /></div>
              <div className="mt-0.5 text-sm"><Skeleton className={cn("inline-block h-3 align-middle", i % 2 ? "w-3/4" : "w-3/5")} /></div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Conversations whose other side is typing right now (typing frames arrive for every chat). */
function useTypingIds(me?: string): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const drop = (id: string) => {
      clearTimeout(timers.get(id));
      timers.delete(id);
      setIds((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : s));
    };
    const off = onRealtime((e) => {
      const id = e.data?.conversation_id as string | undefined;
      if (!id) return;
      if (e.type === "typing" && e.data.user_id !== me) {
        setIds((s) => (s.has(id) ? s : new Set(s).add(id)));
        clearTimeout(timers.get(id));
        timers.set(id, setTimeout(() => drop(id), 4500));
      } else if (e.type === "message.new") {
        drop(id);
      }
    });
    return () => { off(); timers.forEach(clearTimeout); };
  }, [me]);
  return ids;
}

// Phones only: there the thread slides in over the list (a view transition). Side by side on
// wider screens, switching conversations stays instant (a transition would block input briefly).
const NARROW = "(width < 48rem)";
function useNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(NARROW);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}
