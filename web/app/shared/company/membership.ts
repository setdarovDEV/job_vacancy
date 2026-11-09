import { useEffect, useSyncExternalStore } from "react";

import { api, dataOf } from "~/shared/api/client";
import { useSession, withAuth } from "~/shared/auth/session";

// Public pages render outside React Query, so the signed-in employer's company ids are a
// tiny module store (like saved vacancies): fetched once per user, read synchronously.
let companyIds = new Set<string>();
let loadedFor: string | null = null; // whose list was requested
let readyFor: string | null = null; // whose list has arrived
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load(userId: string) {
  if (loadedFor === userId) return;
  loadedFor = userId;
  const res = await withAuth(() => api.GET("/me/companies"));
  companyIds = new Set((dataOf<{ id: string }[]>(res) ?? []).map((c) => c.id));
  readyFor = userId;
  emit();
}

/** Forget the cached company list, e.g. after the employer creates a company (OO-022). */
export function invalidateMembership() {
  loadedFor = readyFor = null;
  emit();
}

/**
 * Whether the signed-in user is on this company's team (only employers can be), or
 * undefined while that isn't known yet (session or the employer's company list loading).
 */
export function useIsCompanyMember(companyId: string): boolean | undefined {
  const { status, user } = useSession();
  const employer = status === "authed" && user?.role === "employer";
  useEffect(() => {
    if (employer && user) void load(user.id);
  }, [employer, user]);
  const answer = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => (!employer ? false : readyFor === user?.id ? companyIds.has(companyId) : undefined),
    () => undefined,
  );
  return status === "loading" ? undefined : answer;
}
