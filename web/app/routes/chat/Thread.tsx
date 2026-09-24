import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, FileText, Upload } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";

import { Composer, fileMessage, type Outgoing } from "./Composer";
import { previewOf } from "./ConversationList";
import { MessageBubble } from "./MessageBubble";
import { applicationHref, counterpart, sameGroup, type Conversation, type Message } from "./types";
import { api, apiError } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { useSession, withAuth } from "~/shared/auth/session";
import { GirihPattern } from "~/shared/brand/GirihPattern";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { dayLabel, relativeTime } from "~/shared/lib/format";
import { ApiFailure, authed } from "~/shared/query/query";
import { onConnection, onRealtime, send, watchPresence } from "~/shared/realtime/socket";
import { uploadFile } from "~/shared/upload/upload";
import { Avatar } from "~/shared/ui/Avatar";
import { Button, IconButton } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { useConfirm } from "~/shared/ui/ConfirmDialog";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";

type Page = { data: Message[]; meta: { next_before?: number | null } };
const PAGE = 40;
const NEAR = 96; // px from the end that still count as "reading the latest message"
const PREFETCH = 600; // start loading older messages this far before the top

async function fetchMessages(id: string, query: { before?: number; after?: number; limit?: number }): Promise<Page> {
  const res = await withAuth(() => api.GET("/conversations/{conversation}/messages", { params: { path: { conversation: id }, query } }));
  if (!res.response.ok) throw new ApiFailure(apiError(res) ?? { code: "internal_error", message: "" }, res.response.status);
  const body = res.data as Page | undefined;
  return { data: body?.data ?? [], meta: body?.meta ?? {} };
}

