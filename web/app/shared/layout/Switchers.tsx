import { Check, Languages, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Link } from "react-router";

import { localeNames, locales, type Locale } from "../i18n/config";
import { useLocale, useRootData, useSwitchLocaleHref } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { applyGlass, applyTheme, type Glass, type Theme } from "../theme/theme";
import { IconButton } from "../ui/Button";
import { Popover, popoverItem } from "../ui/Popover";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Tooltip } from "../ui/Tooltip";

const themes: Theme[] = ["light", "dark", "system"];
const themeIcons: Record<Theme, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };
const glasses: Glass[] = ["auto", "full", "lite", "off"];

// Short language codes for the compact header trigger (each language names itself).
const localeShort: Record<Locale, string> = { uz: "O'zb", "uz-Cyrl": "Ўзб", ru: "Рус", en: "Eng" };

/*
 * The chosen theme and glass tier, shared by every switcher on the page (header popover, menu
 * sheet, settings page) so they never disagree. Starts from the cookie values the root loader
 * read; the server snapshot is that same value, so hydration matches.
 */
const prefs: { theme: Theme | null; glass: Glass | null } = { theme: null, glass: null };
const prefListeners = new Set<() => void>();
const subscribePrefs = (l: () => void) => {
  prefListeners.add(l);
  return () => prefListeners.delete(l);
};
function setPref<K extends keyof typeof prefs>(k: K, v: NonNullable<(typeof prefs)[K]>) {
  prefs[k] = v;
  prefListeners.forEach((l) => l());
}

export function useTheme() {
  const initial = useRootData().theme;
  const theme = useSyncExternalStore(subscribePrefs, () => prefs.theme ?? initial, () => initial);
  return [theme, (t: Theme) => { applyTheme(t); setPref("theme", t); }] as const;
}

/** Liquid Glass tier ("Shaffoflik"): auto (device decides), full, lite or off. Stored in a cookie. */
export function useGlass() {
  const initial = useRootData().glass;
  const glass = useSyncExternalStore(subscribePrefs, () => prefs.glass ?? initial, () => initial);
  return [glass, (g: Glass) => { applyGlass(g); setPref("glass", g); }] as const;
}

// Popover rows that stay open on click: two groups live in one panel, so picking a theme
// must not close it before the glass tier can be chosen. Same look as popoverItem.
const choiceRow = cn(
  popoverItem.replace("popover-item ", ""),
  "has-[:focus-visible]:bg-sunken has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-focus",
);
const groupLabel = "px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-caps text-ink-3";

function RadioRows<T extends string>({
  name, label, value, options, onChange,
}: {
  name: string;
  label: string;
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (v: T) => void;
}) {
  const id = `${name}-label`;
  return (
    <div role="radiogroup" aria-labelledby={id}>
      <p id={id} className={groupLabel}>{label}</p>
      {/* Native radios: arrow keys move between options for free. */}
      {options.map((o) => {
        const I = o.icon;
        const on = o.value === value;
        return (
          <label key={o.value} className={choiceRow}>
            <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
            {I && <I className="size-4.5 shrink-0 text-ink-3" aria-hidden="true" />}
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            <Check
              aria-hidden="true"
              strokeWidth={2.5}
              className={cn("size-4 shrink-0 text-lapis transition-[opacity,scale] duration-200 ease-spring", on ? "opacity-100" : "scale-50 opacity-0")}
            />
          </label>
        );
      })}
    </div>
  );
}

/**
 * Appearance popover for the desktop header: colour theme and the Liquid Glass tier in one
 * panel (it stays open while you try both). The trigger shows the current theme's icon.
 */
