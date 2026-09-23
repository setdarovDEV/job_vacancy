// The theme choice lives in a cookie so the server renders the right colors on the first
// byte — no flash. "system" sets no attribute and lets prefers-color-scheme decide.
export type Theme = "light" | "dark" | "system";

export const THEME_COOKIE = "jv_theme";

export function parseTheme(cookieHeader: string | null): Theme {
  const m = cookieHeader?.match(/(?:^|;\s*)jv_theme=(light|dark|system)/);
  return (m?.[1] as Theme) ?? "system";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