/** Insert or replace by id / client_id, keeping ascending order. */
function upsert(list: Message[], m: Message): Message[] {
  const i = list.findIndex((x) => (m.id > 0 && x.id === m.id) || x.client_id === m.client_id);
  const next = i >= 0 ? list.map((x, j) => (j === i ? { ...m } : x)) : [...list, m];
  return next.sort((a, b) => (a.id > 0 && b.id > 0 ? a.id - b.id : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  const [loadError, setLoadError] = useState<unknown>(null);
  const [olderCursor, setOlderCursor] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderFailed, setOlderFailed] = useState(false);
  const [otherRead, setOtherRead] = useState(0);
  const [typing, setTyping] = useState(false);
  const [presence, setPresence] = useState<{ online: boolean; last_seen_at: string | null } | null>(null);
  const [away, setAway] = useState(false); // scrolled well above the latest message
  const [unseen, setUnseen] = useState(0); // messages that arrived while away
  const [announce, setAnnounce] = useState("");
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // follow new messages while the reader is at the end
  const keepFrom = useRef<number | null>(null); // scrollHeight before older messages were prepended
  const olderBusy = useRef(false);
  const lastRead = useRef(0);
  const dragDepth = useRef(0);
  const heard = useRef(new Set<number>());
  const pendingFiles = useRef(new Map<string, Outgoing>());
  const { confirm, dialog } = useConfirm();
  useKeyboardInset(root);

  // Initial page (also the Retry of the error state, which waits for this promise).
  const loadInitial = useCallback(
    () => fetchMessages(id, { limit: PAGE }).then(
      (p) => {
        setMsgs([...p.data].reverse());
        setOlderCursor(p.meta.next_before ?? null);
        setLoadError(null);
      },
      (e: unknown) => setLoadError(e),
    ),
    [id],
  );
  useEffect(() => { void loadInitial(); }, [loadInitial]);
  const skeleton = useSkeletonHold(msgs === null && !loadError);

  useEffect(() => { if (conv.data) setOtherRead((r) => Math.max(r, conv.data.read_up_to)); }, [conv.data]);

  const who = conv.data ? counterpart(conv.data) : null;

  // Live events for this conversation.
  useEffect(() => {
    let typingTimer: ReturnType<typeof setTimeout> | undefined;
    const off = onRealtime((e) => {
      const d = e.data ?? {};
      if (e.type === "message.new" && d.conversation_id === id) {
        const m = d as Message;
        setMsgs((l) => upsert(l ?? [], m));
        // Count and announce each message once, even if the event arrives more than once.
        if (m.sender?.id !== me && !heard.current.has(m.id)) {
          heard.current.add(m.id);
          setTyping(false);
          if (!stick.current) setUnseen((u) => u + 1);
          setAnnounce(t("chatPage.newFrom", { name: m.sender?.full_name ?? "", text: previewOf(m, t).text }));
        }
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
  }, [id, me, who?.userId, t]);

  // After a reconnect, fetch whatever arrived while we were offline.
  const newest = useRef(0);
  newest.current = msgs?.reduce((a, m) => Math.max(a, m.id), 0) ?? 0;
  useEffect(() => {
    let wasOffline = false;
    return onConnection((online) => {
      if (!online) { wasOffline = true; return; }
      if (wasOffline && newest.current) {
        fetchMessages(id, { after: newest.current, limit: 100 }).then((p) => setMsgs((l) => p.data.reduce(upsert, l ?? [])), () => {});
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

  const loadOlder = useCallback(async (force = false) => {
    if (!olderCursor || olderBusy.current || (olderFailed && !force)) return;
    olderBusy.current = true;
    setOlderFailed(false);
    setLoadingOlder(true);
    try {
      const p = await fetchMessages(id, { before: olderCursor, limit: PAGE });
      keepFrom.current = scroller.current?.scrollHeight ?? null;
      setMsgs((l) => [...[...p.data].reverse(), ...(l ?? [])]);
      setOlderCursor(p.meta.next_before ?? null);
    } catch {
      setOlderFailed(true);
    } finally {
      olderBusy.current = false;
      setLoadingOlder(false);
    }
  }, [id, olderCursor, olderFailed]);

  // Scroll anchoring is done by hand (overflow-anchor: none on the scroller): prepending older
  // messages keeps the reader's place exactly; otherwise follow the end if they were there.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !msgs) return;
    if (keepFrom.current !== null) {
      el.scrollTop += el.scrollHeight - keepFrom.current;
      keepFrom.current = null;
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
    }
    // A short thread never scrolls, so fetch the history before it's asked for.
    if (el.scrollTop < PREFETCH) void loadOlder();
  }, [msgs, olderCursor, loadOlder]);

  // Anything that changes heights while the reader is at the end — photos and voice notes
  // loading, the typing dots, the composer growing, the phone keyboard — keeps the end in view.
  useEffect(() => {
    const el = scroller.current, inner = content.current;
    if (!el || !inner || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (stick.current) el.scrollTop = el.scrollHeight; });
    ro.observe(el);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stick.current = dist < NEAR;
    if (stick.current) setUnseen(0);
    setAway(dist > el.clientHeight * 0.6);
    if (el.scrollTop < PREFETCH) void loadOlder();
  };

  const toLatest = () => {
    const el = scroller.current;
    if (!el) return;
    stick.current = true;
    setUnseen(0);
    if (reducedMotion()) { el.scrollTop = el.scrollHeight; return; }
    // From far away, jump to two screens above the end first: a long smooth scroll feels slow.
    if (el.scrollHeight - el.scrollTop - el.clientHeight > el.clientHeight * 3) el.scrollTop = el.scrollHeight - el.clientHeight * 2;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
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
    setUnseen(0);
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

  // Optimistic delete: the bubble turns into "deleted" at once and comes back if the server refuses.
  const remove = async (m: Message) => {
    const ok = await confirm({ title: t("chatPage.deleteTitle"), body: t("chatPage.deleteBody"), tone: "danger", confirmLabel: t("common.delete") });
    if (!ok) return;
    setMsgs((l) => l?.map((x) => (x.id === m.id ? { ...x, deleted: true } : x)) ?? l);
    try {
      const res = await withAuth(() => api.DELETE("/messages/{message}", { params: { path: { message: m.id } } }));
      if (!res.response.ok) throw new ApiFailure(apiError(res) ?? { code: "internal_error", message: "" }, res.response.status);
    } catch (e) {
      setMsgs((l) => l?.map((x) => (x.id === m.id ? m : x)) ?? l);
      toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network") });
    }
  };

  // Day groups; the label doubles as the key (one label per calendar day).
  const days = useMemo(() => {
    const out: { label: string; items: Message[] }[] = [];
    for (const m of msgs ?? []) {
      const label = dayLabel(m.created_at, t, locale);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(m);
      else out.push({ label, items: [m] });
    }
    return out;
  }, [msgs, t, locale]);

  const status = typing ? t("chat.typing")
    : presence?.online ? t("chat.online")
    : presence?.last_seen_at ? t("chat.lastSeen", { when: relativeTime(presence.last_seen_at, t) }) : null;
  const back = (
    <IconButton asChild label={t("common.back")} shape="pill" className="md:hidden">
      <LocalizedLink to="/chat" viewTransition><ArrowLeft className="size-5" /></LocalizedLink>
    </IconButton>
  );

  if (conv.isError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="glass-bar shrink-0 pt-safe md:hidden"><div className="flex h-16 items-center px-2">{back}</div></header>
        <div className="grid flex-1 place-items-center p-4">
          {conv.error instanceof ApiFailure && conv.error.status === 404 ? (
            // Retrying a conversation that doesn't exist (or isn't ours) can't help: offer the list.
            <div className="flex flex-col items-center">
              <ErrorState error={conv.error} title={t("chatPage.notFound")} />
              <Button asChild variant="secondary" icon={<ArrowLeft className="size-4" />} className="-mt-6">
                <LocalizedLink to="/chat" viewTransition>{t("nav.messages")}</LocalizedLink>
              </Button>
            </div>
          ) : <ErrorState error={conv.error} onRetry={() => conv.refetch()} />}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={root}
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={(e) => { if (e.dataTransfer.types.includes("Files")) { dragDepth.current++; setDragging(true); } }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
      onDragLeave={() => { if (--dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }}
      onDrop={(e) => {
        const f = e.dataTransfer.files[0];
        dragDepth.current = 0;
        setDragging(false);
        if (!f) return;
        e.preventDefault();
        const o = fileMessage(f, t);
        if (o) onSend(o);
      }}
    >
      {/* Tilework "wallpaper" behind the thread: static, painted once. */}
      <GirihPattern reveal={false} focus="ellipse 95% 80% at 50% 50%" />

      <div
        ref={scroller}
        onScroll={onScroll}
        className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
        style={{ overflowAnchor: "none", "--head": "calc(4rem + env(safe-area-inset-top))" } as CSSProperties}
      >
        {/* Messages scroll under the glass bar (and under the composer below). */}
        <header className="glass-bar sticky top-0 z-20 shrink-0 pt-safe">
          <div className="flex h-16 items-center gap-2 px-2 md:gap-3 md:px-4">
            {back}
            {who && conv.data ? (
              <>
                <span className="relative shrink-0">
                  <Avatar name={who.name} src={who.avatar} square={who.square} />
                  {presence?.online && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-firuza ring-2 ring-surface" aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id="thread-title" className="truncate text-md font-semibold text-ink">{who.name}</h2>
                  <p className="flex min-w-0 items-center gap-1.5 text-xs text-ink-2">
                    {status && <span aria-hidden="true" className="shrink-0">{status}</span>}
                    {status && <span aria-hidden="true">·</span>}
                    <span className="truncate">{conv.data.vacancy.title}</span>
                    <span aria-live="polite" className="sr-only">{status}</span>
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm" icon={<FileText className="size-4" />} className="max-sm:hidden">
                  <LocalizedLink to={applicationHref(conv.data)} prefetch="intent">{t("chat.application")}</LocalizedLink>
                </Button>
                <IconButton asChild label={t("chatPage.openApplication")} shape="pill" className="sm:hidden">
                  <LocalizedLink to={applicationHref(conv.data)}><FileText className="size-5" /></LocalizedLink>
                </IconButton>
              </>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-3" aria-hidden="true">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="text-md"><Skeleton className="inline-block h-3.5 w-36 align-middle" /></div>
                  <div className="text-xs"><Skeleton className="inline-block h-2.5 w-48 max-w-full align-middle" /></div>
                </div>
              </div>
            )}
          </div>
        </header>

        <div ref={content} className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-end px-3 pb-3 pt-2 md:px-6">
          {msgs === null ? (
            loadError ? (
              <div className="my-auto">
                <ErrorState error={loadError} onRetry={loadInitial} />
              </div>
            ) : skeleton ? <SkeletonDelay><ThreadSkeleton /></SkeletonDelay> : null
          ) : (
            <div className="anim-fade flex flex-col">
              {olderCursor ? (
                // Always in place while older pages exist, so loading them never shifts the view.
                <div className="flex h-36 flex-col justify-end gap-2 pb-2">
                  {olderFailed ? (
                    <ErrorState compact title={t("chatPage.olderFailed")} onRetry={() => loadOlder(true)} />
                  ) : (
                    <div role="status" className="flex flex-col gap-2" aria-busy={loadingOlder || undefined}>
                      <span className="sr-only">{loadingOlder ? t("chatPage.loadingOlder") : ""}</span>
                      <Skeleton className="h-9 w-2/5 rounded-panel rounded-bl-control" />
                      <Skeleton className="ml-auto h-9 w-1/3 rounded-panel rounded-br-control" />
                      <Skeleton className="h-9 w-1/2 rounded-panel rounded-bl-control" />
                    </div>
                  )}
                </div>
              ) : who && conv.data ? (
                <Card radius="sheet" className="mx-auto mb-3 mt-4 flex w-full max-w-sm flex-col items-center text-center">
                  <Avatar name={who.name} src={who.avatar} square={who.square} size="lg" />
                  <p className="mt-3 text-lead font-semibold tracking-snug text-ink">{who.name}</p>
                  <p className="mt-1 break-words text-sm text-ink-2">{t("chatPage.about", { vacancy: conv.data.vacancy.title })}</p>
                  <Button asChild variant="secondary" size="sm" shape="pill" icon={<FileText className="size-4" />} className="mt-4">
                    <LocalizedLink to={applicationHref(conv.data)} prefetch="intent">{t("chatPage.openApplication")}</LocalizedLink>
                  </Button>
                  {msgs.length === 0 && <p className="mt-4 text-sm text-ink-2">{t("chat.startHint")}</p>}
                </Card>
              ) : null}

              {days.map((d) => (
                <section key={d.label} aria-label={d.label}>
                  {/* Solid pill: a glass one would re-blur on every scroll frame inside the thread. */}
                  <div className="pointer-events-none sticky top-(--head) z-10 flex justify-center py-2">
                    <h3 className="grid h-7 place-items-center rounded-pill border border-line bg-raised px-3 text-xs font-medium text-ink-2 shadow-1">{d.label}</h3>
                  </div>
                  <ol className="flex flex-col">
                    {d.items.map((m, i) => {
                      const prev = d.items[i - 1];
                      if (m.kind === "system") {
                        return (
                          <li key={m.client_id || m.id} className="my-2 flex justify-center">
                            <p className="max-w-md break-words rounded-control bg-sunken px-3 py-1.5 text-center text-xs text-ink-2">{m.body}</p>
                          </li>
                        );
                      }
                      const mine = m.sender?.id === me;
                      const first = !sameGroup(prev, m);
                      // Teammates on the company side see who wrote each message.
                      const showName = first && !mine && conv.data?.side === "company" && m.sender && m.sender.id !== conv.data.seeker.id;
                      return (
                        <li key={m.client_id || m.id} className={cn(first ? "mt-3 first:mt-1" : "mt-1")}>
                          {showName && <p className="mb-1 ml-3 text-xs font-medium text-ink-2">{m.sender!.full_name}</p>}
                          <MessageBubble m={m} mine={mine} first={first} seen={m.id > 0 && m.id <= otherRead}
                            onDelete={() => void remove(m)} onRetry={() => retry(m)} />
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}

              {typing && (
                <div className="mt-3 flex" aria-hidden="true">
                  <div className="flex h-9 items-center gap-1 rounded-panel rounded-bl-control border border-line bg-surface px-4 shadow-1">
                    {[0, 200, 400].map((d) => <span key={d} className="size-1.5 animate-pulse rounded-full bg-ink-3" style={{ animationDelay: `${d}ms` }} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-20 shrink-0 px-2 pb-safe pt-2 md:px-4 md:pb-4">
          <div className="relative mx-auto w-full max-w-3xl">
            {/* Glass owns its position (relative), so a plain wrapper does the placing. */}
            <div className="pointer-events-none absolute bottom-full right-1 mb-3">
              <button
                type="button"
                onClick={toLatest}
                inert={!away && !unseen}
                aria-label={unseen ? t("chatPage.newMessages", { count: unseen }) : t("chatPage.toLatest")}
                title={t("chatPage.toLatest")}
                className={cn(
                  "glass-panel pointer-events-auto flex h-11 items-center justify-center gap-1.5 rounded-pill text-ink",
                  "transition-[opacity,translate,scale] duration-200 ease-spring active:scale-95",
                  unseen ? "px-4 text-sm font-medium" : "w-11",
                  !away && !unseen && "pointer-events-none translate-y-2 scale-90 opacity-0",
                )}
              >
                <ArrowDown className="size-5 shrink-0" />
                {unseen > 0 && <span aria-hidden="true" className="num">{t("chatPage.newMessages", { count: unseen })}</span>}
              </button>
            </div>
            <Composer onSend={onSend} onTyping={() => send({ type: "typing", conversation_id: id })} />
          </div>
        </div>
      </div>

      {dragging && (
        <div className="anim-fade pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-sheet border-2 border-dashed border-lapis bg-lapis-soft">
          <p className="flex items-center gap-2 px-4 text-center text-md font-medium text-lapis-ink"><Upload className="size-5 shrink-0" />{t("chatPage.dropHere")}</p>
        </div>
      )}
      <p role="status" className="sr-only">{announce}</p>
      {dialog}
    </div>
  );
}

/** Bubbles hugging the composer, alternating sides like a real exchange. */
function ThreadSkeleton() {
  const { t } = useTranslation();
  const rows = [
    "h-14 w-3/5 rounded-bl-control", "ml-auto h-9 w-2/5 rounded-br-control", "h-9 w-1/2 rounded-bl-control",
    "ml-auto h-20 w-2/3 rounded-br-control", "h-9 w-2/5 rounded-bl-control", "ml-auto h-9 w-1/3 rounded-br-control",
  ];
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3 pb-1 pt-6">
      <span className="sr-only">{t("common.loading")}</span>
      <Skeleton className="mx-auto h-7 w-20" />
      {rows.map((c, i) => <Skeleton key={i} className={cn("rounded-panel", c)} />)}
    </div>
  );
}

/**
 * Phones: keep the composer above the on-screen keyboard. Chromium resizes the layout (and so
 * `h-app`) with interactive-widget=resizes-content, set only while a thread is open so the tab bar
 * elsewhere never rides on the keyboard. iOS ignores it: there the covered height pads the thread.
 * Resize events only (a scroll listener would reflow every frame).
 */
function useKeyboardInset(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current, vv = window.visualViewport;
    if (!el || !vv || !window.matchMedia("(pointer: coarse)").matches) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const prev = meta?.content;
    if (meta && prev && !prev.includes("interactive-widget")) meta.content = `${prev}, interactive-widget=resizes-content`;
    const sync = () => {
      const covered = vv.scale > 1.01 ? 0 : Math.round(window.innerHeight - vv.height);
      el.style.paddingBottom = covered > 80 ? `${covered}px` : "";
      if (covered > 80 && window.scrollY > 0) window.scrollTo(0, 0);
    };
    vv.addEventListener("resize", sync);
    sync();
    return () => {
      vv.removeEventListener("resize", sync);
      el.style.paddingBottom = "";
      if (meta && prev !== undefined) meta.content = prev;
    };
  }, [root]);
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
