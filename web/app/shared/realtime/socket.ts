import { api, dataOf } from "../api/client";
import { withAuth } from "../auth/session";

// One WebSocket per tab, opened after sign-in. It authenticates with a one-time ticket
// (tokens never go in URLs), reconnects with backoff, and fans events out to listeners.
export type RealtimeEvent = { type: string; data: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
type Listener = (e: RealtimeEvent) => void;

const listeners = new Set<Listener>();
const statusListeners = new Set<(online: boolean) => void>();
let ws: WebSocket | null = null;
let wanted = false;
let attempt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let heartbeat: ReturnType<typeof setInterval> | undefined;
let watched: string[] = [];

export function onRealtime(fn: Listener) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function onConnection(fn: (online: boolean) => void) {
  statusListeners.add(fn);
  fn(ws?.readyState === WebSocket.OPEN);
  return () => void statusListeners.delete(fn);
}

export function send(frame: Record<string, unknown>) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
}

/** Presence updates for these users (replaces the previous list; resent after reconnects). */
export function watchPresence(userIds: string[]) {
  watched = userIds;
  send({ type: "watch_presence", user_ids: userIds });
}

export function connect() {
  wanted = true;
  if (ws || timer) return;
  void open();
}

export function disconnect() {
  wanted = false;
  clearTimeout(timer);
  timer = undefined;
  ws?.close(1000);
  ws = null;
}

async function open() {
  timer = undefined;
  let ticket: string | undefined;
  try {
    const res = await withAuth(() => api.POST("/ws/ticket"));
    ticket = dataOf<{ ticket: string }>(res)?.ticket;
  } catch {
    /* offline */
  }
  if (!wanted) return;
  if (!ticket) return retry();
  const url = new URL(`/api/v1/ws?ticket=${encodeURIComponent(ticket)}`, location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const sock = new WebSocket(url);
  ws = sock;
  sock.onopen = () => {
    attempt = 0;
    statusListeners.forEach((l) => l(true));
    if (watched.length) send({ type: "watch_presence", user_ids: watched });
    clearInterval(heartbeat);
    heartbeat = setInterval(() => send({ type: "ping" }), 25_000);
  };
  sock.onmessage = (m) => {
    try {
      const e = JSON.parse(m.data as string) as RealtimeEvent;
      listeners.forEach((l) => l(e));
    } catch {
      /* ignore malformed frames */
    }
  };
  sock.onclose = () => {
    clearInterval(heartbeat);
    if (ws === sock) ws = null;
    statusListeners.forEach((l) => l(false));
    if (wanted) retry();
  };
}

function retry() {
  // 1s, 2s, 4s … up to 30s, with jitter so a server restart isn't hit by everyone at once.
  const delay = Math.min(30_000, 1000 * 2 ** attempt++) * (0.7 + Math.random() * 0.6);
  timer = setTimeout(() => void open(), delay);
}

if (typeof document !== "undefined") {
  // Coming back online or to the tab: reconnect right away instead of waiting out the backoff.
  const kick = () => {
    if (wanted && !ws) {
      clearTimeout(timer);
      attempt = 0;
      void open();
    }
  };
  window.addEventListener("online", kick);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && kick());
}
