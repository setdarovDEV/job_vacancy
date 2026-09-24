import {
  Archive, ArrowDownUp, BadgeCheck, Bell, Bookmark, BriefcaseBusiness, Building2, CalendarDays, Check, Copy, Ellipsis,
  Eye, FileText, Heart, Inbox, LayoutGrid, Link2, List, Map as MapIcon, MessageSquare, Pencil, Play, Plus, RotateCcw,
  Search, Send, Share2, SlidersHorizontal, Star, Trash2, UserCheck, Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouteLoaderData, useSearchParams } from "react-router";

import { GirihPattern } from "~/shared/brand/GirihPattern";
import { Logo, LogoMark } from "~/shared/brand/Logo";
import { CodeInput } from "~/shared/forms/CodeInput";
import { FormError } from "~/shared/forms/FormError";
import { PasswordInput } from "~/shared/forms/PasswordInput";
import { TagInput } from "~/shared/forms/TagInput";
import { useUnsavedChanges } from "~/shared/forms/useUnsavedChanges";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { groupDigits, money, salary } from "~/shared/lib/format";
import { LoadMore } from "~/shared/query/LoadMore";
import { Avatar, AvatarGroup } from "~/shared/ui/Avatar";
import { BackLink } from "~/shared/ui/BackLink";
import { Badge, type BadgeTone } from "~/shared/ui/Badge";
import { Breadcrumbs } from "~/shared/ui/Breadcrumbs";
import { Button, IconButton, type ButtonSize, type ButtonVariant } from "~/shared/ui/Button";
import { Callout } from "~/shared/ui/Callout";
import { Card, CardBody, CardFooter, CardHeader, CardLink } from "~/shared/ui/Card";
import { Chip } from "~/shared/ui/Chip";
import { ConfirmDialog, useConfirm } from "~/shared/ui/ConfirmDialog";
import { DataTable, type DataTableColumn, type DataTableSort } from "~/shared/ui/DataTable";
import { DialogClose, DialogContent, DialogRoot, DialogTrigger, SheetContent } from "~/shared/ui/Dialog";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Field, Input, Textarea } from "~/shared/ui/Field";
import { FileDropzone } from "~/shared/ui/FileDropzone";
import { FilterChip } from "~/shared/ui/FilterChip";
import { Kbd } from "~/shared/ui/Kbd";
import { MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuRoot, MenuSeparator, MenuTrigger } from "~/shared/ui/Menu";
import { MoneyInput, type Currency } from "~/shared/ui/MoneyInput";
import { MonthPicker } from "~/shared/ui/MonthPicker";
import { Pagination } from "~/shared/ui/Pagination";
import { PhoneInput } from "~/shared/ui/PhoneInput";
import { Popover, popoverItem } from "~/shared/ui/Popover";
import { Progress } from "~/shared/ui/Progress";
import { RelTime } from "~/shared/ui/RelTime";
import { SalaryRange } from "~/shared/ui/SalaryRange";
import { SearchBar } from "~/shared/ui/SearchBar";
import { SegmentedControl, segmentedPanelProps } from "~/shared/ui/SegmentedControl";
import { Select } from "~/shared/ui/Select";
import { SelectableCard, SelectableCardGroup } from "~/shared/ui/SelectableCard";
import { Skeleton, SkeletonDelay, SkeletonRows, SkeletonText } from "~/shared/ui/Skeleton";
import { Spinner } from "~/shared/ui/Spinner";
import { StatCard, StatCardSkeleton } from "~/shared/ui/StatCard";
import { Stepper } from "~/shared/ui/Stepper";
import { TabPanel, Tabs } from "~/shared/ui/Tabs";
import { Timeline } from "~/shared/ui/Timeline";
import { toast } from "~/shared/ui/toast-store";
import { Checkbox, RadioGroup, Switch } from "~/shared/ui/Toggle";
import { Tooltip } from "~/shared/ui/Tooltip";

/*
 * /ui — the Samarkand Glass reference (dev only, see routes.ts). Every token and shared
 * component in all its variants and states, in the active theme and glass tier. Doc text is
 * plain Uzbek like before (this page never ships); component content goes through t() so
 * locale switching shows real strings.
 */

