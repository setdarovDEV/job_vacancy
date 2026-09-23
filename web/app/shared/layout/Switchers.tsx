import { Check, Globe, Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { localeNames, locales } from "../i18n/config";
import { useLocale, useRootData, useSwitchLocaleHref } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { applyTheme, type Theme } from "../theme/theme";
import { IconButton } from "../ui/Button";
import { Popover, popoverItem } from "../ui/Popover";

const themes: Theme[] = ["light", "dark", "system"];
const themeIcons: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

export function useTheme() {
  const initial = useRootData().theme;
  const [theme, setTheme] = useState<Theme>(initial);
  return [theme, (t: Theme) => { applyTheme(t); setTheme(t); }] as const;
}

export function ThemeMenu() {
  const { t } = useTranslation();
  const [theme, setTheme] = useTheme();
  const Icon = themeIcons[theme];
  return (
    <Popover
      label={t("theme.label")}
      trigger={(p) => <IconButton label={t("theme.label")} popoverTarget={p.popoverTarget}><Icon className="size-5" /></IconButton>}
    >
      <p className="px-2.5 pb-1 pt-1.5 text-xs text-ink-3">{t("theme.label")}</p>
      {/* Native radios: arrow keys move between options for free. */}
      <div role="radiogroup" aria-label={t("theme.label")}>
        {themes.map((v) => {
          const I = themeIcons[v];
          return (
            <label key={v} className={cn(popoverItem, "has-[:focus-visible]:bg-sunken")}>
              <input type="radio" name="theme" value={v} checked={theme === v} onChange={() => setTheme(v)} className="sr-only" />
              <I className="size-4 text-ink-3" />
              <span className="flex-1">{t(`theme.${v}`)}</span>
              {theme === v && <Check className="size-4 text-lapis" strokeWidth={2.5} />}
            </label>
          );
        })}
      </div>
    </Popover>
  );
}

export function LanguageMenu() {
  const { t } = useTranslation();
  const locale = useLocale();
  const href = useSwitchLocaleHref();
  return (
    <Popover
      label={t("language.label")}
      trigger={(p) => <IconButton label={t("language.label")} popoverTarget={p.popoverTarget}><Globe className="size-5" /></IconButton>}
    >
      <p className="px-2.5 pb-1 pt-1.5 text-xs text-ink-3">{t("language.label")}</p>
      <nav aria-label={t("language.label")}>
        {locales.map((l) => (
          // Real links: every language version is a crawlable URL.
          <Link key={l} to={href(l)} hrefLang={l} aria-current={l === locale ? "true" : undefined} className={cn(popoverItem, "justify-between gap-6")}>
            {localeNames[l]}
            {l === locale && <Check className="size-4 text-lapis" strokeWidth={2.5} />}
          </Link>
        ))}
      </nav>
    </Popover>
  );
}

/** Inline variant for the mobile menu: segmented rows instead of popovers. */
export function InlineSwitchers() {
  const { t } = useTranslation();
  const locale = useLocale();
  const href = useSwitchLocaleHref();
  const [theme, setTheme] = useTheme();
  const seg = "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[0.625rem] text-sm font-medium transition-colors";
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm text-ink-3">{t("language.label")}</p>
        <div className="grid grid-cols-2 gap-1 rounded-control bg-sunken p-1">
          {locales.map((l) => (
            <Link key={l} to={href(l)} hrefLang={l} className={cn(seg, l === locale ? "bg-surface text-ink shadow-sm" : "text-ink-2")}>
              {localeNames[l]}
            </Link>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm text-ink-3">{t("theme.label")}</p>
        <div className="flex gap-1 rounded-control bg-sunken p-1" role="radiogroup" aria-label={t("theme.label")}>
          {themes.map((v) => {
            const I = themeIcons[v];
            return (
              <button key={v} role="radio" aria-checked={theme === v} onClick={() => setTheme(v)} className={cn(seg, theme === v ? "bg-surface text-ink shadow-sm" : "text-ink-2")}>
                <I className="size-4" />
                {t(`theme.${v}`)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
