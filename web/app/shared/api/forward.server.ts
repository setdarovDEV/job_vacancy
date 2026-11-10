import { AsyncLocalStorage } from "node:async_hooks";

import type { Middleware } from "openapi-fetch";

import { api } from "./client";

// SSR loaders call the API from the web container, so without this the API would see the
// container's address for every visitor and all of them would share one rate limit. The
// root middleware remembers the incoming request's X-Forwarded-For (set by Caddy, which
// overwrites whatever the browser sent) and every server-side API call passes it on. The
// API only honours it because the web container is an internal hop (see ClientIP in Go).
const incoming = new AsyncLocalStorage<{ forwardedFor: string | null }>();

const forwardClient: Middleware = {
  onRequest({ request }) {
    const forwardedFor = incoming.getStore()?.forwardedFor;
    if (forwardedFor) request.headers.set("X-Forwarded-For", forwardedFor);
    return request;
  },
};
api.use(forwardClient);

/** Runs the rest of the request (loaders, actions, render) with the caller's address. */
export function withClientAddress<T>(request: Request, next: () => Promise<T>): Promise<T> {
  return incoming.run({ forwardedFor: request.headers.get("X-Forwarded-For") }, next);
}