export function meta() {
  return [{ title: "Design system · Job Vacancy" }, { name: "robots", content: "noindex" }];
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- page navigation ------------------------------------------------------------------------

const NAV: { group: string; items: [id: string, label: string][] }[] = [
  { group: "Asoslar", items: [["colors", "Ranglar"], ["glass", "Shisha"], ["type", "Tipografiya"], ["shape", "Radius va soya"], ["motion", "Harakat"]] },
  { group: "Boshqaruv", items: [["buttons", "Tugmalar"], ["badges", "Belgi va chiplar"], ["avatars", "Avatarlar"], ["segmented", "Segment va tablar"], ["toggles", "Almashtirgichlar"], ["tooltip", "Tooltip"]] },
  { group: "Yuzalar", items: [["cards", "Kartalar"], ["stats", "Statistika"], ["callouts", "Callout"], ["states", "Bo'sh va xato"], ["skeletons", "Skeletonlar"], ["timeline", "Timeline"], ["selectable", "Tanlov kartalari"]] },
  { group: "Navigatsiya", items: [["crumbs", "Yo'l va orqaga"], ["pagination", "Sahifalash"], ["progress", "Progress va bosqichlar"], ["table", "Jadval"], ["loadmore", "Yana yuklash"]] },
  { group: "Qatlamlar", items: [["dialogs", "Dialog va sheet"], ["popovers", "Popover va menyu"], ["pickers", "Select va oy"], ["toasts", "Toast"]] },
  { group: "Formalar", items: [["fields", "Maydonlar"], ["money", "Pul va telefon"], ["files", "Fayllar"], ["search", "Qidiruv"], ["auth", "Parol, kod, teglar"]] },
];
const NAV_ITEMS = NAV.flatMap((g) => g.items);
const SECTION_IDS = NAV_ITEMS.map(([id]) => id);

/** The section crossing the upper third of the viewport is the "current" one in the nav. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const visible = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        const first = ids.find((id) => visible.get(id));
        if (first) setActive(first);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [ids]);
  return active;
}

/** Scroll a nav box (its own offsetParent) so the active link stays visible. */
function keepInView(box: HTMLElement | null, item: HTMLElement | null, axis: "x" | "y") {
  if (!box || !item) return;
  const behavior = reducedMotion() ? "auto" : "smooth";
  if (axis === "x") {
    if (box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({ left: item.offsetLeft - (box.clientWidth - item.offsetWidth) / 2, behavior });
    return;
  }
  const top = item.offsetTop;
  if (top >= box.scrollTop && top + item.offsetHeight <= box.scrollTop + box.clientHeight) return;
  box.scrollTo({ top: top - box.clientHeight / 3, behavior });
}

function MobileNav({ active }: { active: string }) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => keepInView(strip.current, strip.current?.querySelector<HTMLElement>(`[data-id="${active}"]`) ?? null, "x"), [active]);
  return (
    <nav aria-label="Bo'limlar" className="glass-bar sticky top-(--header-h) z-30 -mx-4 mt-6 md:-mx-6 lg:hidden">
      <div ref={strip} className="relative flex gap-1 overflow-x-auto px-4 py-1.5 scrollbar-none md:px-6">
        {NAV_ITEMS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            data-id={id}
            aria-current={active === id ? "location" : undefined}
            className={cn(
              // 36px pill, 44px hit area (the ::after reaches into the bar's padding).
              "relative flex h-9 shrink-0 items-center whitespace-nowrap rounded-pill px-3.5 text-sm font-medium transition-colors duration-150",
              "after:absolute after:inset-x-0 after:-inset-y-1",
              active === id ? "bg-lapis-soft text-lapis-ink" : "text-ink-2 hover:bg-sunken hover:text-ink",
            )}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function DesktopNav({ active }: { active: string }) {
  const box = useRef<HTMLElement>(null);
  useEffect(() => keepInView(box.current?.parentElement ?? null, box.current?.querySelector<HTMLElement>(`[data-id="${active}"]`) ?? null, "y"), [active]);
  return (
    <nav ref={box} aria-label="Bo'limlar" className="space-y-5">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="px-3 text-2xs font-semibold uppercase tracking-caps text-ink-3">{g.group}</p>
          <ul className="mt-1.5 space-y-0.5">
            {g.items.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  data-id={id}
                  aria-current={active === id ? "location" : undefined}
                  className={cn(
                    "flex min-h-8 items-center rounded-control px-3 text-md transition-colors duration-150",
                    active === id ? "bg-lapis-soft font-medium text-lapis-ink" : "text-ink-2 hover:bg-sunken hover:text-ink",
                  )}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// ---- theme / glass preview ------------------------------------------------------------------

type ThemeChoice = "light" | "dark" | "system";
type GlassTier = "full" | "lite" | "off";
type Appearance = { theme: ThemeChoice; glass: GlassTier; setTheme: (v: ThemeChoice) => void; setGlass: (v: GlassTier) => void };

/**
 * Preview-only theme and glass tier: we flip the <html> attributes directly (no cookie) and
 * put back what the user had when leaving /ui, so comparing here never changes their setting.
 */
function useAppearancePreview(): Appearance {
  const root = useRouteLoaderData("root") as { theme?: ThemeChoice; glass?: "auto" | GlassTier } | undefined;
  const [theme, setThemeState] = useState<ThemeChoice>(root?.theme ?? "system");
  const [glass, setGlassState] = useState<GlassTier>(root?.glass && root.glass !== "auto" ? root.glass : "full");

  useEffect(() => {
    const el = document.documentElement;
    const initial = { theme: el.getAttribute("data-theme"), glass: el.dataset.glass };
    // The boot script may have lowered the tier before paint: show what is really applied.
    if (initial.glass === "full" || initial.glass === "lite" || initial.glass === "off") setGlassState(initial.glass);
    return () => {
      if (initial.theme) el.setAttribute("data-theme", initial.theme);
      else el.removeAttribute("data-theme");
      if (initial.glass) el.dataset.glass = initial.glass;
    };
  }, []);

  return {
    theme,
    glass,
    setTheme: (v) => {
      setThemeState(v);
      if (v === "system") document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", v);
    },
    setGlass: (v) => {
      setGlassState(v);
      document.documentElement.dataset.glass = v;
    },
  };
}

function PreviewControls({ a, className }: { a: Appearance; className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-1", className)}>
      <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-caps text-ink-2">{t("theme.label")}</p>
        <SegmentedControl
          label={t("theme.label")}
          value={a.theme}
          onChange={a.setTheme}
          size="sm"
          fullWidth
          options={[
            { value: "light", label: t("theme.light") },
            { value: "dark", label: t("theme.dark") },
            { value: "system", label: t("theme.system") },
          ]}
        />
      </div>
      <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-caps text-ink-2">Shisha darajasi</p>
        <SegmentedControl
          label="Shisha darajasi"
          value={a.glass}
          onChange={a.setGlass}
          size="sm"
          fullWidth
          options={[
            { value: "full", label: "To'liq" },
            { value: "lite", label: "Yengil" },
            { value: "off", label: "O'chiq" },
          ]}
        />
      </div>
      <p className="text-sm text-ink-2 sm:col-span-2 lg:col-span-1">Faqat shu sahifada ko'rinadi va saqlanmaydi.</p>
    </div>
  );
}

// ---- layout helpers -----------------------------------------------------------------------

function Block({ id, title, api, lead, children }: { id: string; title: string; api?: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-4 border-t border-line py-10 first:border-t-0 md:py-14 lg:scroll-mt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-title`} className="font-display text-xl font-semibold tracking-heading text-ink md:text-2xl">{title}</h2>
        {api && <code className="min-w-0 break-words text-xs text-ink-3">{api}</code>}
      </div>
      {lead && <p className="mt-2 max-w-2xl text-md text-ink-2">{lead}</p>}
      <div className="mt-6 space-y-10">{children}</div>
    </section>
  );
}

function Demo({ title, note, className, children }: { title: string; note?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <h3 className="text-xs font-semibold uppercase tracking-caps text-ink-3">{title}</h3>
      {note && <p className="mt-1 max-w-2xl text-sm text-ink-2">{note}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Colored light for glass samples: glass only reads as glass over the aurora. */
function AuroraStage({ children, className, shapes }: { children: ReactNode; className?: string; shapes?: boolean }) {
  return (
    <div className={cn("relative isolate overflow-hidden rounded-sheet border border-line p-4 md:p-8", className)}>
      <div aria-hidden="true" className="aurora-hero absolute inset-0 -z-10" />
      <GirihPattern className="-z-10" reveal={false} focus="ellipse 60% 80% at 80% 30%" />
      {shapes && (
        // Solid shapes behind the tiles make the blur (and each tier's difference) visible.
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute -left-8 top-16 size-40 rounded-full bg-lapis/70" />
          <div className="absolute left-1/2 top-1/2 size-32 rounded-full bg-firuza/70" />
          <div className="absolute -right-6 top-4 size-36 rounded-full bg-zafaron/80" />
          <p className="absolute inset-x-0 top-1/3 whitespace-nowrap text-center font-display text-5xl font-semibold tracking-display text-lapis/40">
            Samarqand · Registon
          </p>
        </div>
      )}
      {children}
    </div>
  );
}

/** Stable "now" (floored to the hour) so server and client render the same timestamps. */
function useIsoAgo() {
  const [base] = useState(() => Math.floor(Date.now() / 3_600_000) * 3_600_000);
  return useCallback((hours: number) => new Date(base - hours * 3_600_000).toISOString(), [base]);
}

// ---- foundations ------------------------------------------------------------------------------

type Swatch = { name: string; use: string; on?: string; alpha?: boolean };

const COLORS: { group: string; tokens: Swatch[] }[] = [
  {
    group: "Neytral",
    tokens: [
      { name: "paper", use: "Sahifa foni" },
      { name: "surface", use: "Karta, maydon" },
      { name: "raised", use: "Surface'dan bir pog'ona yuqori" },
      { name: "sunken", use: "Trek, hover, botiq joy" },
      { name: "ink", use: "Asosiy matn", on: "surface" },
      { name: "ink-2", use: "Ikkilamchi matn", on: "surface" },
      { name: "ink-3", use: "Meta, faqat qattiq yuzada", on: "surface" },
      { name: "line", use: "Ajratgich, karta cheti" },
      { name: "line-strong", use: "Maydon cheti (≥ 3:1)" },
    ],
  },
  {
    group: "Lojuvard — brend",
    tokens: [
      { name: "lapis", use: "Asosiy tugma, havola" },
      { name: "lapis-hover", use: "Asosiy tugma hover" },
      { name: "lapis-soft", use: "Faol element foni" },
      { name: "lapis-ink", use: "lapis-soft ustidagi matn", on: "lapis-soft" },
      { name: "on-lapis", use: "lapis ustidagi matn", on: "lapis" },
    ],
  },
  {
    group: "Firuza — maosh, tasdiq",
    tokens: [
      { name: "firuza", use: "Ijobiy signal" },
      { name: "firuza-soft", use: "Ijobiy fon" },
      { name: "firuza-ink", use: "Maosh, muvaffaqiyat matni", on: "firuza-soft" },
    ],
  },
  {
    group: "Za'faron — TOP, tez kunda",
    tokens: [
      { name: "zafaron", use: "TOP chizig'i, yulduz" },
      { name: "zafaron-soft", use: "Ogohlantirish foni" },
      { name: "zafaron-ink", use: "zafaron-soft ustidagi matn", on: "zafaron-soft" },
    ],
  },
  {
    group: "Anor — faqat xatolar",
    tokens: [
      { name: "anor", use: "Xavfli tugma, xato cheti" },
      { name: "anor-hover", use: "Xavfli tugma hover" },
      { name: "anor-soft", use: "Xato foni" },
      { name: "anor-ink", use: "Xato matni", on: "anor-soft" },
      { name: "on-anor", use: "anor ustidagi matn", on: "anor" },
    ],
  },
  {
    group: "Xizmat",
    tokens: [
      { name: "focus", use: "Fokus halqasi" },
      { name: "overlay", use: "Dialog orqa pardasi", alpha: true },
      { name: "scrim", use: "Rasm ustidagi parda", alpha: true },
      { name: "on-scrim", use: "Parda ustidagi matn", on: "scrim", alpha: true },
      { name: "skeleton", use: "Skeleton asosi" },
      { name: "skeleton-hi", use: "Skeleton yaltirog'i" },
      { name: "pattern", use: "Girih naqshi", alpha: true },
    ],
  },
  {
    group: "Shisha va aurora",
    tokens: [
      { name: "glass-chrome", use: "Header, tab bar", alpha: true },
      { name: "glass-panel", use: "Hero qidiruv, plitalar", alpha: true },
      { name: "glass-sheet", use: "Dialog, popover, toast", alpha: true },
      { name: "glass-tint-hover", use: "Shisha hover", alpha: true },
      { name: "glass-edge-hi", use: "Linza cheti (yorug')", alpha: true },
      { name: "glass-edge-lo", use: "Linza cheti (xira)", alpha: true },
      { name: "glass-edge-shade", use: "Pastki soya chizig'i", alpha: true },
      { name: "glass-sheen", use: "Yuqori yaltiroq", alpha: true },
      { name: "glass-inner", use: "Ichki yorug' chiziq", alpha: true },
      { name: "aurora-1", use: "Sahifa aurorasi", alpha: true },
      { name: "aurora-2", use: "Sahifa aurorasi", alpha: true },
      { name: "aurora-3", use: "Sahifa aurorasi", alpha: true },
      { name: "aurora-hero-1", use: "Hero aurorasi", alpha: true },
      { name: "aurora-hero-2", use: "Hero aurorasi", alpha: true },
      { name: "aurora-hero-3", use: "Hero aurorasi", alpha: true },
    ],
  },
];
const TOKEN_NAMES = COLORS.flatMap((g) => g.tokens.map((s) => s.name));

// A checkerboard under translucent tokens shows how much shows through.
const CHECKER = "repeating-conic-gradient(var(--line-strong) 0 25%, var(--surface) 0 50%) 0 0 / 14px 14px";

function swatchStyle(s: Swatch): CSSProperties {
  const fill = s.on ?? s.name;
  const bg = s.alpha ? `linear-gradient(var(--${fill}), var(--${fill})), ${CHECKER}` : `var(--${fill})`;
  return s.on ? { background: bg, color: `var(--${s.name})` } : { background: bg };
}

function ColorsSection({ glass }: { glass: GlassTier }) {
  // Raw values after mount: a custom property reads back as written, e.g. "light-dark(#…, #…)".
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    setValues(Object.fromEntries(TOKEN_NAMES.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])));
  }, [glass]);

  return (
    <Block id="colors" title="Ranglar" api="var(--token) · bg-* text-* border-*" lead="Har bir rang bitta light-dark() token: mavzu color-scheme orqali almashadi. Matn tokenlari o'z juft fonida «Aa» bilan ko'rsatilgan.">
      {COLORS.map((g) => (
        <Demo key={g.group} title={g.group}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 xl:grid-cols-5">
            {g.tokens.map((s) => (
              <figure key={s.name} className="min-w-0">
                <div className="grid h-16 place-items-center rounded-control border border-line shadow-1" style={swatchStyle(s)}>
                  {s.on && <span aria-hidden="true" className="font-display text-xl font-semibold">Aa</span>}
                </div>
                <figcaption className="mt-2">
                  <p className="truncate text-sm font-medium text-ink">--{s.name}</p>
                  <p className="text-xs text-ink-2">{s.use}</p>
                  {values[s.name] && <p className="mt-0.5 break-all font-mono text-2xs text-ink-3">{values[s.name]}</p>}
                </figcaption>
              </figure>
            ))}
          </div>
        </Demo>
      ))}
    </Block>
  );
}

const TIERS = [
  { cls: "glass-chrome", use: "Tab bar, pastki sticky panel, chat dok", levels: "chrome" },
  { cls: "glass-panel", use: "Hero qidiruv, stat plitalar, mashhur so'rovlar", levels: "panel" },
  { cls: "glass-sheet", use: "Dialog, sheet, popover, menyu, toast, tooltip", levels: "sheet" },
] as const;

function GlassSection() {
  return (
    <Block id="glass" title="Shisha (Liquid Glass)" api="glass-bar · glass-chrome · glass-panel · glass-sheet · glass-interactive" lead="Shisha faqat suzuvchi va chrome qatlamlar uchun. Kontent qattiq surface-card'da. Darajalarni yuqoridagi almashtirgich bilan solishtiring: to'liq, yengil, o'chiq.">
      <AuroraStage shapes className="p-0 md:p-0">
        <div className="glass-bar flex h-14 items-center justify-between gap-3 px-4 md:px-6">
          <span className="flex min-w-0 items-center gap-2 font-semibold text-ink"><LogoMark className="size-6 shrink-0" />glass-bar</span>
          <span className="truncate text-sm text-ink-2">Header, sticky filtr paneli</span>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-3 md:p-8">
          {TIERS.map((tier) => (
            <div key={tier.cls} className={cn(tier.cls, "rounded-panel p-5")}>
              <p className="font-semibold text-ink">{tier.cls}</p>
              <p className="mt-1 text-sm text-ink-2">{tier.use}</p>
              <ul className="mt-4 space-y-1">
                <li className="text-md text-ink">ink — asosiy matn</li>
                <li className="text-md text-ink-2">ink-2 — ikkilamchi</li>
                {tier.levels === "chrome" && <li className="text-sm text-ink-2">ink-3 bu yerda taqiqlangan</li>}
                {tier.levels === "panel" && <li className="text-sm text-ink-3">ink-3 — faqat ≥ 14px</li>}
                {tier.levels === "sheet" && (
                  <>
                    <li className="text-sm text-ink-3">ink-3 — 14px</li>
                    <li className="text-xs text-ink-3">ink-3 — kichik matn ham mumkin</li>
                  </>
                )}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 pb-4 md:px-8 md:pb-8">
          <span className="text-sm text-ink-2">glass-interactive:</span>
          {["Buxgalter", "Haydovchi", "Frontend dasturchi"].map((p) => (
            <button key={p} type="button" className="glass-panel glass-interactive h-11 rounded-pill px-4 text-md text-ink">
              {p}
            </button>
          ))}
        </div>
      </AuroraStage>
    </Block>
  );
}

const SCALE = [
  { name: "2xs", cls: "text-2xs", px: "11" },
  { name: "xs", cls: "text-xs", px: "12.8" },
  { name: "sm", cls: "text-sm", px: "14" },
  { name: "md", cls: "text-md", px: "15" },
  { name: "base", cls: "text-base", px: "16" },
  { name: "lead", cls: "text-lead", px: "17" },
  { name: "lg", cls: "font-display font-semibold tracking-heading text-lg", px: "20" },
  { name: "xl", cls: "font-display font-semibold tracking-heading text-xl", px: "25" },
  { name: "2xl", cls: "font-display font-semibold tracking-heading text-2xl", px: "31" },
  { name: "3xl", cls: "font-display font-semibold tracking-display text-3xl", px: "39" },
  { name: "4xl", cls: "font-display font-semibold tracking-display text-4xl", px: "49" },
  { name: "5xl", cls: "font-display font-semibold tracking-display text-5xl", px: "61" },
] as const;

const RECIPES = [
  { name: "H1 hero", cls: "font-display text-3xl font-semibold tracking-display sm:text-4xl md:text-5xl", sample: "Eng yaxshi ish shu yerda" },
  { name: "H1 sahifa", cls: "font-display text-2xl font-semibold tracking-heading md:text-3xl", sample: "Arizalarim" },
  { name: "H2 bo'lim", cls: "font-display text-xl font-semibold tracking-heading md:text-2xl", sample: "Yangi vakansiyalar" },
  { name: "H3 karta", cls: "text-lead font-semibold tracking-snug", sample: "Senior Frontend dasturchi (React)" },
  { name: "Lead", cls: "text-lead text-ink-2", sample: "Kassirdan dasturchigacha — 40 000+ vakansiya va bir bosishda ariza." },
  { name: "Matn (ilova)", cls: "text-md text-ink", sample: "Ish beruvchi arizangizni ko'rdi va suhbatga taklif qildi." },
  { name: "Matn (o'qish)", cls: "text-base text-ink-2", sample: "Uzun tavsiflar uchun: qator 65–75 belgidan oshmaydi, shunda o'qish charchatmaydi." },
  { name: "Meta", cls: "text-sm text-ink-2", sample: "Toshkent · Gibrid · 2 soat oldin" },
  { name: "Caps yorliq", cls: "text-xs font-semibold uppercase tracking-caps text-ink-3", sample: "Filtrlar" },
  { name: "Maosh", cls: "num font-display text-lg font-semibold tracking-heading text-firuza-ink", sample: "25–35 mln so'm" },
] as const;

function TypeSection() {
  return (
    <Block id="type" title="Tipografiya" api="text-2xs … text-5xl · tracking-display|heading|snug|caps · num" lead="Sarlavhalar Unbounded, matn Onest. O'lchamlar faqat shkaladan; raqam, pul va sanoqlar num (tabular) bilan.">
      <Demo title="Shkala">
        <div className="divide-y divide-line border-y border-line">
          {SCALE.map((s) => (
            <div key={s.name} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-4 py-3">
              <p className="text-sm font-medium text-ink">
                {s.name}
                <span className="block text-xs font-normal text-ink-3">{s.px}px</span>
              </p>
              <p className={cn("min-w-0 break-words text-ink", s.cls)}>
                {s.name === "2xs" || s.name === "xs" || s.name === "sm" || s.name === "md" || s.name === "base" || s.name === "lead"
                  ? "Kassirdan dasturchigacha — 1 250 000 so'm · Иш бор"
                  : "Ish · Иш · Работа"}
              </p>
            </div>
          ))}
        </div>
      </Demo>
      <Demo title="Retseptlar" note="pages.md dagi sahifa grammatikasi: bir xil vazifa — bir xil klasslar.">
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          {RECIPES.map((r) => (
            <div key={r.name} className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-caps text-ink-3">{r.name}</p>
              <p className={cn("mt-1 break-words", r.cls)}>{r.sample}</p>
              <code className="mt-1 block break-words text-xs text-ink-3">{r.cls}</code>
            </div>
          ))}
        </div>
      </Demo>
      <Demo title="Shriftlar va yozuvlar">
        <div className="grid gap-4 md:grid-cols-2">
          <Card padding="md">
            <p className="text-xs font-semibold uppercase tracking-caps text-ink-3">Unbounded · font-display</p>
            <p className="mt-2 font-display text-2xl font-semibold tracking-heading">Ўқитувчи, ҳамшира, ғаллакор</p>
            <p className="mt-1 font-display text-xl font-semibold tracking-heading">Oʻqituvchi va gʻaznachi</p>
          </Card>
          <Card padding="md">
            <p className="text-xs font-semibold uppercase tracking-caps text-ink-3">Onest · font-sans · num</p>
            <p className="mt-2 text-base text-ink-2">Lotin va kirill bir xil ohangda: «Qo'shimcha xat», «Қўшимча хат», «Сопроводительное письмо».</p>
            <p className="num mt-2 text-lead font-semibold text-ink">1 250 000 · 40 218 · 3 940 · 312</p>
          </Card>
        </div>
      </Demo>
    </Block>
  );
}

const RADII = [
  { cls: "rounded-control", note: "0.875rem · tugma, maydon" },
  { cls: "rounded-panel", note: "1.375rem · karta, panel" },
  { cls: "rounded-sheet", note: "1.75rem · dialog, sheet" },
  { cls: "rounded-pill", note: "pill · chip, badge" },
  { cls: "rounded-check", note: "0.375rem · checkbox" },
  { cls: "rounded-full", note: "doira · avatar" },
] as const;
const SHADOWS = [
  { cls: "shadow-1", note: "karta" },
  { cls: "shadow-2", note: "tugma, panel" },
  { cls: "shadow-3", note: "hover ko'tarilish" },
  { cls: "shadow-4", note: "sheet, dialog" },
  { cls: "shadow-pop", note: "popover" },
  { cls: "shadow-ring", note: "fokus halqasi" },
  { cls: "shadow-ring-danger", note: "xato fokus" },
] as const;

function ShapeSection() {
  return (
    <Block id="shape" title="Radius va soya" api="rounded-control|panel|sheet|pill · shadow-1..4|pop|ring">
      <Demo title="Radiuslar">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {RADII.map((r) => (
            <figure key={r.cls} className="min-w-0">
              <div className={cn("h-20 border border-lapis/30 bg-lapis-soft", r.cls)} />
              <figcaption className="mt-2 text-sm font-medium text-ink">{r.cls}<span className="block text-xs font-normal text-ink-2">{r.note}</span></figcaption>
            </figure>
          ))}
        </div>
      </Demo>
      <Demo title="Soyalar" note="Soyalar siyoh rangiga bo'yalgan; qorong'i rejimda chuqurroq.">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 xl:grid-cols-7">
          {SHADOWS.map((s) => (
            <figure key={s.cls} className="min-w-0">
              <div className={cn("h-20 rounded-panel bg-surface", s.cls)} />
              <figcaption className="mt-3 text-sm font-medium text-ink">{s.cls}<span className="block text-xs font-normal text-ink-2">{s.note}</span></figcaption>
            </figure>
          ))}
        </div>
      </Demo>
    </Block>
  );
}

const EASINGS = [
  { name: "ease-spring · dur-3 (320ms)", cls: "ease-spring duration-(--dur-3)" },
  { name: "ease-out-quint · dur-3", cls: "ease-out-quint duration-(--dur-3)" },
  { name: "ease-spring · dur-4 (520ms)", cls: "ease-spring duration-(--dur-4)" },
] as const;

function MotionSection() {
  const { t } = useTranslation();
  const [moved, setMoved] = useState(false);
  const [enterKey, setEnterKey] = useState(0);
  const [saved, setSaved] = useState(false);
  const [drawKey, setDrawKey] = useState(0);
  return (
    <Block id="motion" title="Harakat" api="ease-spring · ease-out-quint · --dur-1..4 · anim-*" lead="Faqat transform va opacity animatsiya qilinadi. prefers-reduced-motion yoqilgan bo'lsa, hammasi bir zumda.">
      <Demo title="Egri chiziqlar" note="dur-1 120ms bosish · dur-2 200ms hover · dur-3 320ms dialog · dur-4 520ms hero.">
        <Button variant="secondary" size="sm" icon={<Play className="size-4" />} onClick={() => setMoved((m) => !m)} aria-pressed={moved}>
          Ijro etish
        </Button>
        <div className="mt-4 space-y-3">
          {EASINGS.map((e) => (
            <div key={e.name}>
              <p className="text-sm text-ink-2">{e.name}</p>
              <div className="relative mt-1 h-10 rounded-pill bg-sunken">
                {/* Full-width mover: translateX(100%) is the track width, so no layout is animated. */}
                <div className={cn("absolute inset-0 transition-transform", e.cls)} style={{ transform: moved ? "translateX(calc(100% - 2.5rem))" : "none" }}>
                  <span className="block size-10 rounded-full bg-lapis shadow-2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Demo>
      <div className="grid gap-8 md:grid-cols-3">
        <Demo title="anim-enter (--i)" note="Ro'yxatning birinchi chizilishi, 8 tagacha zinapoya.">
          <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => setEnterKey((k) => k + 1)}>Qayta</Button>
          <ul key={enterKey} className="mt-3 space-y-2">
            {["Kassir", "Haydovchi", "Buxgalter", "Oshpaz"].map((x, i) => (
              <li key={x} className="anim-enter surface-card px-4 py-2.5 text-md" style={{ "--i": i } as CSSProperties}>{x}</li>
            ))}
          </ul>
        </Demo>
        <Demo title="anim-heart" note="Saqlash: 1 → 1.25 → 1, prujina.">
          <IconButton label={t("jobs.save")} aria-pressed={saved} variant="secondary" shape="pill" size="lg" onClick={() => setSaved((s) => !s)}>
            <Heart key={String(saved)} className={cn("size-6", saved && "anim-heart fill-anor text-anor")} />
          </IconButton>
        </Demo>
        <Demo title="anim-draw" note="Ariza yuborildi: belgi o'zini chizadi.">
          <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => setDrawKey((k) => k + 1)}>Qayta</Button>
          <svg key={drawKey} viewBox="0 0 48 48" className="mt-3 size-16 text-firuza" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="24" cy="24" r="21" pathLength={48} className="anim-draw" />
            <path d="M15 25l6 6 12-13" pathLength={48} className="anim-draw" style={{ animationDelay: "320ms" }} />
          </svg>
        </Demo>
      </div>
    </Block>
  );
}

// ---- actions --------------------------------------------------------------------------------

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "soft", "ghost", "danger"];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];

function ButtonsSection() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const text: Record<string, { label: string; icon?: ReactNode }> = {
    primary: { label: t("search.submit"), icon: <Search className="size-4" /> },
    secondary: { label: t("common.cancel") },
    soft: { label: t("nav.postVacancy"), icon: <Plus className="size-4" /> },
    ghost: { label: t("common.showAll") },
    danger: { label: t("common.delete"), icon: <Trash2 className="size-4" /> },
  };
  return (
    <Block id="buttons" title="Tugmalar" api="Button · IconButton" lead="Hover faqat sichqonchada; bosilganda scale 0.98; sensorli ekranda sm ham 44px bosish maydoniga ega. Fokusni Tab bilan tekshiring.">
      <Demo title="Variant × o'lcham">
        <div className="space-y-4">
          {VARIANTS.map((v) => (
            <div key={v} className="flex flex-wrap items-center gap-3">
              <span className="w-20 shrink-0 text-xs font-medium text-ink-3">{v}</span>
              {SIZES.map((s) => (
                <Button key={s} type="button" variant={v} size={s} icon={text[v].icon}>{text[v].label}</Button>
              ))}
            </div>
          ))}
        </div>
      </Demo>
      <Demo title="Holatlar" note="Yuklanishda kenglik o'zgarmaydi: ikonka o'rnini spinner oladi, ikonkasiz matn shaffof bo'lib qoladi.">
        <div className="flex"><Switch checked={loading} onCheckedChange={setLoading} label="Yuklanish holatini ko'rsatish" /></div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" loading={loading} icon={<Send className="size-4" />}>{t("apply.submit")}</Button>
          <Button type="button" loading={loading}>{t("common.save")}</Button>
          <Button type="button" loading={loading} variant="secondary">{t("common.retry")}</Button>
          <Button type="button" disabled>{t("common.save")}</Button>
          <Button type="button" variant="secondary" disabled>{t("common.cancel")}</Button>
          <Button type="button" className="outline-2 outline-offset-2 outline-focus">Fokus (namuna)</Button>
          <Button type="button" shape="pill">{t("nav.postVacancy")}</Button>
          <Button asChild variant="secondary" shape="pill"><LocalizedLink to="/vacancies">asChild · havola</LocalizedLink></Button>
        </div>
      </Demo>
      <Demo title="Shisha tugmalar" note="variant=glass faqat aurora, hero yoki rasm ustida.">
        <AuroraStage>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="glass" shape="pill" icon={<SlidersHorizontal className="size-4" />}>{t("common.filters")}</Button>
            <Button type="button" variant="glass" size="lg" shape="pill">{t("common.showAll")}</Button>
            <Button type="button" variant="glass" size="sm">sm</Button>
            <IconButton label={t("jobs.share")} variant="glass" shape="pill"><Share2 className="size-5" /></IconButton>
            <Button type="button" shape="pill" size="lg" icon={<Search className="size-4" />}>{t("search.submit")}</Button>
          </div>
        </AuroraStage>
      </Demo>
      <Demo title="IconButton" note="label majburiy: aria-label va title bo'ladi. Tooltip ichida title olib tashlanadi.">
        <div className="space-y-3">
          {(["ghost", "secondary", "soft", "primary", "danger"] as const).map((v) => (
            <div key={v} className="flex flex-wrap items-center gap-3">
              <span className="w-20 shrink-0 text-xs font-medium text-ink-3">{v}</span>
              {SIZES.map((s) => (
                <IconButton key={s} label={`${t("common.edit")} (${s})`} variant={v} size={s}><Pencil className="size-4.5" /></IconButton>
              ))}
              <IconButton label={t("jobs.save")} variant={v} shape="pill"><Heart className="size-5" /></IconButton>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-20 shrink-0 text-xs font-medium text-ink-3">holatlar</span>
            <IconButton label={t("common.loading")} variant="secondary" loading><Bell className="size-5" /></IconButton>
            <IconButton label={t("common.delete")} variant="secondary" disabled><Trash2 className="size-5" /></IconButton>
            <Tooltip content={t("jobs.share")}>
              <IconButton label={t("jobs.share")} variant="secondary" shape="pill"><Share2 className="size-5" /></IconButton>
            </Tooltip>
          </div>
        </div>
      </Demo>
    </Block>
  );
}

function FilterChipsDemo() {
  const { t } = useTranslation();
  const initial = ["Toshkent", t("enums.work_format.office"), t("enums.employment_type.full_time"), "5 000 000 so'mdan"];
  const [items, setItems] = useState(initial);
  const list = useRef<HTMLUListElement>(null);
  const fallback = useRef<HTMLButtonElement>(null);
  const focusAt = useRef<number | null>(null);

  // After a removal keep keyboard users in place: the next chip, else "clear all" / reset.
  useEffect(() => {
    const i = focusAt.current;
    if (i == null) return;
    focusAt.current = null;
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button");
    const next = buttons && buttons.length ? buttons[Math.min(i, buttons.length - 1)] : null;
    (next ?? fallback.current)?.focus();
  }, [items]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.length > 0 ? (
        <>
          <ul ref={list} className="flex min-w-0 flex-wrap gap-2">
            {items.map((name, i) => (
              <li key={name} className="min-w-0 max-w-full">
                <FilterChip
                  removeLabel={t("controls.removeFilter", { name })}
                  onRemove={() => {
                    focusAt.current = i;
                    setItems((xs) => xs.filter((x) => x !== name));
                  }}
                >
                  {name}
                </FilterChip>
              </li>
            ))}
          </ul>
          <Button
            ref={fallback}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              focusAt.current = 0;
              setItems([]);
            }}
          >
            {t("common.clear")}
          </Button>
        </>
      ) : (
        <Button ref={fallback} type="button" variant="secondary" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => setItems(initial)}>
          Qayta tiklash
        </Button>
      )}
    </div>
  );
}

function BadgesSection() {
  const { t } = useTranslation();
  const [chips, setChips] = useState<string[]>(["remote"]);
  return (
    <Block id="badges" title="Belgi va chiplar" api="Badge · Chip · FilterChip · Kbd">
      <Demo title="Badge" note="Holat faqat rang bilan emas: matn va kerak bo'lsa ikonka.">
        <div className="flex flex-wrap gap-2">
          <Badge>{t("vacancyStatus.draft")}</Badge>
          <Badge tone="lapis" icon={<MessageSquare />}>{t("enums.application_status.interview")}</Badge>
          <Badge tone="firuza" icon={<BadgeCheck />}>{t("common.verified")}</Badge>
          <Badge tone="zafaron" icon={<Star />}>{t("common.featured")}</Badge>
          <Badge tone="anor">{t("enums.application_status.rejected")}</Badge>
          <Badge tone="outline">PostgreSQL</Badge>
          <Badge tone="neutral" className="num">{groupDigits(1284)}</Badge>
        </div>
        <div className="mt-3 w-44 max-w-full">
          <Badge tone="outline">Microsoft Excel va Google Sheets (ilg'or daraja)</Badge>
        </div>
      </Demo>
      <Demo title="Chip" note="Tanlanganda belgi prujina bilan chiqadi; aria-pressed.">
        <div className="flex flex-wrap gap-2">
          {(["office", "remote", "hybrid"] as const).map((v) => (
            <Chip key={v} selected={chips.includes(v)} onClick={() => setChips((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]))}>
              {t(`enums.work_format.${v}`)}
            </Chip>
          ))}
          <Chip disabled>{t("enums.employment_type.volunteer")}</Chip>
          <Chip selected disabled>{t("enums.employment_type.internship")}</Chip>
        </div>
      </Demo>
      <Demo title="FilterChip" note="Olib tashlangandan keyin fokus keyingi chipga yoki «Tozalash»ga o'tadi.">
        <FilterChipsDemo />
      </Demo>
      <Demo title="Kbd" note="Sensorli ekranda klaviatura maslahatlari yashiriladi (pointer-coarse:hidden).">
        <div className="flex flex-wrap items-center gap-4 text-sm text-ink-2">
          <span className="flex items-center gap-1"><Kbd>Ctrl</Kbd><Kbd>K</Kbd> qidiruv</span>
          <span className="flex items-center gap-1"><Kbd>⌘</Kbd><Kbd>K</Kbd> macOS</span>
          <span className="flex items-center gap-1"><Kbd>Esc</Kbd> yopish</span>
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> tanlash</span>
          <span className="flex items-center gap-1"><Kbd>F8</Kbd> toastga o'tish</span>
        </div>
      </Demo>
    </Block>
  );
}

const PEOPLE = ["Dilnoza Karimova", "Jasur Toshmatov", "Aziza Rahimova", "Bobur Aliyev", "Madina Yusupova", "Sardor Qodirov", "Nilufar Ergasheva"];
const AVATAR_SIZES = ["xs", "sm", "md", "lg", "xl"] as const;

function AvatarsSection() {
  return (
    <Block id="avatars" title="Avatarlar" api="Avatar · AvatarGroup" lead="Rasm bo'lmasa bosh harflar, rangi ismdan aniqlanadi. width/height doim bor: sahifa siljimaydi.">
      <Demo title="Odam · xs sm md lg xl">
        <div className="flex flex-wrap items-end gap-4">
          {AVATAR_SIZES.map((s, i) => (
            <figure key={s} className="flex flex-col items-center gap-2">
              <Avatar name={PEOPLE[i]} size={s} alt={PEOPLE[i]} />
              <figcaption className="text-xs text-ink-3">{s}</figcaption>
            </figure>
          ))}
        </div>
      </Demo>
      <Demo title="Kompaniya (square)" note="Logo object-contain, chegarali yuzada; lg/xl rounded-panel.">
        <div className="flex flex-wrap items-end gap-4">
          {AVATAR_SIZES.map((s, i) => (
            <figure key={s} className="flex flex-col items-center gap-2">
              <Avatar name={["Uzum Market", "Korzinka", "Artel Electronics", "Job Vacancy", "Najot Ta'lim"][i]} square size={s} src={s === "lg" || s === "xl" ? "/favicon.svg" : null} alt="" />
              <figcaption className="text-xs text-ink-3">{s}</figcaption>
            </figure>
          ))}
        </div>
      </Demo>
      <Demo title="AvatarGroup" note="«+N» pufakchada ekran o'quvchi uchun matn bor.">
        <div className="flex flex-wrap items-center gap-6">
          {(["xs", "sm", "md"] as const).map((s) => (
            <AvatarGroup key={s} size={s} items={PEOPLE.map((name) => ({ name }))} max={4} label="Jamoa" />
          ))}
        </div>
      </Demo>
    </Block>
  );
}

function SegmentedSection() {
  const { t } = useTranslation();
  const [view, setView] = useState<"list" | "grid" | "map">("list");
  const [status, setStatus] = useState<"all" | "sent" | "interview" | "hired">("all");
  const [sort, setSort] = useState<"new" | "relevance" | "salary">("new");
  const [col, setCol] = useState<"new" | "interview" | "offer">("new");
  const [tab, setTab] = useState("all");
  const columns = { new: ["Dilnoza Karimova", "Bobur Aliyev"], interview: ["Aziza Rahimova"], offer: ["Sardor Qodirov"] };
  return (
    <Block id="segmented" title="Segment va tablar" api="SegmentedControl · Tabs · TabPanel" lead="Segment — radio guruh: bitta Tab to'xtashi, strelkalar, Home/End. Slayder faqat transform bilan siljiydi.">
      <div className="grid gap-8 md:grid-cols-2">
        <Demo title="Ikonkali, o'chirilgan variant bilan">
          <SegmentedControl
            label="Ko'rinish"
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: "Ro'yxat", icon: <List /> },
              { value: "grid", label: "Katak", icon: <LayoutGrid /> },
              { value: "map", label: "Xarita", icon: <MapIcon />, disabled: true },
            ]}
          />
        </Demo>
        <Demo title="sm · sanoq bilan" note="Sig'masa trek ichida suriladi, sahifa emas." className="md:order-last md:col-span-2">
          <SegmentedControl
            label="Ariza holati"
            size="sm"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "Hammasi", count: 128 },
              { value: "sent", label: t("enums.application_status.sent"), count: 42 },
              { value: "interview", label: t("enums.application_status.interview"), count: 7 },
              { value: "hired", label: t("enums.application_status.hired"), count: 2 },
            ]}
          />
        </Demo>
        <Demo title="fullWidth">
          <SegmentedControl
            label={t("jobs.sort")}
            fullWidth
            value={sort}
            onChange={setSort}
            options={[
              { value: "new", label: t("jobs.sortNewest") },
              { value: "relevance", label: t("jobs.sortRelevance") },
              { value: "salary", label: "Maosh" },
            ]}
          />
        </Demo>
        <Demo title="Tab rejimi (kanban mobil)" note="role=tablist + tabpanel, chap/o'ng strelkalar.">
          <SegmentedControl
            label="Kanban ustuni"
            tabs={{ idPrefix: "ui-kanban" }}
            fullWidth
            value={col}
            onChange={setCol}
            options={[
              { value: "new", label: "Yangi", count: 12 },
              { value: "interview", label: t("enums.application_status.interview"), count: 4 },
              { value: "offer", label: t("enums.application_status.invited"), count: 1 },
            ]}
          />
          {(["new", "interview", "offer"] as const).map((c) => (
            <div key={c} {...segmentedPanelProps("ui-kanban", c)} hidden={c !== col} className="mt-3 space-y-2 rounded-panel bg-sunken/70 p-3">
              {columns[c].map((n) => (
                <div key={n} className="surface-card flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={n} size="sm" />
                  <span className="min-w-0 truncate text-md text-ink">{n}</span>
                </div>
              ))}
            </div>
          ))}
        </Demo>
      </div>
      <Demo title="Tabs" note="Indikator CSS transform bilan siljiydi; mobil ekranda qator yon tomonga suriladi.">
        <Tabs
          value={tab}
          onValueChange={setTab}
          label="Arizalar"
          tabs={[
            { value: "all", label: "Hammasi", count: 128 },
            { value: "sent", label: t("enums.application_status.sent"), count: 42 },
            { value: "interview", label: t("enums.application_status.interview"), count: 7 },
            { value: "hired", label: t("enums.application_status.hired"), count: 2 },
            { value: "archived", label: t("vacancyStatus.archived"), disabled: true },
          ]}
        >
          {["all", "sent", "interview", "hired"].map((v) => (
            <TabPanel key={v} value={v} className="pt-4 text-md text-ink-2">
              «{v}» paneli: bu yerda shu holatdagi arizalar ro'yxati turadi.
            </TabPanel>
          ))}
        </Tabs>
      </Demo>
    </Block>
  );
}

function TogglesSection() {
  const { t } = useTranslation();
  const [sw, setSw] = useState(true);
  const [sw2, setSw2] = useState(false);
  const [cb, setCb] = useState(true);
  const [cb2, setCb2] = useState(false);
  const [radio, setRadio] = useState("full_time");
  return (
    <Block id="toggles" title="Almashtirgichlar" api="Switch · Checkbox · RadioGroup" lead="Butun qator — label: matnga bosish ham ishlaydi. Sensorli ekranda qator ≥ 44px.">
      <div className="grid gap-4 md:grid-cols-3">
        <Card padding="sm">
          <Switch checked={sw} onCheckedChange={setSw} label="Email bildirishnomalari" description="Ariza holati o'zgarsa xabar beramiz" />
          <Switch checked={sw2} onCheckedChange={setSw2} label="Telegram" />
          <Switch checked={false} onCheckedChange={() => {}} label="SMS (tez kunda)" disabled />
        </Card>
        <Card padding="sm">
          <Checkbox checked={cb} onCheckedChange={setCb} label={t("jobs.filters.withSalary")} />
          <Checkbox checked={cb2} onCheckedChange={setCb2} label="Faqat tasdiqlangan kompaniyalar" />
          <Checkbox checked onCheckedChange={() => {}} label="O'chirilgan (belgilangan)" disabled />
        </Card>
        <Card padding="sm">
          <RadioGroup
            label={t("jobs.filters.employment")}
            value={radio}
            onValueChange={setRadio}
            options={[
              { value: "full_time", label: t("enums.employment_type.full_time") },
              { value: "part_time", label: t("enums.employment_type.part_time") },
              { value: "project", label: t("enums.employment_type.project") },
              { value: "volunteer", label: t("enums.employment_type.volunteer"), disabled: true },
            ]}
          />
        </Card>
      </div>
    </Block>
  );
}

function TooltipSection() {
  const { t } = useTranslation();
  return (
    <Block id="tooltip" title="Tooltip" api="Tooltip" lead="Sichqoncha yoki klaviatura fokusida ochiladi, hech qachon bosishda emas. Yagona ma'lumot manbai bo'lmasligi kerak.">
      <div className="flex flex-wrap items-center gap-4">
        <Tooltip content={t("jobs.save")}>
          <IconButton label={t("jobs.save")} variant="secondary"><Heart className="size-5" /></IconButton>
        </Tooltip>
        <Tooltip content="Pastda ochiladi, joy bo'lmasa ag'dariladi" side="bottom">
          <Button type="button" variant="secondary">side="bottom"</Button>
        </Tooltip>
        <Tooltip content="Kompaniya profili tasdiqlangach e'lon qilish mumkin bo'ladi">
          {/* A disabled button gets no pointer or focus events: the span carries them and says why. */}
          <span tabIndex={0} className="inline-flex rounded-control">
            <Button type="button" disabled>E'lon qilish</Button>
          </span>
        </Tooltip>
        <Tooltip content={<span className="flex items-center gap-2">Qidiruv <Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>}>
          <IconButton label={t("common.search")} variant="ghost"><Search className="size-5" /></IconButton>
        </Tooltip>
      </div>
    </Block>
  );
}

// ---- surfaces -------------------------------------------------------------------------------

function CardsSection() {
  const { t } = useTranslation();
  const locale = useLocale();
  const ago = useIsoAgo();
  const [saved, setSaved] = useState(false);
  return (
    <Block id="cards" title="Kartalar" api="Card · CardHeader · CardBody · CardFooter · CardLink" lead="Barcha kontent qattiq surface-card'da. Qo'lda «rounded-panel border bg-surface» yozilmaydi.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Demo title="Header · body · footer">
          <Card as="section" aria-labelledby="ui-card-profile">
            <CardHeader
              id="ui-card-profile"
              as="h3"
              title="Kompaniya profili"
              description="Nomzodlar shu ma'lumotlarni ko'radi."
              actions={<Button type="button" variant="secondary" size="sm" icon={<Pencil className="size-4" />}>{t("common.edit")}</Button>}
            />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-md">
                <div className="min-w-0"><dt className="text-sm text-ink-2">Soha</dt><dd className="text-ink">IT va dasturlash</dd></div>
                <div className="min-w-0"><dt className="text-sm text-ink-2">Xodimlar</dt><dd className="num text-ink">{groupDigits(1200)}+</dd></div>
                <div className="min-w-0"><dt className="text-sm text-ink-2">Hudud</dt><dd className="text-ink">Toshkent</dd></div>
                <div className="min-w-0"><dt className="text-sm text-ink-2">Sayt</dt><dd className="truncate text-lapis-ink">uzum.uz</dd></div>
              </dl>
            </CardBody>
            <CardFooter>
              <Button type="button" variant="ghost">{t("common.cancel")}</Button>
              <Button type="button">{t("common.save")}</Button>
            </CardFooter>
          </Card>
        </Demo>
        <Demo title="interactive + CardLink" note="Bitta cho'zilgan havola; ikkinchi darajali tugma relative z-10.">
          <Card as="article" interactive className="flex gap-4">
            <Avatar name="Uzum Technologies" square size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                <Badge tone="zafaron" icon={<Star />}>{t("common.featured")}</Badge>
                <RelTime iso={ago(2)} />
              </div>
              <h3 className="mt-2 break-words text-lead font-semibold tracking-snug text-ink">
                <CardLink to="/vacancies" prefetch="intent">Senior Frontend dasturchi (React)</CardLink>
              </h3>
              <p className="mt-1 text-md text-ink-2">
                <span className="inline-flex items-center gap-1 text-ink">
                  Uzum Technologies <BadgeCheck aria-label={t("common.verified")} className="size-4 shrink-0 text-firuza" />
                </span>{" "}
                · Toshkent, Yunusobod
              </p>
              <p className="num mt-3 font-display text-lg font-semibold tracking-heading text-firuza-ink">
                {salary({ min: 25_000_000, max: 35_000_000, currency: "UZS" }, t, locale)}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge>{t("enums.experience.3_6")}</Badge>
                <Badge>{t("enums.schedule.full_day")}</Badge>
                <Badge>{t("enums.work_format.hybrid")}</Badge>
              </div>
            </div>
            <IconButton label={t("jobs.save")} aria-pressed={saved} onClick={() => setSaved((s) => !s)} className="relative z-10 -mr-2 -mt-2 self-start">
              <Heart className={cn("size-5", saved && "anim-heart fill-anor text-anor")} />
            </IconButton>
          </Card>
        </Demo>
      </div>
      <Demo title="padding: sm · md · lg · radius=sheet">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card padding="sm"><p className="font-medium text-ink">padding="sm"</p><p className="text-sm text-ink-2">p-4 · ichki panel</p></Card>
          <Card><p className="font-medium text-ink">padding="md"</p><p className="text-sm text-ink-2">p-5 md:p-6 · standart</p></Card>
          <Card padding="lg"><p className="font-medium text-ink">padding="lg"</p><p className="text-sm text-ink-2">p-6 md:p-8 · forma</p></Card>
          <Card radius="sheet" padding="lg"><p className="font-medium text-ink">radius="sheet"</p><p className="text-sm text-ink-2">sahifa sarlavhasi, muharrir</p></Card>
        </div>
      </Demo>
      <Demo title='material="glass"' note="Faqat aurora ustidagi plitalar uchun. Shisha kartada CardLink ishlatilmaydi.">
        <AuroraStage>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card material="glass">
              <p className="font-semibold text-ink">Bugun 1 284 ta yangi vakansiya</p>
              <p className="mt-1 text-sm text-ink-2">glass-panel · rounded-panel</p>
            </Card>
            <Card material="glass" interactive as="button" type="button" className="text-left">
              <p className="font-semibold text-ink">interactive (tugma)</p>
              <p className="mt-1 text-sm text-ink-2">glass-interactive: hover tini, bosilganda 0.97</p>
            </Card>
          </div>
        </AuroraStage>
      </Demo>
    </Block>
  );
}

function StatsSection() {
  const [loading, setLoading] = useState(false);
  return (
    <Block id="stats" title="Statistika" api="StatCard · StatCardSkeleton" lead="Skeleton kartaning aniq balandligida: yuklanib bo'lganda sahifa siljimaydi.">
      <div className="flex"><Switch checked={loading} onCheckedChange={setLoading} label="Skeletonni ko'rsatish" /></div>
      <Demo title='size="md" · dashboard'>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            <>
              <StatCardSkeleton sparkline />
              <StatCardSkeleton sparkline />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard label="Faol vakansiyalar" value={groupDigits(12)} icon={<BriefcaseBusiness />} delta={{ value: 20, label: "o'tgan haftaga nisbatan" }} sparkline={[4, 6, 5, 8, 9, 11, 12]} />
              <StatCard label="Yangi arizalar" value={groupDigits(1284)} icon={<Inbox />} delta={{ value: -8, label: "o'tgan haftaga nisbatan" }} sparkline={[40, 38, 44, 36, 30, 33, 29]} />
              <StatCard label="Ko'rishlar" value={groupDigits(40218)} icon={<Eye />} delta={{ value: 0 }} hint="So'nggi 30 kun" />
              <StatCard label="Ishga olindi" value={groupDigits(312)} icon={<UserCheck />} tone="firuza" />
            </>
          )}
        </div>
      </Demo>
      <Demo title='size="sm" · material="glass" · hero'>
        <AuroraStage>
          <div className="mx-auto grid max-w-2xl grid-cols-3 gap-2 sm:gap-4">
            {loading ? (
              <>
                <StatCardSkeleton size="sm" material="glass" />
                <StatCardSkeleton size="sm" material="glass" />
                <StatCardSkeleton size="sm" material="glass" />
              </>
            ) : (
              <>
                <StatCard size="sm" material="glass" label="Vakansiyalar" value={groupDigits(40218)} />
                <StatCard size="sm" material="glass" label="Kompaniyalar" value={groupDigits(3940)} />
                <StatCard size="sm" material="glass" label="Ishga olindi" value={groupDigits(312)} tone="firuza" />
              </>
            )}
          </div>
        </AuroraStage>
      </Demo>
    </Block>
  );
}

function CalloutsSection() {
  return (
    <Block id="callouts" title="Callout" api='Callout tone="info|success|warning|danger"'>
      <div className="grid gap-4 md:grid-cols-2">
        <Callout tone="info" title="Profilingiz 72% to'ldirilgan">Tajriba bo'limini qo'shsangiz, ish beruvchilar sizni 3 barobar ko'p topadi.</Callout>
        <Callout tone="success" title="Kompaniya tasdiqlandi">Endi vakansiyalaringiz yonida firuza belgi ko'rinadi.</Callout>
        <Callout tone="warning" title="Vakansiya muddati 3 kundan keyin tugaydi" action={<Button type="button" variant="secondary" size="sm">Uzaytirish</Button>}>
          Muddat tugagach, vakansiya qidiruvdan olib tashlanadi.
        </Callout>
        <Callout tone="danger" title="Vakansiya rad etildi">
          Sabab: maosh ko'rsatilmagan. <a href="#callouts">Qoidalarni o'qing</a> va qayta yuboring.
        </Callout>
        <Callout tone="info" className="md:col-span-2">Sarlavhasiz callout: bir qatorli izoh uchun.</Callout>
      </div>
    </Block>
  );
}

function StatesSection() {
  const { t } = useTranslation();
  return (
    <Block id="states" title="Bo'sh va xato holatlar" api="EmptyState · ErrorState" lead="Xato hech qachon «bo'sh» ko'rinishida emas va cheksiz skeleton emas: sabab + qayta urinish.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Demo title='EmptyState · size="md"'>
          <Card padding="none">
            <EmptyState
              icon={<Search />}
              title={t("empty.vacanciesTitle")}
              body={t("empty.vacanciesBody")}
              action={<Button type="button" variant="soft" icon={<Bell className="size-4" />}>{t("jobs.saveSearch")}</Button>}
              secondaryAction={<Button type="button" variant="ghost">{t("jobs.filters.clear")}</Button>}
            />
          </Card>
        </Demo>
        <Demo title='EmptyState · size="sm"'>
          <Card padding="none">
            <EmptyState size="sm" icon={<Bookmark />} title="Saqlangan vakansiyalar yo'q" body="Yoqqan vakansiyadagi yurakchani bosing." action={<Button asChild variant="secondary" size="sm"><LocalizedLink to="/vacancies">{t("nav.vacancies")}</LocalizedLink></Button>} />
          </Card>
        </Demo>
        <Demo title="ErrorState · tarmoq" note="onRetry promise qaytarsa, tugma spinner bilan kutadi.">
          <Card padding="none">
            <ErrorState headingAs="h3" error={new TypeError("Failed to fetch")} onRetry={() => wait(1200)} homeLink requestId="01J9Z3K4X7QF" />
          </Card>
        </Demo>
        <Demo title="ErrorState · 404">
          <Card padding="none">
            <ErrorState headingAs="h3" error={{ status: 404 }} homeLink />
          </Card>
        </Demo>
      </div>
      <Demo title="ErrorState compact" note="soft() bilan yuklanadigan bo'limlar uchun bir qatorli variant.">
        <ErrorState compact error={{ code: "rate_limited", message: "", retry_after: 30 }} onRetry={() => wait(900)} />
      </Demo>
    </Block>
  );
}

function SkeletonsSection() {
  const { t } = useTranslation();
  const [delayKey, setDelayKey] = useState(0);
  return (
    <Block id="skeletons" title="Skeletonlar" api="Skeleton · SkeletonText · SkeletonRows · SkeletonDelay · Spinner" lead="Skeleton kontent shaklida: bir xil o'lcham, radius va joylashuv. Hech qachon bitta katta blok emas.">
      <div className="grid gap-6 md:grid-cols-2">
        <Demo title="Skeleton · SkeletonText">
          <Card className="space-y-4">
            <div className="flex gap-4">
              <Skeleton className="size-14 shrink-0 rounded-control" />
              <div className="flex-1 space-y-2.5 pt-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-2/3" />
              </div>
            </div>
            <SkeletonText lines={3} />
          </Card>
        </Demo>
        <Demo title="SkeletonDelay" note="150ms ko'rinmaydi, keyin paydo bo'ladi: tez javobda miltillamaydi.">
          <Button type="button" variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => setDelayKey((k) => k + 1)}>Qayta</Button>
          <SkeletonDelay key={delayKey} className="mt-3">
            <Card className="space-y-3"><SkeletonText lines={2} /><div className="flex items-center gap-2 text-sm text-ink-2"><Spinner className="size-4" />{t("common.loading")}</div></Card>
          </SkeletonDelay>
        </Demo>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Demo title="SkeletonRows · alohida kartalar"><SkeletonRows count={2} /></Demo>
        <Demo title="SkeletonRows divided · avatarsiz"><SkeletonRows count={3} divided avatar={false} /></Demo>
      </div>
    </Block>
  );
}

function TimelineSection() {
  const { t } = useTranslation();
  const ago = useIsoAgo();
  return (
    <Block id="timeline" title="Timeline" api="Timeline" lead="Vaqt RelTime bilan, sichqoncha ustida aniq sana.">
      <Card className="max-w-2xl">
        <Timeline
          items={[
            { id: 1, title: t("enums.application_status.sent"), at: ago(96) },
            { id: 2, title: "Ish beruvchi ko'rdi", at: ago(72), tone: "lapis", icon: <Eye /> },
            { id: 3, title: "Hujjat yetishmaydi", body: "Diplom nusxasini yuklang.", at: ago(60), tone: "anor" },
            {
              id: 4,
              title: "Suhbatga taklif",
              body: <p className="rounded-control bg-sunken px-3 py-2 text-md text-ink-2">«Ertaga soat 11:00 da ofisda kutamiz. Pasportingizni oling.»</p>,
              at: ago(26),
              tone: "zafaron",
              icon: <CalendarDays />,
            },
            { id: 5, title: t("enums.application_status.hired"), at: ago(2), tone: "firuza", icon: <Check /> },
          ]}
        />
      </Card>
    </Block>
  );
}

function SelectableSection() {
  const [resume, setResume] = useState("r1");
  const [role, setRole] = useState("seeker");
  return (
    <Block id="selectable" title="Tanlov kartalari" api='SelectableCardGroup · SelectableCard layout="row|stack"' lead="Radio semantikasi (strelkalar). Tanlangan kartada chegara 2px, kontent siljimaydi.">
      <div className="grid gap-8 md:grid-cols-2">
        <Demo title='layout="row" · rezyume tanlash'>
          <SelectableCardGroup label="Rezyume" value={resume} onValueChange={setResume}>
            <SelectableCard value="r1" icon={<FileText />} title="Frontend dasturchi" description="Yangilangan: 3 kun oldin" />
            <SelectableCard value="r2" icon={<FileText />} title="UI/UX dizayner" description="Yangilangan: 2 oy oldin" />
            <SelectableCard value="r3" icon={<FileText />} title="Qoralama rezyume" description="Avval yakunlang" disabled />
          </SelectableCardGroup>
        </Demo>
        <Demo title='layout="stack" · rol tanlash'>
          <SelectableCardGroup label="Kim sifatida" value={role} onValueChange={setRole} className="grid-cols-2">
            <SelectableCard layout="stack" value="seeker" icon={<Search />} title="Ish izlayapman" description="Rezyume va arizalar" />
            <SelectableCard layout="stack" value="employer" icon={<Building2 />} title="Xodim izlayapman" description="Vakansiya va nomzodlar" />
          </SelectableCardGroup>
        </Demo>
      </div>
    </Block>
  );
}

// ---- navigation -----------------------------------------------------------------------------

function CrumbsSection() {
  const { t } = useTranslation();
  return (
    <Block id="crumbs" title="Yo'l va orqaga" api="Breadcrumbs · BackLink" lead="Telefonda faqat «ota › joriy». BreadcrumbList JSON-LD avtomatik. PageHeader'ning breadcrumbs slotiga qo'yiladi.">
      <Demo title="Breadcrumbs">
        <Breadcrumbs
          items={[
            { label: "Bosh sahifa", to: "/" },
            { label: t("nav.vacancies"), to: "/vacancies" },
            { label: "IT va dasturlash", to: "/vacancies?category=1" },
            { label: "Senior Go dasturchi (Kubernetes, PostgreSQL)" },
          ]}
        />
      </Demo>
      <Demo title="BackLink" note="44px bosish maydoni; matn sahifa chetiga tekislangan.">
        <div className="flex flex-wrap gap-6">
          <BackLink to="/vacancies">{t("jobs.backToList")}</BackLink>
          <BackLink to="/" />
        </div>
      </Demo>
    </Block>
  );
}

function PaginationSection() {
  const [sp] = useSearchParams();
  // Real links (?page=N): keep the other demo's param and land back on this section.
  const href = (key: string) => (p: number) => {
    const next = new URLSearchParams(sp);
    next.set(key, String(p));
    return `?${next}#pagination`;
  };
  return (
    <Block id="pagination" title="Sahifalash" api="Pagination" lead="Haqiqiy havolalar: JavaScript'siz ishlaydi va qidiruv tizimlari kuzatadi. Telefonda «‹ 3 / 12 ›».">
      <Demo title="12 sahifa"><Pagination label="Sahifalar · 12" page={Number(sp.get("page")) || 4} pageCount={12} hrefFor={href("page")} /></Demo>
      <Demo title="3 sahifa"><Pagination label="Sahifalar · 3" page={Number(sp.get("p")) || 1} pageCount={3} hrefFor={href("p")} /></Demo>
    </Block>
  );
}

function ProgressSection() {
  const [upload, setUpload] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => () => clearInterval(timer.current), []);
  const start = () => {
    clearInterval(timer.current);
    setUpload(0);
    timer.current = setInterval(() => {
      setUpload((v) => {
        const next = Math.min(100, (v ?? 0) + 7);
        if (next >= 100) clearInterval(timer.current);
        return next;
      });
    }, 140);
  };
  const steps = [
    { id: "basics", label: "Asosiy", done: true },
    { id: "experience", label: "Tajriba", done: true },
    { id: "education", label: "Ta'lim", error: true },
    { id: "skills", label: "Ko'nikmalar" },
    { id: "preview", label: "Ko'rib chiqish" },
  ];
  const [step, setStep] = useState("skills");
  return (
    <Block id="progress" title="Progress va bosqichlar" api="Progress · Stepper">
      <div className="grid gap-8 md:grid-cols-2">
        <Demo title="Progress">
          <div className="space-y-5">
            <Progress value={72} label="Profil to'liqligi" showValue />
            <Progress value={upload ?? 0} label="Rezyume yuklanmoqda" tone="firuza" showValue />
            <Button type="button" variant="secondary" size="sm" icon={<Play className="size-4" />} onClick={start}>Yuklashni boshlash</Button>
          </div>
        </Demo>
        <Demo title="Ohanglar, o'lcham, noaniq">
          <div className="space-y-4">
            <Progress value={35} label='lapis · size="sm"' size="sm" showValue />
            <Progress value={60} label='firuza · size="sm"' tone="firuza" size="sm" showValue />
            <Progress value={85} label="zafaron" tone="zafaron" showValue />
            <Progress value={20} label="anor" tone="anor" showValue />
            <Progress label="Noaniq (anim-progress)" showValue />
          </div>
        </Demo>
      </div>
      <Demo title="Stepper · gorizontal, bosiladigan" note="Strelkalar, Home/End; bajarilgan — firuza belgi, xato — anor.">
        <Stepper steps={steps} current={step} onStepChange={setStep} />
      </Demo>
      <div className="grid gap-8 md:grid-cols-2">
        <Demo title='orientation="vertical"'>
          <Card padding="sm" className="max-w-xs">
            <Stepper steps={steps} current={step} onStepChange={setStep} orientation="vertical" />
          </Card>
        </Demo>
        <Demo title={`orientation="responsive" · faqat ko'rsatish`} note="lg dan kichikda qator, katta ekranda ro'yxat.">
          <Stepper steps={steps} current="experience" orientation="responsive" />
        </Demo>
      </div>
    </Block>
  );
}

type Candidate = { id: string; name: string; city: string; role: string; salary: number; status: "sent" | "viewed" | "interview" | "hired" | "rejected"; at: string };
// Column ids via a constant: test/i18n-keys.mjs reads every `key: "…"` literal as a translation key.
const COL = { name: "name", role: "role", salary: "salary", status: "status", at: "at", actions: "actions" } as const;
const STATUS_TONE: Record<Candidate["status"], BadgeTone> = { sent: "neutral", viewed: "lapis", interview: "lapis", hired: "firuza", rejected: "anor" };

function TableSection() {
  const { t } = useTranslation();
  const locale = useLocale();
  const ago = useIsoAgo();
  const [sort, setSort] = useState<DataTableSort>({ key: COL.at, dir: "desc" });
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const all = useMemo<Candidate[]>(
    () => [
      { id: "1", name: "Dilnoza Karimova", city: "Toshkent", role: "Frontend dasturchi", salary: 18_000_000, status: "interview", at: ago(3) },
      { id: "2", name: "Jasur Toshmatov", city: "Samarqand", role: "Backend dasturchi (Go)", salary: 25_000_000, status: "viewed", at: ago(20) },
      { id: "3", name: "Aziza Rahimova", city: "Farg'ona", role: "UI/UX dizayner", salary: 12_000_000, status: "sent", at: ago(50) },
      { id: "4", name: "Bobur Aliyev", city: "Buxoro", role: "DevOps muhandis", salary: 30_000_000, status: "hired", at: ago(120) },
      { id: "5", name: "Madina Yusupova", city: "Namangan", role: "QA muhandis", salary: 9_500_000, status: "rejected", at: ago(200) },
    ],
    [ago],
  );
  const rows = useMemo(() => {
    if (empty) return [];
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...all].sort((a, b) => {
      if (sort.key === COL.salary) return (a.salary - b.salary) * dir;
      if (sort.key === COL.name) return a.name.localeCompare(b.name) * dir;
      return a.at.localeCompare(b.at) * dir;
    });
  }, [all, sort, empty]);

  const columns: DataTableColumn<Candidate>[] = [
    {
      key: COL.name,
      header: "Nomzod",
      sortable: true,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={r.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{r.name}</p>
            <p className="truncate text-sm text-ink-2">{r.city}</p>
          </div>
        </div>
      ),
    },
    { key: COL.role, header: "Lavozim", cell: (r) => r.role },
    { key: COL.salary, header: "Kutilgan maosh", sortable: true, align: "end", className: "whitespace-nowrap", cell: (r) => <span className="num">{money(r.salary, "UZS", t, locale)}</span> },
    { key: COL.status, header: "Holat", cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{t(`enums.application_status.${r.status}`)}</Badge> },
    { key: COL.at, header: "Yangilangan", sortable: true, className: "whitespace-nowrap", cell: (r) => <RelTime iso={r.at} /> },
    {
      key: COL.actions,
      header: "",
      align: "end",
      cell: (r) => (
        <MenuRoot>
          <MenuTrigger asChild>
            <IconButton label={`${r.name}: amallar`} size="sm"><Ellipsis className="size-4.5" /></IconButton>
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<Eye className="size-4" />}>{t("common.open")}</MenuItem>
            <MenuItem icon={<MessageSquare className="size-4" />}>{t("nav.messages")}</MenuItem>
          </MenuContent>
        </MenuRoot>
      ),
    },
  ];

  return (
    <Block id="table" title="Jadval" api="DataTable" lead="md dan boshlab haqiqiy jadval (sticky sarlavha, aria-sort); telefonda har qator — karta. Yon tomonga hech qachon aylanmaydi.">
      <div className="flex flex-wrap gap-x-8">
        <Switch checked={loading} onCheckedChange={setLoading} label="Yuklanmoqda" />
        <Switch checked={empty} onCheckedChange={setEmpty} label="Bo'sh" />
      </div>
      <DataTable
        caption="Nomzodlar"
        rows={rows}
        rowKey={(r) => r.id}
        columns={columns}
        sort={sort}
        onSortChange={setSort}
        loading={loading}
        empty={<EmptyState size="sm" icon={<Users />} title="Nomzodlar yo'q" body="Vakansiyani TOP'ga chiqaring yoki bazadan qidiring." />}
        mobileCard={(r) => (
          <div className="flex items-start gap-3">
            <Avatar name={r.name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium text-ink">{r.name}</p>
              <p className="break-words text-sm text-ink-2">{r.role} · {r.city}</p>
              <p className="num mt-1 text-md text-ink">{money(r.salary, "UZS", t, locale)}</p>
            </div>
            <Badge tone={STATUS_TONE[r.status]}>{t(`enums.application_status.${r.status}`)}</Badge>
          </div>
        )}
      />
    </Block>
  );
}

const TITLES = ["Kassir", "Haydovchi (B toifa)", "Buxgalter (1C)", "Oshpaz", "Sotuv menejeri", "Frontend dasturchi", "Hamshira", "Ingliz tili o'qituvchisi", "Omborchi", "Qo'riqchi"];
const TOTAL = 17;

function LoadMoreSection() {
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const more = () => {
    if (loading) return;
    setLoading(true);
    timer.current = setTimeout(() => {
      setCount((c) => Math.min(TOTAL, c + 5));
      setLoading(false);
    }, 700);
  };
  return (
    <Block id="loadmore" title="Yana yuklash" api="LoadMore" lead="2-bosishdan keyin keyingi sahifalar o'zi yuklanadi; tugma klaviatura uchun qoladi. Har yuklash aria-live orqali e'lon qilinadi.">
      <Card as="ol" padding="none" className="divide-y divide-line overflow-hidden">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-5 py-3.5">
            <span className="min-w-0 truncate text-md text-ink">{TITLES[i % TITLES.length]}</span>
            <span className="num shrink-0 text-sm text-ink-2">#{i + 1}</span>
          </li>
        ))}
      </Card>
      <div className="flex flex-col items-center gap-3">
        <LoadMore hasNext={count < TOTAL} loading={loading} onClick={more} loadedCount={count} />
        {count >= TOTAL && (
          <Button type="button" variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => setCount(5)}>Qayta boshlash</Button>
        )}
      </div>
    </Block>
  );
}

