import { useRouteLoaderData } from "react-router";

import type { PublicRuntime } from "./runtime.server";

const off: PublicRuntime = { turnstileSiteKey: null, sentryDsn: null, environment: "development", release: null, ga4Id: null };

/** Runtime settings from the root loader (see runtime.server.ts). */
export function useRuntime(): PublicRuntime {
  return useRouteLoaderData<{ runtime?: PublicRuntime }>("root")?.runtime ?? off;
}
