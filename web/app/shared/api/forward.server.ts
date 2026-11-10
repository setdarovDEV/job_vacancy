import { AsyncLocalStorage } from "node:async_hooks";

import type { Client, Middleware } from "openapi-fetch";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const installed = new WeakSet<Client<any>>();

/**
 * Makes `client` pass the visitor's address on server-side calls and returns the runner
 * for the root middleware: the rest of the request (loaders, actions, render) runs with
 * the caller's X-Forwarded-For.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function forwardClientAddress(client: Client<any>) {
  if (!installed.has(client)) {
    client.use(forwardClient);
    installed.add(client);
  }
  return <T>(request: Request, next: () => Promise<T>): Promise<T> =>
    incoming.run({ forwardedFor: request.headers.get("X-Forwarded-For") }, next);
}