// ---- overlays -------------------------------------------------------------------------------

function DialogsSection() {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { confirm, dialog } = useConfirm();
  const [format, setFormat] = useState<string[]>(["remote"]);
  const [withSalary, setWithSalary] = useState(true);
  return (
    <Block id="dialogs" title="Dialog va sheet" api="DialogContent size · SheetContent · ConfirmDialog · useConfirm" lead="glass-sheet, orqa parda bg-overlay. Fokus ichkarida qoladi va yopilgach tugmaga qaytadi. Telefonda sheet pastdan chiqadi, pastga surib yopiladi.">
      <div className="flex flex-wrap gap-3">
        <DialogRoot>
          <DialogTrigger asChild><Button type="button" variant="secondary">Dialog · sm</Button></DialogTrigger>
          <DialogContent
            size="sm"
            title="Arizani qaytarib olasizmi?"
            description="Ish beruvchi arizangizni boshqa ko'rmaydi."
            closeLabel={t("common.close")}
            footer={
              <>
                <DialogClose asChild><Button type="button" variant="secondary">{t("common.cancel")}</Button></DialogClose>
                <DialogClose asChild><Button type="button" variant="danger">Qaytarib olish</Button></DialogClose>
              </>
            }
          />
        </DialogRoot>
        <DialogRoot>
          <DialogTrigger asChild><Button type="button" variant="secondary">Dialog · md (forma)</Button></DialogTrigger>
          <DialogContent
            title={t("jobs.saveSearch")}
            description={t("jobs.saveSearchHint")}
            closeLabel={t("common.close")}
            footer={
              <>
                <DialogClose asChild><Button type="button" variant="secondary">{t("common.cancel")}</Button></DialogClose>
                <DialogClose asChild><Button type="button">{t("common.save")}</Button></DialogClose>
              </>
            }
          >
            <div className="space-y-4">
              <Field label={t("jobs.searchName")}><Input defaultValue="Frontend · Toshkent" /></Field>
              <Switch checked={withSalary} onCheckedChange={setWithSalary} label={t("jobs.notifyMe")} description={t("jobs.notifyMeHint")} />
            </div>
          </DialogContent>
        </DialogRoot>
        <DialogRoot>
          <DialogTrigger asChild><Button type="button" variant="secondary">Dialog · lg (uzun)</Button></DialogTrigger>
          <DialogContent
            size="lg"
            title="Foydalanish shartlari"
            description="Tana dialog ichida aylanadi, sarlavha va tugmalar joyida qoladi."
            closeLabel={t("common.close")}
            footer={<DialogClose asChild><Button type="button">Tushunarli</Button></DialogClose>}
          >
            <div className="rich-text">
              {Array.from({ length: 8 }, (_, i) => (
                <p key={i}>
                  {i + 1}. Vakansiyalar haqiqiy bo'lishi, maosh va ish sharoitlari aniq ko'rsatilishi kerak. Nomzodlardan pul so'rash,
                  shaxsiy ma'lumotlarni uchinchi shaxslarga berish va aldamchi e'lonlar taqiqlanadi.
                </p>
              ))}
            </div>
          </DialogContent>
        </DialogRoot>
        <DialogRoot>
          <DialogTrigger asChild><Button type="button" variant="secondary" icon={<SlidersHorizontal className="size-4" />}>{t("common.filters")} (sheet)</Button></DialogTrigger>
          <SheetContent
            title={t("common.filters")}
            closeLabel={t("common.close")}
            footer={
              <>
                <Button type="button" variant="secondary" onClick={() => setFormat([])}>{t("common.clear")}</Button>
                <DialogClose asChild><Button type="button" className="flex-1">{t("jobs.filters.show")}</Button></DialogClose>
              </>
            }
          >
            <div className="space-y-6">
              <fieldset>
                <legend className="text-sm font-medium text-ink">{t("jobs.filters.format")}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["office", "remote", "hybrid"] as const).map((v) => (
                    <Chip key={v} selected={format.includes(v)} onClick={() => setFormat((f) => (f.includes(v) ? f.filter((x) => x !== v) : [...f, v]))}>
                      {t(`enums.work_format.${v}`)}
                    </Chip>
                  ))}
                </div>
              </fieldset>
              <Switch checked={withSalary} onCheckedChange={setWithSalary} label={t("jobs.filters.withSalary")} />
              <SkeletonText lines={6} />
            </div>
          </SheetContent>
        </DialogRoot>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirmOpen(true)}>ConfirmDialog · danger</Button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          tone="danger"
          title="Rezyumeni o'chirasizmi?"
          body="«Frontend dasturchi» rezyumesi butunlay o'chiriladi. Buni qaytarib bo'lmaydi."
          confirmLabel={t("common.delete")}
          onConfirm={() => wait(1200).then(() => { toast({ tone: "success", title: "Rezyume o'chirildi" }); })}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            const ok = await confirm({ title: "Vakansiyani e'lon qilasizmi?", body: "Moderatsiyadan keyin qidiruvda ko'rinadi.", confirmLabel: "E'lon qilish" });
            toast({ tone: ok ? "success" : "info", title: ok ? "Moderatsiyaga yuborildi" : "Bekor qilindi" });
          }}
        >
          useConfirm() · default
        </Button>
        {dialog}
      </div>
    </Block>
  );
}

