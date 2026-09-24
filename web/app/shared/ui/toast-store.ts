import type { ReactNode } from "react";

// A tiny toast store: callable from anywhere (mutations, event handlers), no context. It's in
// the core bundle, so it only keeps the list; countdowns and pausing live in the lazy viewport.
export type ToastTone = "success" | "error" | "info";
export type ToastAction = { label: string; onClick: () => void };
export type ToastOptions = {
  tone: ToastTone;
  title: ReactNode;
  body?: ReactNode;
  /** One follow-up action (Undo, Retry). Picking it also dismisses the toast. */
  action?: ToastAction;
};
/** `ms`: time on screen. `state` flips to "closed" for the exit animation, then the item is removed. */
export type ToastItem = ToastOptions & { id: number; ms: number; state: "open" | "closed" };

const MAX = 3; // on screen at once; the oldest leaves when a fourth arrives

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Shows a toast and returns its id (for `dismissToast`). Default time: 4.5s, errors 6s, with an
 * action 8s, so there's time to read and react; hovering or focusing the stack pauses it.
 */
export function toast(t: ToastOptions, ms = t.action ? 8000 : t.tone === "error" ? 6000 : 4500) {
  const id = ++seq;
  const open = items.filter((i) => i.state === "open");
  open.slice(0, Math.max(0, open.length - MAX + 1)).forEach((old) => close(old.id));
  items = [...items, { ...t, id, ms, state: "open" }];
  emit();
  return id;
}

function close(id: number) {
  if (!items.some((i) => i.id === id && i.state === "open")) return false;
  items = items.map((i) => (i.id === id ? { ...i, state: "closed" } : i));
  // Removed once the exit animation (160ms) has played.
  setTimeout(() => {
    items = items.filter((i) => i.id !== id);
    emit();
  }, 180);
  return true;
}

/** Starts the exit animation of a toast; it's removed right after. */
export function dismissToast(id: number) {
  if (close(id)) emit();
}

export const subscribeToasts = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const getToasts = () => items;