export function ThemeMenu() {
  const { t } = useTranslation();
  const [theme, setTheme] = useTheme();
  const [glass, setGlass] = useGlass();
  const Icon = themeIcons[theme];
  const label = t("shell.appearance");
  return (
    <Popover
      label={label}
      className="w-64"
      trigger={(p) => (
        <Tooltip content={label}>
          <IconButton label={label} shape="pill" popoverTarget={p.popoverTarget}>
            <Icon className="size-5" />
          </IconButton>
        </Tooltip>
      )}
    >
      <RadioRows
        name="jv-theme"
        label={t("theme.label")}
        value={theme}
        onChange={setTheme}
        options={themes.map((v) => ({ value: v, label: t(`theme.${v}`), icon: themeIcons[v] }))}
      />
      <div className="mt-1 border-t border-line pt-1">
        <RadioRows
          name="jv-glass"
          label={t("shell.glass.label")}
          value={glass}
          onChange={setGlass}
          options={glasses.map((v) => ({ value: v, label: t(`shell.glass.${v}`) }))}
        />
        <p className="px-3 pb-2 pt-1 text-xs text-ink-3">{t("shell.glass.hint")}</p>
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
      className="w-56"
      trigger={(p) => (
        <Tooltip content={t("language.label")}>
          <button
            type="button"
            popoverTarget={p.popoverTarget}
            aria-label={t("shell.languageCurrent", { language: localeNames[locale] })}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-pill px-3 text-md font-medium text-ink-2",
              "transition-[background-color,color,scale] duration-150 ease-spring hover:bg-sunken hover:text-ink active:scale-[0.97]",
            )}
          >
            <Languages className="size-4.5" aria-hidden="true" />
            <span aria-hidden="true">{localeShort[locale]}</span>
          </button>
        </Tooltip>
      )}
    >
      <p className={groupLabel}>{t("language.label")}</p>
      <nav aria-label={t("language.label")}>
        {locales.map((l) => (
          // Real links: every language version is a crawlable URL.
          <Link
            key={l}
            to={href(l)}
            hrefLang={l}
            lang={l}
            aria-current={l === locale ? "true" : undefined}
            className={cn(popoverItem, "justify-between gap-6")}
          >
            {localeNames[l]}
            {l === locale && <Check className="size-4 text-lapis" strokeWidth={2.5} aria-hidden="true" />}
          </Link>
        ))}
      </nav>
    </Popover>
  );
}

// Segmented look built from native radios (arrow keys for free, also inside a Popover, whose
// own arrow-key handling leaves inputs alone). The ring shows on the label while its radio
// has keyboard focus.
const tileBase =
  "relative flex min-w-0 cursor-pointer select-none items-center justify-center rounded-pill font-medium " +
  "transition-[background-color,color,box-shadow,scale] duration-150 ease-spring active:scale-[0.97] " +
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus";
const tileOn = "bg-raised text-ink shadow-1 ring-1 ring-line";
const tileOff = "text-ink-2 hover:text-ink";

function ChoiceTiles<T extends string>({
  name, legend, value, options, onChange, stacked,
}: {
  name: string;
  legend: string;
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (v: T) => void;
  /** Icon above the label (roomier tiles for three options). */
  stacked?: boolean;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className={groupLabel}>{legend}</legend>
      <div
        className="grid gap-1 rounded-panel bg-sunken p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const I = o.icon;
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                tileBase,
                stacked ? "h-14 flex-col gap-1 rounded-control text-xs" : "h-9 gap-1.5 px-1.5 text-sm pointer-coarse:h-11",
                on ? tileOn : tileOff,
              )}
            >
              <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              {I && <I className="size-4.5 shrink-0" aria-hidden="true" />}
              <span className="max-w-full truncate">{o.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The header's quick settings (lg+): language, colour theme and Liquid Glass tier in one glass
 * panel, so the header keeps a single trigger. The trigger shows the current language's short
 * code. Language options are real hreflang links; theme and glass apply instantly and keep
 * the panel open.
 */
export function PreferencesMenu() {
  const { t } = useTranslation();
  const locale = useLocale();
  const href = useSwitchLocaleHref();
  const [theme, setTheme] = useTheme();
  const [glass, setGlass] = useGlass();
  const title = t("shell.preferences");
  return (
    <Popover
      label={title}
      className="w-80"
      trigger={(p) => (
        <Tooltip content={title}>
          <button
            type="button"
            popoverTarget={p.popoverTarget}
            aria-label={t("shell.preferencesCurrent", { language: localeNames[locale] })}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-pill px-3 text-md font-medium text-ink-2",
              "transition-[background-color,color,scale] duration-150 ease-spring hover:bg-sunken hover:text-ink active:scale-[0.97]",
            )}
          >
            <Languages className="size-4.5" aria-hidden="true" />
            <span aria-hidden="true">{localeShort[locale]}</span>
          </button>
        </Tooltip>
      )}
    >
      <div className="flex flex-col gap-2 p-1">
        <nav aria-labelledby="prefs-lang">
          <p id="prefs-lang" className={groupLabel}>{t("language.label")}</p>
          <div className="grid grid-cols-2 gap-1 rounded-panel bg-sunken p-1">
            {locales.map((l) => {
              const on = l === locale;
              return (
                // Real links: every language version is a crawlable URL.
                <Link
                  key={l}
                  to={href(l)}
                  hrefLang={l}
                  lang={l}
                  aria-current={on ? "true" : undefined}
                  className={cn(tileBase, "h-9 gap-1.5 px-2 text-sm pointer-coarse:h-11 focus-visible:outline-offset-1", on ? tileOn : tileOff)}
                >
                  {on && <Check className="size-3.5 shrink-0 text-lapis" strokeWidth={2.75} aria-hidden="true" />}
                  <span className="truncate">{localeNames[l]}</span>
                </Link>
              );
            })}
          </div>
        </nav>
        <ChoiceTiles
          name="jv-theme"
          legend={t("theme.label")}
          value={theme}
          onChange={setTheme}
          stacked
          options={themes.map((v) => ({ value: v, label: t(`theme.${v}`), icon: themeIcons[v] }))}
        />
        <ChoiceTiles
          name="jv-glass"
          legend={t("shell.glass.label")}
          value={glass}
          onChange={setGlass}
          options={glasses.map((v) => ({ value: v, label: t(`shell.glass.${v}`) }))}
        />
        <p className="px-3 pb-1 text-xs text-ink-3">{t("shell.glass.hint")}</p>
      </div>
    </Popover>
  );
}

