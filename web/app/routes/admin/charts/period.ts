import type { components } from "~/shared/api/schema";

/** A statistics period in days, as the API defines it (StatsDays). */
export type StatsDays = components["parameters"]["StatsDays"];

// The chips, in order. `satisfies` breaks the build if the API drops one of them, and
// MissingPeriods breaks it if the API adds one the chips don't offer.
export const STATS_PERIODS = [7, 30, 90] as const satisfies readonly StatsDays[];
type MissingPeriods = Exclude<StatsDays, (typeof STATS_PERIODS)[number]>;
const allOffered: [MissingPeriods] extends [never] ? true : false = true;
void allOffered;

/** The API's default for ?days= (StatsDays default); the URL leaves it out. */
export const DEFAULT_STATS_PERIOD: StatsDays = 30;

/** How long the server caches a statistics view; the client doesn't refetch sooner. */
export const STATS_STALE_MS = 5 * 60_000;