function PopoversSection() {
  const { t } = useTranslation();
  const [sort, setSort] = useState("relevance");
  const [compact, setCompact] = useState(false);
  return (
    <Block id="popovers" title="Popover va menyu" api="Popover · popoverItem · Menu*" lead="Oddiy ro'yxatlar — native Popover; menyu klaviaturasi kerak bo'lsa — Radix Menu. Ikkalasi bir xil shisha panel.">
      <div className="flex flex-wrap gap-3">
        <Popover
          label={t("jobs.share")}
          align="start"
          trigger={(p) => <Button type="button" variant="secondary" icon={<Share2 className="size-4" />} {...p}>{t("jobs.share")}</Button>}
        >
          <button type="button" className={popoverItem} onClick={() => toast({ tone: "success", title: t("jobs.linkCopied") })}>
            <Link2 className="size-4 text-ink-3" aria-hidden="true" />Havolani nusxalash
          </button>
          <button type="button" className={popoverItem} onClick={() => toast({ tone: "info", title: "Telegram" })}>
            <Send className="size-4 text-ink-3" aria-hidden="true" />Telegram
          </button>
          <LocalizedLink to="/me/saved" className={popoverItem}>
            <Bookmark className="size-4 text-ink-3" aria-hidden="true" />{t("nav.saved")}
          </LocalizedLink>
          <div className="-mx-1.5 my-1.5 h-px bg-line" />
          <div className="px-3">
            {/* Toggles inside keep the popover open (only items, links and [data-close] close it). */}
            <Switch checked={compact} onCheckedChange={setCompact} label="Ixcham ko'rinish" />
          </div>
        </Popover>
        <MenuRoot>
          <MenuTrigger asChild><Button type="button" variant="secondary" icon={<Ellipsis className="size-4" />}>Amallar</Button></MenuTrigger>
          <MenuContent align="start">
            <MenuLabel>Vakansiya</MenuLabel>
            <MenuItem icon={<Pencil className="size-4" />} onSelect={() => toast({ tone: "info", title: t("common.edit") })}>{t("common.edit")}</MenuItem>
            <MenuItem icon={<Copy className="size-4" />}>Nusxa yaratish</MenuItem>
            <MenuItem icon={<Archive className="size-4" />} disabled>Arxivlash (mavjud emas)</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 className="size-4" />} tone="danger">{t("common.delete")}</MenuItem>
          </MenuContent>
        </MenuRoot>
        <MenuRoot>
          <MenuTrigger asChild>
            <Button type="button" variant="ghost" icon={<ArrowDownUp className="size-4" />}>
              {sort === "relevance" ? t("jobs.sortRelevance") : t("jobs.sortNewest")}
            </Button>
          </MenuTrigger>
          <MenuContent align="start">
            <MenuLabel>{t("jobs.sort")}</MenuLabel>
            <MenuRadioGroup value={sort} onValueChange={setSort}>
              <MenuRadioItem value="relevance">{t("jobs.sortRelevance")}</MenuRadioItem>
              <MenuRadioItem value="newest">{t("jobs.sortNewest")}</MenuRadioItem>
            </MenuRadioGroup>
          </MenuContent>
        </MenuRoot>
      </div>
    </Block>
  );
}

