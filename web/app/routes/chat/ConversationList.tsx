import { useInfiniteQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";

import { counterpart, type Conversation, type Message } from "./types";
import { api } from "~/shared/api/client";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation, type TFunction } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { clock, dayLabel } from "~/shared/lib/format";
import { useLocale } from "~/shared/i18n/hooks";
import { authedPage } from "~/shared/query/query";
import { LoadMore } from "~/shared/query/LoadMore";
import { Avatar } from "~/shared/ui/Avatar";
import { EmptyState } from "~/shared/ui/EmptyState";
import { Skeleton } from "~/shared/ui/Skeleton";

export function preview(m: Message | null, t: TFunction): string {
  if (!m) return t("chat.noMessages");
  if (m.deleted) return t("chat.deleted");
  switch (m.kind) {
    case "image": return m.body ? `🖼 ${m.body}` : `🖼 ${t("chat.photo")}`;
    case "file": return `📎 ${m.file?.name ?? t("chat.file")}`;
    case "voice": return `🎤 ${t("chat.voice")}`;
    case "location": return `📍 ${t("chat.location")}`;
    default: return m.body;
  }
}

export function ConversationList({ activeId }: { activeId?: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const q = useInfiniteQuery({
    queryKey: ["conversations"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => authedPage<Conversation>(() => api.GET("/conversations", { params: { query: { cursor: pageParam } } })),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  const when = (iso: string) => (dayLabel(iso, t, locale) === t("chat.today") ? clock(iso) : dayLabel(iso, t, locale));

  return (
    <div className="flex w-full flex-col">
      <h1 className="px-5 pb-3 pt-5 font-display text-xl font-semibold tracking-[-0.02em] text-ink">{t("nav.messages")}</h1>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {q.isPending ? (
          <div className="flex flex-col gap-2 px-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-control" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Inbox className="size-6" />} title={t("chat.emptyTitle")} body={t("chat.emptyBody")} />
        ) : (
          <ul className="px-2 pb-2">
            {items.map((c) => {
              const who = counterpart(c);
              return (
                <li key={c.id}>
                  <LocalizedLink
                    to={`/chat/${c.id}`}
                    aria-current={c.id === activeId ? "page" : undefined}
                    className={cn("flex items-center gap-3 rounded-control px-3 py-3 transition-colors", c.id === activeId ? "bg-lapis-soft" : "hover:bg-sunken")}
                  >
                    <Avatar name={who.name} src={who.avatar} square={who.square} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn("truncate text-sm text-ink", c.unread ? "font-semibold" : "font-medium")}>{who.name}</p>
                        {c.last_message_at && <span className="num shrink-0 text-xs text-ink-3">{when(c.last_message_at)}</span>}
                      </div>
                      <p className="truncate text-xs text-ink-3">{c.vacancy.title}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className={cn("min-w-0 flex-1 truncate text-sm", c.unread ? "text-ink" : "text-ink-2")}>{preview(c.last_message, t)}</p>
                        {c.unread > 0 && <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-lapis px-1.5 text-[0.6875rem] font-semibold text-on-lapis">{c.unread > 99 ? "99+" : c.unread}</span>}
                      </div>
                    </div>
                  </LocalizedLink>
                </li>
              );
            })}
          </ul>
        )}
        <LoadMore hasNext={q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />
      </div>
    </div>
  );
}
