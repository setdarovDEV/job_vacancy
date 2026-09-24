import { useEffect, useSyncExternalStore } from "react";

import { api, dataOf } from "../api/client";
import { useSession, withAuth } from "../auth/session";

// Listings are cached for everyone, so they carry no "saved" flag. The signed-in seeker's
// saved ids are fetched once and shared by every card on the page.
let ids = new Set<string>();
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

async function load(userId: string) {
  if (loadedFor === userId) return;
  loadedFor = userId;
  // Another account's hearts must never show, not even for the length of a request.
  ids = new Set();
  emit();
  try {
    const res = await withAuth(() => api.GET("/me/saved-vacancies/ids"));
    if (!res.response.ok) throw new Error(String(res.response.status));
    ids = new Set(dataOf<string[]>(res) ?? []);
    emit();
  } catch {
    // Let the next card that mounts try again instead of staying empty for the whole visit.
    if (loadedFor === userId) loadedFor = null;
  }
}

export function useSaved(id: string) {
  const { status, user } = useSession();
  useEffect(() => {
    // Employers get no hearts (SaveButton renders nothing): no request for them either.
    if (status === "authed" && user && user.role !== "employer") void load(user.id);
  }, [status, user]);
  const saved = useSyncExternalStore(subscribe, () => ids.has(id), () => false);
  // After signing out the ids of the previous session are stale.
  return status === "authed" && saved;
}

/** Optimistic toggle; reverts if the request fails. Resolves true when the server agreed. */
export async function toggleSaved(id: string, on: boolean): Promise<boolean> {
  const next = new Set(ids);
  if (on) next.add(id); else next.delete(id);
  ids = next;
  emit();
  let ok = false;
  try {
    const res = await withAuth(() =>
      on
        ? api.PUT("/vacancies/{vacancy}/save", { params: { path: { vacancy: id } } })
        : api.DELETE("/vacancies/{vacancy}/save", { params: { path: { vacancy: id } } }),
    );
    ok = res.response.ok;
  } catch {
    ok = false; // offline
  }
  if (!ok) {
    const back = new Set(ids);
    if (on) back.delete(id); else back.add(id);
    ids = back;
    emit();
  }
  return ok;
}