const REGIONS = [
  "Toshkent shahri", "Toshkent viloyati", "Andijon viloyati", "Buxoro viloyati", "Farg'ona viloyati", "Jizzax viloyati",
  "Xorazm viloyati", "Namangan viloyati", "Navoiy viloyati", "Qashqadaryo viloyati", "Qoraqalpog'iston Respublikasi",
  "Samarqand viloyati", "Sirdaryo viloyati", "Surxondaryo viloyati",
].map((label, i) => ({ value: String(i + 1), label }));

function PickersSection() {
  const { t } = useTranslation();
  const [employment, setEmployment] = useState("full_time");
  const [sort, setSort] = useState("new");
  const [start, setStart] = useState("2023-09");
  const [year, setYear] = useState("");
  const [thisMonth] = useState(() => new Date().toISOString().slice(0, 7));
  return (
    <Block id="pickers" title="Select va oy tanlagich" api="Select · MonthPicker" lead="10 tadan ko'p variantda qidiruv maydoni chiqadi. Harf terib o'tish, strelkalar, Esc.">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("search.where")} hint="14 ta variant: qidiruv bilan">
          <Select placeholder={t("search.anywhere")} options={REGIONS} />
        </Field>
        <Field label={t("jobs.filters.employment")}>
          <Select
            required
            value={employment}
            onValueChange={setEmployment}
            options={(["full_time", "part_time", "project", "internship", "volunteer"] as const).map((v) => ({ value: v, label: t(`enums.employment_type.${v}`) }))}
          />
        </Field>
        <Field label={t("jobs.filters.category")}>
          <Select
            placeholder={t("jobs.filters.anyCategory")}
            groups={[
              { label: "IT", options: [{ value: "fe", label: "Frontend" }, { value: "be", label: "Backend" }, { value: "qa", label: "QA" }] },
              { label: "Savdo", options: [{ value: "cashier", label: "Kassir" }, { value: "sales", label: "Sotuv menejeri" }] },
            ]}
          />
        </Field>
        <Field label="Xato holati" error="Hududni tanlang">
          <Select placeholder={t("search.anywhere")} options={REGIONS.slice(0, 4)} />
        </Field>
        <Field label="O'chirilgan" hint="disabled">
          <Select disabled placeholder={t("search.anywhere")} options={REGIONS.slice(0, 4)} />
        </Field>
        <Field label='size="sm"'>
          <Select size="sm" defaultValue="2" options={REGIONS.slice(0, 4)} />
        </Field>
        <Field label="Ish boshlagan oy" hint="max: joriy oy">
          <MonthPicker value={start} onChange={setStart} max={thisMonth} />
        </Field>
        <Field label='Bitirgan yil · mode="year"'>
          <MonthPicker mode="year" value={year} onChange={setYear} placeholder="Yilni tanlang" />
        </Field>
        <Field label="MonthPicker · xato" error="Boshlanish sanasi tugashdan oldin bo'lsin">
          <MonthPicker value="2026-12" onChange={() => {}} />
        </Field>
      </div>
      <Demo title='variant="bare"' note="Kompozit boshqaruv ichida: fokusda surface chip va shadow-ring.">
        <div className="flex flex-wrap items-center gap-1 text-md text-ink-2">
          <span>{t("jobs.sort")}:</span>
          <Select
            variant="bare"
            aria-label={t("jobs.sort")}
            value={sort}
            onValueChange={setSort}
            options={[{ value: "new", label: t("jobs.sortNewest") }, { value: "rel", label: t("jobs.sortRelevance") }]}
          />
        </div>
      </Demo>
    </Block>
  );
}

