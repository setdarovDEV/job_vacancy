import type { ReactNode } from "react";

// A tiny toast store: callable from anywhere (mutations, event handlers), no context.
export type ToastItem = { id: number; tone: "success" | "error" | "info"; title: ReactNode; body?: ReactNode };

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(t: Omit<ToastItem, "id">, ms = 4500) {
  const id = ++seq;
  items = [...items.slice(-2), { ...t, id }]; // at most 3 on screen
  emit();
  setTimeout(() => dismissToast(id), ms);
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const subscribeToasts = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const getToasts = () => items;