/** Theme as a segmented control (mobile menu, settings page). `compact` fits three icon+label segments in 360px. */
export function ThemeControl({ className, compact }: { className?: string; compact?: boolean }) {
  const { t } = useTranslation();
  const [theme, setTheme] = useTheme();
  return (
    <SegmentedControl
      label={t("theme.label")}
      value={theme}
      onChange={setTheme}
      fullWidth
      size={compact ? "sm" : "md"}
      className={cn(compact && "[&>button]:px-2", className)}
      options={themes.map((v) => {
        const I = themeIcons[v];
        return { value: v, label: t(`theme.${v}`), icon: <I /> };
      })}
    />
  );
}

/** Glass tier as a segmented control with its explanation (mobile menu, settings page). */
export function GlassControl({ className, compact }: { className?: string; compact?: boolean }) {
  const { t } = useTranslation();
  const [glass, setGlass] = useGlass();
  return (
    <div className={className}>
      <SegmentedControl
        label={t("shell.glass.label")}
        value={glass}
        onChange={setGlass}
        fullWidth
        size={compact ? "sm" : "md"}
        className={compact ? "[&>button]:px-2" : undefined}
        options={glasses.map((v) => ({ value: v, label: t(`shell.glass.${v}`) }))}
      />
      <p className="mt-2 text-sm text-ink-2">{t("shell.glass.hint")}</p>
    </div>
  );
}

/** Language links as a 2×2 grid of pills (mobile menu). Real hreflang links. */
export function LanguageLinks({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const href = useSwitchLocaleHref();
  return (
    <nav aria-label={t("language.label")} className={cn("grid grid-cols-2 gap-1 rounded-panel bg-sunken p-1", className)}>
      {locales.map((l) => {
        const on = l === locale;
        return (
          <Link
            key={l}
            to={href(l)}
            hrefLang={l}
            lang={l}
            onClick={onNavigate}
            aria-current={on ? "true" : undefined}
            className={cn(
              "flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-pill px-3 text-md font-medium transition-[background-color,color,scale] duration-150 ease-spring active:scale-[0.97]",
              on ? "bg-raised text-ink shadow-1 ring-1 ring-line" : "text-ink-2 hover:text-ink",
            )}
          >
            {on && <Check className="size-4 shrink-0 text-lapis" strokeWidth={2.5} aria-hidden="true" />}
            <span className="truncate">{localeNames[l]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Inline variant for the mobile menu: language pills, theme and glass segmented controls. */
export function InlineSwitchers({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="menu-lang">
        <h4 id="menu-lang" className="mb-2 text-sm font-medium text-ink-2">{t("language.label")}</h4>
        <LanguageLinks onNavigate={onNavigate} />
      </section>
      <section aria-labelledby="menu-theme">
        <h4 id="menu-theme" className="mb-2 text-sm font-medium text-ink-2">{t("theme.label")}</h4>
        <ThemeControl compact />
      </section>
      <section aria-labelledby="menu-glass">
        <h4 id="menu-glass" className="mb-2 text-sm font-medium text-ink-2">{t("shell.glass.label")}</h4>
        <GlassControl compact />
      </section>
    </div>
  );
}
