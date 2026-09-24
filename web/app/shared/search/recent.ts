// Search helpers shared by SearchBar and the command palette: the same device-local recent
// searches follow the user between the two, and both read the same /search/suggest shape.

export type Suggest = {
  titles?: { title?: string; vacancies?: number }[];
  companies?: { id: string; name: string; slug: string; logo_url: string | null; verified: boolean }[];
  skills?: { id: number; name: string }[];
};

const RECENT_KEY = "jv_recent_searches";
const RECENT_MAX = 6;

export function readRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return []; // private mode, blocked storage, bad JSON
  }
}

export function saveRecent(q: string) {
  try {
    const list = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: recent searches are a convenience */
  }
}