function ToastsSection() {
  const { t } = useTranslation();
  return (
    <Block id="toasts" title="Toast" api="toast({ tone, title, body?, action? })" lead="Ko'pi bilan 3 ta; telefonda tab bar ustida markazda, desktopda o'ng pastda. Sensorli ekranda yon tomonga surib yopiladi. F8 — oxirgi toastga o'tish.">
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={() => toast({ tone: "success", title: t("apply.sent"), body: t("apply.sentBody") })}>success</Button>
        <Button type="button" variant="secondary" onClick={() => toast({ tone: "error", title: t("errors.network") })}>error</Button>
        <Button type="button" variant="secondary" onClick={() => toast({ tone: "info", title: t("jobs.searchSaved") })}>info</Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            toast({
              tone: "info",
              title: "Vakansiya saqlanganlardan olib tashlandi",
              action: { label: "Qaytarish", onClick: () => toast({ tone: "success", title: t("jobs.saved") }) },
            })
          }
        >
          action (Undo)
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            ["Birinchi", "Ikkinchi", "Uchinchi", "To'rtinchi"].forEach((n, i) => setTimeout(() => toast({ tone: "info", title: `${n} xabar` }), i * 250));
          }}
        >
          4 tasi ketma-ket (maks 3)
        </Button>
      </div>
    </Block>
  );
}

