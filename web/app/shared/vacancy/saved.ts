import { useEffect, useSyncExternalStore } from "react";

import { api, dataOf } from "../api/client";
import { useSession, withAuth } from "../auth/session";

// Listings are cached for everyone, so they carry no "saved" flag. The signed-in seeker's
// saved ids are fetched once and shared by every card on the page.
let ids = new Set<string>();
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load(userId: string) {
  if (loadedFor === userId) return;
  loadedFor = userId;
  const res = await withAuth(() => api.GET("/me/saved-vacancies/ids"));
  ids = new Set(dataOf<string[]>(res) ?? []);
  emit();
}

export function useSaved(id: string) {
  const { status, user } = useSession();
  useEffect(() => {
    if (status === "authed" && user) void load(user.id);
  }, [status, user]);
  const saved = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => ids.has(id),
    () => false,
  );
  return saved;
}

/** Optimistic toggle; reverts if the request fails. */
export async function toggleSaved(id: string, on: boolean): Promise<boolean> {
  const next = new Set(ids);
  if (on) next.add(id); else next.delete(id);
  ids = next;
  emit();
  const res = await withAuth(() =>
    on
      ? api.PUT("/vacancies/{vacancy}/save", { params: { path: { vacancy: id } } })
      : api.DELETE("/vacancies/{vacancy}/save", { params: { path: { vacancy: id } } }),
  );
  if (!res.response.ok) {
    const back = new Set(ids);
    if (on) back.delete(id); else back.add(id);
    ids = back;
    emit();
    return false;
  }
  return true;
}
