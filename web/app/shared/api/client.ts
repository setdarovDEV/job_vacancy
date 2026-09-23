import createClient, { type Middleware } from "openapi-fetch";

import type { components, paths } from "./schema";

export type Schemas = components["schemas"];
export type ApiError = { code: string; message: string; fields?: Record<string, string>; retry_after?: number };

// On the server, talk to the Go API directly; in the browser, go through the same origin
// (/api/v1 is proxied by Vite in development and by nginx in production).
export const API_BASE =
  typeof window === "undefined" ? (process.env.API_URL ?? "http://localhost:8090/api/v1") : "/api/v1";

export const api = createClient<paths>({ baseUrl: API_BASE, credentials: "include" });

// The access token lives only in memory (see auth/session.ts); this attaches it.
let tokenGetter: () => string | null = () => null;
export function setTokenGetter(fn: () => string | null) {
  tokenGetter = fn;
}
const auth: Middleware = {
  onRequest({ request }) {
    const token = tokenGetter();
    if (token && !request.headers.has("Authorization")) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
};
api.use(auth);

/** Error body of a failed call, or a synthetic network error. */
export function apiError(res: { error?: unknown } | undefined): ApiError | null {
  const e = (res?.error as { error?: ApiError } | undefined)?.error;
  return e ?? (res?.error ? { code: "internal_error", message: "" } : null);
}

/** Runs a request during SSR and falls back to `fallback` if the API is unreachable, so a
 *  backend hiccup degrades a page section instead of failing the whole page. */
export async function soft<T>(req: Promise<{ data?: { data?: T } }>, fallback: T): Promise<T> {
  try {
    const res = await req;
    return res.data?.data ?? fallback;
  } catch {
    return fallback;
  }
}

/** Throws a Response for route loaders: 404 → not-found page, others → error page. */
export function orThrow<T>(res: { data?: { data?: T }; error?: unknown; response: Response }): T {
  if (res.data?.data !== undefined) return res.data.data;
  throw new Response(null, { status: res.response.status === 404 ? 404 : 502 });
}

/** The envelope's `data` for endpoints whose schema doesn't describe the body. */
export function dataOf<T>(res: { data?: unknown }): T | undefined {
  return (res.data as { data?: T } | undefined)?.data;
}
