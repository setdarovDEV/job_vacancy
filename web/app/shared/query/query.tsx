import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";

import { apiError, dataOf, type ApiError } from "../api/client";
import { useSession, withAuth } from "../auth/session";

// React Query only for signed-in areas (account, employer, chat): the chunk loads with
// those routes, never on public pages.
let client: QueryClient | undefined;
export function getQueryClient() {
  return (client ??= new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: (n, e) => n < 1 && !(e instanceof ApiFailure && e.status < 500) },
    },
  }));
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const last = useRef(user?.id);
  // Another account signed in (or out): nothing cached may leak across.
  useEffect(() => {
    if (last.current && last.current !== user?.id) getQueryClient().clear();
    last.current = user?.id;
  }, [user?.id]);
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}

export class ApiFailure extends Error {
  constructor(public error: ApiError, public status: number) {
    super(error.code);
  }
}

type Res = { data?: unknown; error?: unknown; response: Response };

/** Authenticated call → the envelope's `data`; throws ApiFailure on an error status. */
export async function authed<T>(call: () => Promise<Res>): Promise<T> {
  const res = await withAuth(call);
  if (!res.response.ok) throw new ApiFailure(apiError(res) ?? { code: "internal_error", message: "" }, res.response.status);
  return dataOf<T>(res) as T;
}

export type Page<T> = { data: T[]; meta: { next_cursor?: string | null } };

/** Same as `authed` for list endpoints: keeps `meta` for cursor pagination. */
export async function authedPage<T>(call: () => Promise<Res>): Promise<Page<T>> {
  const res = await withAuth(call);
  if (!res.response.ok) throw new ApiFailure(apiError(res) ?? { code: "internal_error", message: "" }, res.response.status);
  const body = res.data as Page<T> | undefined;
  return { data: body?.data ?? [], meta: body?.meta ?? {} };
}
