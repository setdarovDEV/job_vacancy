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
  syncThemeColor();
}

// Browser chrome color (Android address bar, iOS status bar) follows the page paper color.
const PAPER = { light: "#f3f5fa", dark: "#080d1f" } as const; // jv-ui-ignore: mirrors --paper in app.css

export function themeColorFor(theme: Theme): { color: string; media?: string }[] {
  if (theme === "system") {
    return [
      { color: PAPER.light, media: "(prefers-color-scheme: light)" },
      { color: PAPER.dark, media: "(prefers-color-scheme: dark)" },
    ];
  }
  return [{ color: PAPER[theme] }];
}

function syncThemeColor() {
  const theme = (document.documentElement.getAttribute("data-theme") as Theme | null) ?? "system";
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  const wanted = themeColorFor(theme);
  metas.forEach((m, i) => {
    const w = wanted[i];
    if (!w) return m.remove();
    m.content = w.color;
    if (w.media) m.media = w.media;
    else m.removeAttribute("media");
  });
  for (let i = metas.length; i < wanted.length; i++) {
    const m = document.createElement("meta");
    m.name = "theme-color";
    m.content = wanted[i].color;
    if (wanted[i].media) m.media = wanted[i].media!;
    document.head.appendChild(m);
  }
}

/*
 * Liquid Glass performance tier. "auto" (no cookie) lets the boot script in root.tsx pick
 * full/lite/off from the device and the user's accessibility settings before first paint.
 */
export type Glass = "auto" | "full" | "lite" | "off";

export const GLASS_COOKIE = "jv_glass";

export function parseGlass(cookieHeader: string | null): Glass {
  const m = cookieHeader?.match(/(?:^|;\s*)jv_glass=(full|lite|off)/);
  return (m?.[1] as Glass) ?? "auto";
}

export function applyGlass(glass: Glass) {
  const root = document.documentElement;
  if (glass === "auto") {
    document.cookie = `${GLASS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    root.dataset.glass = detectGlass();
  } else {
    document.cookie = `${GLASS_COOKIE}=${glass}; Path=/; Max-Age=31536000; SameSite=Lax`;
    root.dataset.glass = glass;
  }
}

function detectGlass(): Exclude<Glass, "auto"> {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const off = matchMedia("(prefers-reduced-transparency: reduce)").matches || matchMedia("(prefers-contrast: more)").matches;
  const weak = (n.hardwareConcurrency || 8) <= 4 || (n.deviceMemory || 8) <= 4 || !!n.connection?.saveData;
  return off ? "off" : weak ? "lite" : "full";
}

// Runs inline in <head> before the first paint (same logic as detectGlass, kept tiny).
// Respects an explicit jv_glass cookie; otherwise off for reduced transparency / more
// contrast, lite on weak devices or Save-Data.
export const glassBootScript = `(()=>{try{var d=document.documentElement,m=matchMedia,n=navigator;var c=document.cookie.match(/(?:^|;\\s*)jv_glass=(full|lite|off)/);if(c){d.dataset.glass=c[1];return}var off=m('(prefers-reduced-transparency: reduce)').matches||m('(prefers-contrast: more)').matches;var weak=(n.hardwareConcurrency||8)<=4||(n.deviceMemory||8)<=4||(n.connection&&n.connection.saveData);d.dataset.glass=off?'off':weak?'lite':'full'}catch(e){}})()`;
