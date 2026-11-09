import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * React Query keys for the admin area, in one place. Keys are hierarchical, so
 * invalidating `adminKeys.companies()` also refreshes every filtered company page.
 */
export const adminKeys = {
  stats: () => ["admin", "stats"] as const,
  moderation: () => ["admin", "moderation"] as const,
  vacancy: (id: string) => ["admin", "vacancy", id] as const,
  companies: (filters?: Record<string, unknown>) => (filters ? ["admin", "companies", filters] : ["admin", "companies"]) as QueryKey,
  users: (filters?: Record<string, unknown>) => (filters ? ["admin", "users", filters] : ["admin", "users"]) as QueryKey,
  reports: (filters?: Record<string, unknown>) => (filters ? ["admin", "reports", filters] : ["admin", "reports"]) as QueryKey,
};

/** Refetch the given admin data (and the overview counters, which every admin action moves). */
export function invalidateAdmin(qc: QueryClient, ...keys: QueryKey[]) {
  for (const queryKey of [...keys, adminKeys.stats()]) void qc.invalidateQueries({ queryKey });
}
