import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Composer, type Outgoing } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { counterpart, type Conversation, type Message } from "./types";
import { api } from "~/shared/api/client";
import { useSession, withAuth } from "~/shared/auth/session";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { dayLabel, relativeTime } from "~/shared/lib/format";
import { authed } from "~/shared/query/query";
import { onConnection, onRealtime, send, watchPresence } from "~/shared/realtime/socket";
import { uploadFile } from "~/shared/upload/upload";
import { Avatar } from "~/shared/ui/Avatar";
import { Button } from "~/shared/ui/Button";
import { Skeleton } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";

type Page = { data: Message[]; meta: { next_before?: number | null } };
const PAGE = 40;

async function fetchMessages(id: string, query: { before?: number; after?: number; limit?: number }): Promise<Page> {
  const res = await withAuth(() => api.GET("/conversations/{conversation}/messages", { params: { path: { conversation: id }, query } }));
  const body = res.data as Page | undefined;
  return { data: body?.data ?? [], meta: body?.meta ?? {} };
}

/** Insert or replace by id / client_id, keeping ascending order. */
function upsert(list: Message[], m: Message): Message[] {
  const i = list.findIndex((x) => (m.id > 0 && x.id === m.id) || x.client_id === m.client_id);
  const next = i >= 0 ? list.map((x, j) => (j === i ? { ...m } : x)) : [...list, m];
  return next.sort((a, b) => (a.id > 0 && b.id > 0 ? a.id - b.id : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
}

export function Thread({ id }: { id: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { user } = useSession();
  const me = user!.id;
  const conv = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => authed<Conversation>(() => api.GET("/conversations/{conversation}", { params: { path: { conversation: id } } })),
  });
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [olderCursor, setOlderCursor] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [otherRead, setOtherRead] = useState(0);
  const [typing, setTyping] = useState(false);
  const [presence, setPresence] = useState<{ online: boolean; last_seen_at: string | null } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // follow new messages while the user is at the bottom
  const keepFrom = useRef<number | null>(null); // scrollHeight before prepending older messages
  const lastRead = useRef(0);
  const pendingFiles = useRef(new Map<string, Outgoing>());

  // Initial page.
  useEffect(() => {
    let alive = true;
    void fetchMessages(id, { limit: PAGE }).then((p) => {
      if (!alive) return;
      setMsgs([...p.data].reverse());
      setOlderCursor(p.meta.next_before ?? null);
    });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => { if (conv.data) setOtherRead((r) => Math.max(r, conv.data.read_up_to)); }, [conv.data]);

  const who = conv.data ? counterpart(conv.data) : null;

  // Live events for this conversation.
  useEffect(() => {
    let typingTimer: ReturnType<typeof setTimeout> | undefined;
    const off = onRealtime((e) => {
      const d = e.data ?? {};
      if (e.type === "message.new" && d.conversation_id === id) {
        setMsgs((l) => upsert(l ?? [], d as Message));
        if ((d as Message).sender?.id !== me) setTyping(false);
      } else if (e.type === "message.read" && d.conversation_id === id && d.user_id !== me) {
        setOtherRead((r) => Math.max(r, d.message_id));
      } else if (e.type === "message.deleted" && d.conversation_id === id) {
        setMsgs((l) => l?.map((m) => (m.id === d.message_id ? { ...m, deleted: true, body: "", file: undefined } : m)) ?? l);
      } else if (e.type === "typing" && d.conversation_id === id && d.user_id !== me) {
        setTyping(true);
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => setTyping(false), 4500);
      } else if (e.type === "presence.snapshot" || e.type === "presence") {
        const states = (Array.isArray(d) ? d : [d]) as { user_id: string; online: boolean; last_seen_at: string | null }[];
        const s = states.find((x) => x.user_id === who?.userId);
        if (s) setPresence({ online: s.online, last_seen_at: s.last_seen_at });
      }
    });
    return () => { off(); clearTimeout(typingTimer); };
  }, [id, me, who?.userId]);

  // After a reconnect, fetch whatever arrived while we were offline.
  const newest = useRef(0);
  newest.current = msgs?.reduce((a, m) => Math.max(a, m.id), 0) ?? 0;
  useEffect(() => {
    let wasOffline = false;
    return onConnection((online) => {
      if (!online) { wasOffline = true; return; }
      if (wasOffline && newest.current) {
        void fetchMessages(id, { after: newest.current, limit: 100 }).then((p) => setMsgs((l) => p.data.reduce(upsert, l ?? [])));
      }
      wasOffline = false;
    });
  }, [id]);

  useEffect(() => {
    if (who?.userId) watchPresence([who.userId]);
    return () => watchPresence([]);
  }, [who?.userId]);

  // Read receipts: tell the server how far we've read while the tab is visible.
  const markRead = useCallback(() => {
    if (!msgs || document.visibilityState !== "visible") return;
    const latest = [...msgs].reverse().find((m) => m.id > 0 && m.sender?.id !== me);
    if (!latest || latest.id <= lastRead.current) return;
    lastRead.current = latest.id;
    send({ type: "read", conversation_id: id, message_id: latest.id });
    window.dispatchEvent(new Event("jv:unread"));
  }, [msgs, id, me]);
  useEffect(() => {
    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [markRead]);

  // Scrolling: bottom on first render and on new messages (if already at the bottom);
  // keep the position when older messages are prepended.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !msgs) return;
    if (keepFrom.current !== null) {
      el.scrollTop += el.scrollHeight - keepFrom.current;
      keepFrom.current = null;
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [msgs, typing]);

  const loadOlder = async () => {
    if (!olderCursor || loadingOlder) return;
    setLoadingOlder(true);
    const p = await fetchMessages(id, { before: olderCursor, limit: PAGE }).catch(() => null);
    setLoadingOlder(false);
    if (!p) return;
    keepFrom.current = scroller.current?.scrollHeight ?? null;
    setMsgs((l) => [...[...p.data].reverse(), ...(l ?? [])]);
    setOlderCursor(p.meta.next_before ?? null);
  };

  const post = async (clientId: string, o: Outgoing) => {
    try {
      let body: Record<string, unknown> = { client_id: clientId, kind: o.kind };
      if (o.kind === "text") body.body = o.body;
      else if (o.kind === "location") body.location = { lat: o.lat, lng: o.lng };
      else {
        const blob = o.kind === "voice" ? o.blob : o.file;
        const purpose = o.kind === "image" ? "chat_image" : o.kind === "voice" ? "chat_voice" : "chat_file";
        const meta = o.kind === "voice" ? { duration_ms: Math.round(o.durationMs) } : o.kind === "image" ? await imageSize(o.file) : undefined;
        const named = o.kind === "voice" ? Object.assign(blob, { name: `voice.${blob.type.split("/")[1] ?? "webm"}` }) : blob;
        const f = await uploadFile(named, purpose, { meta });
        body = { ...body, file_id: f.id, body: o.kind === "image" ? o.body : undefined };
      }
      const res = await withAuth(() => api.POST("/conversations/{conversation}/messages", { params: { path: { conversation: id } }, body: body as never }));
      if (!res.response.ok) throw new Error(String(res.response.status));
      const saved = (res.data as { data?: Message } | undefined)?.data;
      if (saved) setMsgs((l) => upsert(l ?? [], saved));
      pendingFiles.current.delete(clientId);
    } catch {
      setMsgs((l) => l?.map((m) => (m.client_id === clientId ? { ...m, pending: false, failed: true } : m)) ?? l);
    }
  };

  const onSend = (o: Outgoing) => {
    const clientId = crypto.randomUUID();
    const local: Message = {
      id: 0, conversation_id: id, sender: { id: me, full_name: user!.full_name, avatar_url: user!.avatar_url }, kind: o.kind,
      body: o.kind === "text" ? o.body : o.kind === "image" ? (o.body ?? "") : "", client_id: clientId, created_at: new Date().toISOString(), deleted: false, pending: true,
      file: o.kind === "image" ? { id: "", content_type: o.file.type, size: o.file.size, name: o.file.name, url: URL.createObjectURL(o.file) }
        : o.kind === "file" ? { id: "", content_type: o.file.type, size: o.file.size, name: o.file.name }
        : o.kind === "voice" ? { id: "", content_type: o.blob.type, size: o.blob.size, name: "voice", url: URL.createObjectURL(o.blob), meta: { duration_ms: o.durationMs } } : undefined,
      location: o.kind === "location" ? { lat: o.lat, lng: o.lng } : undefined,
    };
    stick.current = true;
    pendingFiles.current.set(clientId, o);
    setMsgs((l) => [...(l ?? []), local]);
    void post(clientId, o);
  };

  const retry = (m: Message) => {
    const o = pendingFiles.current.get(m.client_id);
    if (!o) return;
    setMsgs((l) => l?.map((x) => (x.client_id === m.client_id ? { ...x, failed: false, pending: true } : x)) ?? l);
    void post(m.client_id, o);
  };

  const remove = async (m: Message) => {
    const res = await withAuth(() => api.DELETE("/messages/{message}", { params: { path: { message: m.id } } }));
    if (res.response.ok) setMsgs((l) => l?.map((x) => (x.id === m.id ? { ...x, deleted: true } : x)) ?? l);
    else toast({ tone: "error", title: t("apiErrors.delete_window_passed") });
  };

  const status = typing ? t("chat.typing") : presence?.online ? t("chat.online") : presence?.last_seen_at ? t("chat.lastSeen", { when: relativeTime(presence.last_seen_at, t) }) : conv.data?.vacancy.title;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-3 py-2.5 md:px-5">
        <LocalizedLink to="/chat" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-sunken md:hidden" aria-label={t("common.back")}>
          <ArrowLeft className="size-5" />
        </LocalizedLink>
        {who ? (
          <>
            <div className="relative">
              <Avatar name={who.name} src={who.avatar} square={who.square} />
              {presence?.online && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-firuza ring-2 ring-surface" aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">{who.name}</p>
              <p className={`truncate text-xs ${typing || presence?.online ? "text-firuza-ink" : "text-ink-3"}`} aria-live="polite">{status}</p>
            </div>
            <Button asChild variant="ghost" size="sm" icon={<ExternalLink className="size-4" />} className="max-sm:hidden">
              <LocalizedLink to={conv.data!.side === "company" ? `/employer/applications/${conv.data!.application_id}` : `/me/applications/${conv.data!.application_id}`}>
                {t("chat.application")}
              </LocalizedLink>
            </Button>
          </>
        ) : <Skeleton className="h-10 w-48" />}
      </header>

      <div
        ref={scroller}
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 md:px-6"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          if (el.scrollTop < 120) void loadOlder();
        }}
      >
        {!msgs ? (
          <div className="flex flex-col gap-3">{[40, 60, 30].map((w, i) => <Skeleton key={i} className={`h-10 rounded-2xl ${i % 2 ? "ml-auto" : ""}`} style={{ width: `${w}%` }} />)}</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {olderCursor && <p className="py-2 text-center text-xs text-ink-3">{loadingOlder ? t("common.loading") : ""}</p>}
            {msgs.length === 0 && <p className="py-10 text-center text-sm text-ink-3">{t("chat.startHint")}</p>}
            {msgs.map((m, i) => {
              const prev = msgs[i - 1];
              const day = dayLabel(m.created_at, t, locale);
              const newDay = !prev || dayLabel(prev.created_at, t, locale) !== day;
              const mine = m.sender?.id === me;
              // Teammates on the company side see who wrote each message.
              const showName = !mine && conv.data?.side === "company" && m.sender && m.sender.id !== conv.data.seeker.id && prev?.sender?.id !== m.sender.id;
              return (
                <Fragment key={m.client_id || m.id}>
                  {newDay && <p className="sticky top-0 z-10 mx-auto my-2 w-fit rounded-full bg-surface/90 px-3 py-1 text-xs font-medium text-ink-3 shadow-sm backdrop-blur">{day}</p>}
                  {showName && <p className="ml-1 mt-2 text-xs text-ink-3">{m.sender!.full_name}</p>}
                  <div className={prev && prev.sender?.id !== m.sender?.id ? "mt-2" : undefined}>
                    <MessageBubble m={m} mine={mine} seen={m.id > 0 && m.id <= otherRead} onDelete={() => void remove(m)} onRetry={() => retry(m)} />
                  </div>
                </Fragment>
              );
            })}
            {typing && (
              <div className="mt-2 flex w-fit items-center gap-1 rounded-[1.125rem] rounded-bl-md bg-sunken px-4 py-3" aria-hidden="true">
                {[0, 150, 300].map((d) => <span key={d} className="size-1.5 animate-bounce rounded-full bg-ink-3" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            )}
          </div>
        )}
      </div>

      <Composer onSend={onSend} onTyping={() => send({ type: "typing", conversation_id: id })} />
    </div>
  );
}

async function imageSize(f: File): Promise<{ width: number; height: number } | undefined> {
  try {
    const bmp = await createImageBitmap(f);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return undefined;
  }
}
