import * as D from "@radix-ui/react-dialog";
import {
  BadgeCheck, Briefcase, Building2, Clock, CornerDownLeft, Handshake, House, LogIn, Plus, Search, Tag, UserPlus, X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { useNavigate } from "react-router";

import { api } from "../api/client";
import { useSession } from "../auth/session";
import { localizedPath } from "../i18n/config";
import { useLocale } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { groupDigits } from "../lib/format";
import { readRecent, saveRecent, type Suggest } from "../search/recent";
import { Avatar } from "../ui/Avatar";
import { Kbd } from "../ui/Kbd";
import { Spinner } from "../ui/Spinner";
import { accountLinks, postVacancyHref } from "./UserArea";

type Item = {
  id: string;
  label: string;
  icon: ReactNode;
  /** App path (localized when opened). */
  to: string;
  hint?: ReactNode;
  /** Query to remember in the recent searches when this item is opened. */
  remember?: string;
};
type Group = { id: string; label?: string; items: Item[] };

// Case- and apostrophe-insensitive (o'z / oʻz / o‘z are the same letter to a typist).
const norm = (s: string) => s.toLocaleLowerCase().replace(/[ʻʼ‘’`']/g, "");

function highlight(label: string, q: string): ReactNode {
  const i = q ? label.toLocaleLowerCase().indexOf(q.toLocaleLowerCase()) : -1;
  if (i < 0) return label;
  return (
    <>
      {label.slice(0, i)}
      <span className="font-semibold text-lapis-ink">{label.slice(i, i + q.length)}</span>
      {label.slice(i + q.length)}
    </>
  );
}

const tile = (Icon: LucideIcon) => <Icon className="size-4.5" aria-hidden="true" />;

/**
 * ⌘K / Ctrl+K palette: jump to a vacancy search, a company or any section of the site. Lives
 * in its own chunk, fetched on the first shortcut or search-button press (see SiteHeader).
 * Combobox pattern: focus stays in the field, arrows move the highlighted option, Enter opens
 * it; results are announced. Suggestions come from /search/suggest (debounced, cached).
 * On close focus goes back to what opened it (`returnFocus` when nothing was focused, e.g. a tap
 * on iOS), or to the page content after a result was opened.
 */
export default function CommandPalette({
  open, onOpenChange, returnFocus,
}: { open: boolean; onOpenChange: (v: boolean) => void; returnFocus?: RefObject<HTMLElement | null> }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const { status, user } = useSession();
  const authed = status === "authed" ? user : null;
  const uid = useId();
  const listId = `${uid}-list`;
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const navigated = useRef(false);

  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const [remote, setRemote] = useState<{ q: string; data: Suggest } | null>(null);
  const cache = useRef(new Map<string, Suggest>());
  const q = text.trim();

  // Every opening starts clean with fresh recent searches.
  useEffect(() => {
    if (!open) return;
    setText("");
    setActive(0);
    setRecents(readRecent());
  }, [open]);

  // Suggestions: 150 ms after the last keystroke, the previous request aborted, answers cached.
  useEffect(() => {
    if (!open || q.length < 2) return;
    const key = q.toLocaleLowerCase();
    const hit = cache.current.get(key);
    if (hit) return setRemote({ q, data: hit });
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await api.GET("/search/suggest", { params: { query: { q: q.slice(0, 100) } }, signal: ctl.signal });
        const data = (res.data as { data?: Suggest } | undefined)?.data;
        if (!data) return;
        cache.current.set(key, data);
        setRemote({ q, data });
      } catch {
        /* aborted or offline: the local results still work */
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [open, q]);
  const fetching = q.length >= 2 && remote?.q !== q && !cache.current.has(q.toLocaleLowerCase());

  const pages = useMemo<Item[]>(() => {
    const base: { to: string; key: string; icon: LucideIcon }[] = [
      { to: "/", key: "shell.palette.home", icon: House },
      { to: "/vacancies", key: "nav.vacancies", icon: Briefcase },
      { to: "/companies", key: "nav.companies", icon: Building2 },
      { to: "/employers", key: "nav.forEmployers", icon: Handshake },
    ];
    if (authed) {
      if (authed.role === "employer") base.push({ to: postVacancyHref(authed), key: "nav.postVacancy", icon: Plus });
      for (const l of accountLinks(authed)) base.push({ to: l.to, key: l.key, icon: l.icon ?? Briefcase });
    } else {
      base.push({ to: "/login", key: "nav.signIn", icon: LogIn }, { to: "/register", key: "nav.signUp", icon: UserPlus });
    }
    return base.map((p) => ({ id: `p-${p.to}`, label: t(p.key), icon: tile(p.icon), to: p.to }));
  }, [authed, t]);

  const groups = useMemo<Group[]>(() => {
    if (!q) {
      const recent: Item[] = recents.map((r) => ({
        id: `r-${r}`, label: r, icon: tile(Clock), to: `/vacancies?q=${encodeURIComponent(r)}`, remember: r,
      }));
      return [
        { id: "recent", label: t("inputs.recent"), items: recent },
        { id: "pages", label: t("shell.palette.pages"), items: pages },
      ].filter((g) => g.items.length);
    }
    const nq = norm(q);
    const search: Item = {
      id: "search", label: t("shell.palette.searchFor", { q }), icon: tile(Search),
      to: `/vacancies?q=${encodeURIComponent(q)}`, remember: q,
    };
    const d = remote?.q === q ? remote.data : cache.current.get(q.toLocaleLowerCase());
    const titles: Item[] = (d?.titles ?? [])
      .filter((x) => x.title && norm(x.title) !== nq)
      .slice(0, 5)
      .map((x) => ({
        id: `t-${x.title}`, label: x.title!, icon: tile(Search), to: `/vacancies?q=${encodeURIComponent(x.title!)}`, remember: x.title,
        hint: x.vacancies ? <span className="num">{groupDigits(x.vacancies)}</span> : undefined,
      }));
    const companies: Item[] = (d?.companies ?? []).slice(0, 4).map((c) => ({
      id: `c-${c.id}`, label: c.name, to: `/companies/${c.slug}`,
      icon: <Avatar name={c.name} src={c.logo_url} size="sm" square />,
      hint: c.verified ? <BadgeCheck className="size-4 text-firuza" aria-label={t("common.verified")} /> : undefined,
    }));
    const seen = new Set(titles.map((x) => norm(x.label)));
    const skills: Item[] = (d?.skills ?? [])
      .filter((s) => !seen.has(norm(s.name)))
      .slice(0, 4)
      .map((s) => ({ id: `s-${s.id}`, label: s.name, icon: tile(Tag), to: `/vacancies?q=${encodeURIComponent(s.name)}`, remember: s.name }));
    const matched = pages.filter((p) => norm(p.label).split(/\s+/).some((w) => w.startsWith(nq)) || norm(p.label).includes(nq));
    return [
      { id: "search", items: [search] },
      { id: "titles", label: t("inputs.suggestTitles"), items: titles },
      { id: "companies", label: t("nav.companies"), items: companies },
      { id: "skills", label: t("jobs.skills"), items: skills },
      { id: "pages", label: t("shell.palette.pages"), items: matched },
    ].filter((g) => g.items.length);
  }, [q, recents, remote, pages, t]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  // New results: the first option is highlighted, so Enter always does the obvious thing.
  useEffect(() => setActive(0), [groups]);
  const current = Math.min(active, flat.length - 1);
  const optId = (i: number) => `${uid}-o${i}`;

  // Keep the highlighted option visible while arrowing through a long list.
  useEffect(() => {
    if (current >= 0) document.getElementById(optId(current))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optId is derived from uid
  }, [current]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    if (item.remember) saveRecent(item.remember);
    navigated.current = true;
    onOpenChange(false);
    navigate(localizedPath(locale, item.to));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const n = flat.length;
    if (e.key === "ArrowDown" && n) {
      e.preventDefault();
      setActive((current + 1) % n);
    } else if (e.key === "ArrowUp" && n) {
      e.preventDefault();
      setActive((current - 1 + n) % n);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[current]);
    }
  };

  let index = -1;
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="anim-overlay fixed inset-0 z-50 bg-overlay" />
        <D.Content
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            // Fired before Radix focuses the field: activeElement is still the opener.
            const el = document.activeElement;
            opener.current = el instanceof HTMLElement && el !== document.body ? el : null;
            navigated.current = false;
          }}
          onCloseAutoFocus={(e) => {
            // No <D.Trigger> here, so Radix would drop focus on <body>. After opening a result the
            // new page's content takes it (RouteAnnouncer says which page); else the opener does.
            // preventScroll: the opener usually sits in the sticky header.
            e.preventDefault();
            const back = opener.current?.isConnected ? opener.current : returnFocus?.current;
            const to = navigated.current ? document.getElementById("main") : back;
            to?.focus({ preventScroll: true });
          }}
          className={cn(
            "glass-sheet anim-pop fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto flex max-w-xl origin-top flex-col overflow-hidden rounded-sheet",
            "max-h-[min(36rem,calc(100dvh-1.5rem))] md:top-[12vh] md:max-h-[min(36rem,76dvh)]",
          )}
        >
          <D.Title className="sr-only">{t("shell.palette.title")}</D.Title>
          {/* The field's focus indicator is the row's hairline turning focus-blue. */}
          <div className="flex shrink-0 items-center gap-2 border-b border-line pl-4 pr-2 transition-colors focus-within:border-focus">
            {fetching ? <Spinner className="size-5 shrink-0 text-ink-3" /> : <Search className="size-5 shrink-0 text-ink-3" aria-hidden="true" />}
            <input
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded={flat.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={current >= 0 ? optId(current) : undefined}
              aria-label={t("shell.palette.title")}
              placeholder={t("shell.palette.placeholder")}
              enterKeyHint="go"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={100}
              className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3" // jv-ui-ignore: focus shown by the row (focus-within)
            />
            {text && (
              <button
                type="button"
                onClick={() => { setText(""); input.current?.focus(); }}
                aria-label={t("inputs.clearQuery")}
                title={t("inputs.clearQuery")}
                className="grid size-9 shrink-0 place-items-center rounded-pill text-ink-3 transition-[background-color,color] hover:bg-sunken hover:text-ink pointer-coarse:size-11"
              >
                <X className="size-4.5" aria-hidden="true" />
              </button>
            )}
            <Kbd className="mr-2 pointer-coarse:hidden">Esc</Kbd>
            <D.Close className="hidden h-11 shrink-0 items-center rounded-pill px-3 text-md font-medium text-lapis-ink transition-colors hover:bg-sunken pointer-coarse:inline-flex">
              {t("common.cancel")}
            </D.Close>
          </div>

          <div
            id={listId}
            role="listbox"
            aria-label={t("shell.palette.results")}
            aria-busy={fetching || undefined}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
          >
            {groups.map((g) => (
              <div key={g.id} role="group" aria-labelledby={g.label ? `${uid}-${g.id}` : undefined} aria-label={g.label ? undefined : t("common.search")} className="py-1">
                {g.label && (
                  <div id={`${uid}-${g.id}`} role="presentation" className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-caps text-ink-3">
                    {g.label}
                  </div>
                )}
                {g.items.map((item) => {
                  const i = ++index;
                  const on = i === current;
                  return (
                    <div
                      key={item.id}
                      id={optId(i)}
                      role="option"
                      aria-selected={on}
                      onPointerMove={() => { if (!on) setActive(i); }}
                      // Keep focus (and the on-screen keyboard) in the field.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => go(item)}
                      className={cn(
                        "flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-control px-3 py-2 text-md text-ink transition-colors duration-100",
                        on && "bg-sunken",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-control text-ink-2 transition-colors duration-100",
                          on ? "bg-surface text-lapis-ink" : "bg-sunken",
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.id === "search" ? item.label : highlight(item.label, q)}</span>
                      {item.hint && <span className="shrink-0 text-sm text-ink-3">{item.hint}</span>}
                      <CornerDownLeft aria-hidden="true" className={cn("size-4 shrink-0 text-ink-3 pointer-coarse:hidden", on ? "opacity-100" : "opacity-0")} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div aria-hidden="true" className="hidden shrink-0 items-center gap-4 border-t border-line px-4 py-2.5 text-xs text-ink-2 pointer-fine:flex">
            <span className="inline-flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd>{t("shell.palette.hintMove")}</span>
            <span className="inline-flex items-center gap-1.5"><Kbd>↵</Kbd>{t("shell.palette.hintOpen")}</span>
            <span className="inline-flex items-center gap-1.5"><Kbd>Esc</Kbd>{t("shell.palette.hintClose")}</span>
          </div>
          <p className="sr-only" aria-live="polite">
            {q ? t("inputs.suggestCount", { count: flat.length }) : ""}
          </p>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