// ---- forms ----------------------------------------------------------------------------------

const NEAR_LIMIT = "Assalomu alaykum! Men 4 yillik tajribaga ega frontend dasturchiman. React va TypeScript bilan ishlayman, tayyorman.";

function FieldsSection() {
  const { t } = useTranslation();
  return (
    <Block id="fields" title="Maydonlar" api="Field · Input · Textarea · FormError" lead="Har bir matn maydoni field-shell ichida: bitta fokus halqasi, bitta xato ko'rinishi. Xato izohni almashtiradi va role=alert.">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("form.email")} hint="Tasdiqlash xati shu manzilga yuboriladi">
          <Input type="email" autoComplete="email" inputMode="email" placeholder="ism@misol.uz" />
        </Field>
        <Field label={t("search.what")} optional={t("common.optional")}>
          <Input leading={<Search className="size-4.5" />} trailing={<Kbd className="mr-3 pointer-coarse:hidden">/</Kbd>} placeholder="Masalan: kassir" />
        </Field>
        <Field label="Sayt manzili" error="Manzil https:// bilan boshlanishi kerak">
          <Input defaultValue="uzum.uz" inputMode="url" />
        </Field>
        <Field label="Foydalanuvchi nomi" success="Bu nom bo'sh">
          <Input defaultValue="dilnoza.k" autoComplete="username" />
        </Field>
        <Field label="O'chirilgan maydon" hint="Email tasdiqlangandan keyin o'zgartirib bo'lmaydi">
          <Input disabled defaultValue="dilnoza@misol.uz" />
        </Field>
        <Field label='inputSize="lg"'>
          <Input inputSize="lg" placeholder="Katta maydon (hero, auth)" />
        </Field>
        <Field label={t("apply.coverLetter")} hint={t("apply.coverHint")} optional={t("common.optional")} className="md:col-span-2">
          <Textarea maxLength={500} rows={3} placeholder="Nega aynan siz?" />
        </Field>
        <Field label="Chegaraga yaqin (≥ 95% — anor)" className="md:col-span-2">
          <Textarea maxLength={120} rows={2} defaultValue={NEAR_LIMIT} />
        </Field>
      </div>
      <FormError>Formada 2 ta xato bor. Belgilangan maydonlarni tekshiring.</FormError>
    </Block>
  );
}

function MoneySection() {
  const [amount, setAmount] = useState<number | null>(8_000_000);
  const [currency, setCurrency] = useState<Currency>("UZS");
  const [range, setRange] = useState<{ from: number | null; to: number | null }>({ from: 5_000_000, to: 12_000_000 });
  const [rangeCurrency, setRangeCurrency] = useState<Currency>("UZS");
  const [bad, setBad] = useState<{ from: number | null; to: number | null }>({ from: 9_000_000, to: 5_000_000 });
  const [phone, setPhone] = useState("+998901234567");
  const [partial, setPartial] = useState("+99890123");
  return (
    <Block id="money" title="Pul va telefon" api="MoneyInput · SalaryRange · PhoneInput" lead="Raqamlar yozish paytida guruhlanadi, kursor joyida qoladi. «$1,200.50» yoki «5 000 000 so'm» joylashtirilsa tozalanadi.">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Maosh" hint={`Qiymat: ${amount ?? "—"} (${currency})`}>
          <MoneyInput value={amount} onChange={setAmount} currency={currency} onCurrencyChange={setCurrency} />
        </Field>
        <Field label='size="lg" · boshqarilmaydigan'>
          <MoneyInput size="lg" defaultValue={25_000_000} placeholder="3 000 000" />
        </Field>
        <SalaryRange legend="Maosh oralig'i" from={range.from} to={range.to} onChange={setRange} currency={rangeCurrency} onCurrencyChange={setRangeCurrency} />
        <SalaryRange legend="Xato: «dan» «gacha»dan katta" from={bad.from} to={bad.to} onChange={setBad} />
        <Field label="Telefon" hint={phone ? `E.164: ${phone}` : "+998 kodi avtomatik"}>
          <PhoneInput value={phone} onChange={setPhone} />
        </Field>
        <Field label="Telefon · to'liq emas" error="Raqamni oxirigacha kiriting">
          <PhoneInput value={partial} onChange={setPartial} />
        </Field>
      </div>
    </Block>
  );
}

/** Dropzone with a fake upload: object URL preview + a progress tick, like the real callers. */
function DropzoneDemo({ variant, accept, maxSize, label, initialPreview, className }: {
  variant: "avatar" | "logo" | "cover" | "file";
  accept: string;
  maxSize: number;
  label: string;
  initialPreview?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(initialPreview ?? null);
  const [progress, setProgress] = useState<number | null>(null);
  const url = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => () => {
    clearInterval(timer.current);
    if (url.current) URL.revokeObjectURL(url.current);
  }, []);
  const onFiles = (files: File[]) => {
    const f = files[0];
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = f.type.startsWith("image/") ? URL.createObjectURL(f) : null;
    clearInterval(timer.current);
    setProgress(0);
    timer.current = setInterval(() => {
      setProgress((p) => {
        const next = (p ?? 0) + 12;
        if (next < 100) return next;
        clearInterval(timer.current);
        setPreview(url.current);
        toast({ tone: "success", title: `${f.name} yuklandi` });
        return null;
      });
    }, 120);
  };
  return (
    <FileDropzone
      className={className}
      variant={variant}
      accept={accept}
      maxSize={maxSize}
      label={label}
      onFiles={onFiles}
      progress={progress}
      previewUrl={preview}
      onRemove={() => setPreview(null)}
      removeLabel={t("common.delete")}
    />
  );
}

function FilesSection() {
  return (
    <Block id="files" title="Fayllar" api="FileDropzone" lead="Bosish, Enter/Space yoki tortib tashlash. Tur va hajm har bir fayl uchun oldindan tekshiriladi.">
      <div className="grid gap-5 md:grid-cols-2">
        <DropzoneDemo variant="avatar" accept="image/*" maxSize={5 * 1024 * 1024} label="Rasm yuklash" />
        <DropzoneDemo variant="logo" accept="image/png,image/svg+xml" maxSize={2 * 1024 * 1024} label="Logotip yuklash" initialPreview="/favicon.svg" />
        <DropzoneDemo variant="cover" accept="image/*" maxSize={8 * 1024 * 1024} label="Muqova yuklash" className="md:col-span-2" />
        <DropzoneDemo variant="file" accept=".pdf,.docx" maxSize={10 * 1024 * 1024} label="Rezyume faylini tanlang" />
        <FileDropzone variant="file" accept=".pdf" maxSize={10 * 1024 * 1024} label="Xato holati" onFiles={() => {}} error="Yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring." />
        <FileDropzone variant="file" accept=".pdf" maxSize={10 * 1024 * 1024} label="O'chirilgan" onFiles={() => {}} disabled />
      </div>
    </Block>
  );
}

function SearchSection() {
  const regions = REGIONS.map((r) => ({ value: r.value, label: r.label }));
  const onSearch = ({ query, region }: { query: string; region: string }) =>
    toast({ tone: "info", title: `Qidiruv: ${query || "—"}`, body: region ? regions.find((r) => r.value === region)?.label : undefined });
  return (
    <Block id="search" title="Qidiruv" api='SearchBar material="solid|glass"' lead="GET forma (JavaScript'siz ham ishlaydi), bitta fokus halqasi, takliflar combobox'i (/search/suggest, API kerak) va oxirgi qidiruvlar. Bu yerda onSearch bilan: sahifadan chiqmaydi.">
      <Demo title='material="solid" · md'>
        <SearchBar action="/vacancies" onSearch={onSearch} />
      </Demo>
      <Demo title='material="glass" · lg · hudud, takliflar, oxirgilar' note="Faqat hero aurorasi ustida. Hudud bo'lsa telefonda ustma-ust, tugma to'liq kenglikda.">
        <AuroraStage className="py-8 md:py-12">
          <SearchBar action="/vacancies" size="lg" material="glass" regions={regions} suggest recent onSearch={onSearch} className="mx-auto max-w-3xl" />
        </AuroraStage>
      </Demo>
    </Block>
  );
}

function AuthSection() {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [bad, setBad] = useState("12345");
  const [tags, setTags] = useState(["React", "TypeScript", "Figma"]);
  const [dirty, setDirty] = useState(false);
  const guard = useUnsavedChanges(dirty);
  return (
    <Block id="auth" title="Parol, kod, teglar" api="PasswordInput · CodeInput · TagInput · useUnsavedChanges">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("form.password")}>
          <PasswordInput strength autoComplete="new-password" placeholder="Kamida 8 belgi" />
        </Field>
        <Field label="Parol · xato" error="Kamida 8 belgi, bitta harf va bitta raqam.">
          <PasswordInput defaultValue="123" autoComplete="off" />
        </Field>
        <Demo title="CodeInput" note="«Sizning kodingiz: 123 456» joylashtirilsa, oltitasi ham to'ladi.">
          <CodeInput label="Tasdiqlash kodi" value={code} onChange={setCode} autoFocus={false} onComplete={(v) => toast({ tone: "success", title: `Kod: ${v}` })} />
        </Demo>
        <Demo title="CodeInput · xato">
          <CodeInput label="Tasdiqlash kodi (xato)" value={bad} onChange={setBad} autoFocus={false} aria-invalid />
        </Demo>
        <Field label={t("jobs.skills")} className="md:col-span-2">
          <TagInput value={tags} onChange={setTags} placeholder="Masalan: PostgreSQL" />
        </Field>
      </div>
      <Demo title="useUnsavedChanges" note="Yoqing va boshqa sahifaga o'ting: tasdiqlash dialogi chiqadi («Qolish» birinchi fokusda). Faqat so'rov qatori o'zgarsa, to'smaydi.">
        <Card padding="sm" className="max-w-xl">
          <Switch checked={dirty} onCheckedChange={setDirty} label="Saqlanmagan o'zgarishlar bor" />
          <LocalizedLink to="/vacancies" className="mt-2 inline-flex min-h-11 items-center text-md font-medium text-lapis-ink underline underline-offset-4">
            {t("nav.vacancies")} sahifasiga o'tish
          </LocalizedLink>
        </Card>
        {guard}
      </Demo>
    </Block>
  );
}

// ---- page -----------------------------------------------------------------------------------

export default function UI() {
  const appearance = useAppearancePreview();
  const active = useActiveSection(SECTION_IDS);
  return (
    <div className="container-page pb-16 pt-6 md:pb-24 md:pt-10">
      <Card as="header" radius="sheet" padding="none" className="relative isolate overflow-hidden px-5 py-10 md:px-10 md:py-14">
        <div aria-hidden="true" className="aurora-hero absolute inset-0 -z-10" />
        <GirihPattern className="-z-10" focus="ellipse 55% 80% at 88% 35%" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:gap-12">
          <div className="min-w-0">
            <Logo />
            <p className="mt-8 text-xs font-semibold uppercase tracking-caps text-lapis-ink">Dizayn tizimi · /ui</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-display text-ink sm:text-4xl md:text-5xl">Samarkand Glass</h1>
            <p className="mt-4 max-w-2xl text-lead text-ink-2">
              Samarqand koshinlari ranglari — lojuvard, firuza, za'faron va anor — va suzuvchi qatlamlar uchun Liquid Glass. Barcha tokenlar
              va umumiy komponentlar, har biri o'z variant va holatlari bilan.
            </p>
          </div>
          {/* Floats over the aurora like the real appearance popover: a glass panel is allowed here. */}
          <div className="glass-panel rounded-panel p-4">
            <PreviewControls a={appearance} />
          </div>
        </div>
      </Card>

      <MobileNav active={active} />

      <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <div className="sticky top-24 -mx-3 max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain px-3 pb-8 pt-4 scrollbar-none">
            <DesktopNav active={active} />
          </div>
        </aside>
        <div className="min-w-0">
          <ColorsSection glass={appearance.glass} />
          <GlassSection />
          <TypeSection />
          <ShapeSection />
          <MotionSection />
          <ButtonsSection />
          <BadgesSection />
          <AvatarsSection />
          <SegmentedSection />
          <TogglesSection />
          <TooltipSection />
          <CardsSection />
          <StatsSection />
          <CalloutsSection />
          <StatesSection />
          <SkeletonsSection />
          <TimelineSection />
          <SelectableSection />
          <CrumbsSection />
          <PaginationSection />
          <ProgressSection />
          <TableSection />
          <LoadMoreSection />
          <DialogsSection />
          <PopoversSection />
          <PickersSection />
          <ToastsSection />
          <FieldsSection />
          <MoneySection />
          <FilesSection />
          <SearchSection />
          <AuthSection />
        </div>
      </div>
    </div>
  );
}
