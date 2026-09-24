import { BadgeCheck, Clock, MapPin, Search, Tag, X } from "lucide-react";
import {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type FormEvent, type KeyboardEvent, type MouseEvent, type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { Form, useNavigate } from "react-router";

import { api } from "../api/client";
import { localizedPath } from "../i18n/config";
import { useLocale } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { groupDigits } from "../lib/format";
import { followAnchor, placeUnder } from "./anchor";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { fieldControl, fieldShell } from "./Field";
import { Select } from "./Select";

type Suggest = {
  titles?: { title?: string; vacancies?: number }[];
  companies?: { id: string; name: string; slug: string; logo_url: string | null; verified: boolean }[];
  skills?: { id: number; name: string }[];
};
type Option =
  | { kind: "recent" | "title" | "skill"; key: string; label: string; count?: number }
  | { kind: "company"; key: string; label: string; slug: string; logo: string | null; verified: boolean };
type Group = { id: string; label: string; options: Option[] };

const RECENT_KEY = "jv_recent_searches";
const RECENT_MAX = 6;

function readRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return []; // private mode, blocked storage, bad JSON
  }
}
function saveRecent(q: string) {
  try {
    const list = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: recent searches are a convenience */
  }
}

/** The typed part of a suggestion in full ink, the rest a step quieter. */
function highlight(label: string, q: string): ReactNode {
  const i = q ? label.toLocaleLowerCase().indexOf(q.toLocaleLowerCase()) : -1;
  if (i < 0) return label;
  return (
    <>
      {label.slice(0, i)}
      <span className="font-semibold text-ink">{label.slice(i, i + q.length)}</span>
      {label.slice(i + q.length)}
    </>
  );
}

export type SearchBarProps = {
  /** App path the form submits to, e.g. "/vacancies" (the locale prefix is added here). */
  action: string;
  size?: "md" | "lg";
  /** "glass" only over the aurora (hero); "solid" everywhere else. */
  material?: "solid" | "glass";
  defaultQuery?: string;
  defaultRegion?: string;
  /** Region choices; omit for no region select. */
  regions?: { value: string; label: string }[];
  queryName?: string;
  regionName?: string;
  /** Live suggestions from GET /search/suggest (titles with counts, companies, skills). */
  suggest?: boolean;
  /** Offer this device's recent searches when the field is empty. */
  recent?: boolean;
  placeholder?: string;
  /** Accessible name of the text field (default: the placeholder / "Position, company or skill"). */
  label?: string;
  submitLabel?: string;
  /** Hidden fields submitted along (current filters kept on a new query). */
  extraParams?: Record<string, string>;
  /** Handle the search in JS instead of navigating (e.g. update the URL with replace). */
  onSearch?: (v: { query: string; region: string }) => void;
  preventScrollReset?: boolean;
  autoFocus?: boolean;
  id?: string;
  className?: string;
};

/**
 * The one search bar (home hero, vacancies, companies, candidates): a GET form that works
 * without JavaScript, a keyword combobox with debounced suggestions and recent searches, an
 * optional region select and the submit button. One focus ring for the whole bar. With a
 * region it stacks on phones (full-width button); the suggestion list is a top-layer popover,
 * so opening it never moves the page.
 */
export function SearchBar({
  action, size = "md", material = "solid", defaultQuery = "", defaultRegion, regions, queryName = "q",
  regionName = "region_id", suggest = false, recent = false, placeholder, label, submitLabel, extraParams,
  onSearch, preventScrollReset, autoFocus, id: idProp, className,
}: SearchBarProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const genId = useId();
  const inputId = idProp ?? `${genId}-q`;
  const listId = `${genId}-list`;
  const formRef = useRef<HTMLFormElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const [text, setText] = useState(defaultQuery);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [remote, setRemote] = useState<{ q: string; data: Suggest } | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const cache = useRef(new Map<string, Suggest>());

  // A new query from the URL (back button, popular-search link) replaces the text.
  const [lastDefault, setLastDefault] = useState(defaultQuery);
  if (defaultQuery !== lastDefault) {
    setLastDefault(defaultQuery);
    setText(defaultQuery);
  }

  const q = text.trim();

  // Suggestions: 150 ms after the last keystroke, the previous request aborted, answers cached.
  useEffect(() => {
    if (!suggest || !focused || q.length < 2) return;
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
        /* aborted or offline: keep what's shown */
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [suggest, focused, q]);

  const groups = useMemo<Group[]>(() => {
    if (!q) {
      if (!recent || !recents.length) return [];
      return [{ id: "recent", label: t("inputs.recent"), options: recents.map((r) => ({ kind: "recent", key: `r-${r}`, label: r })) }];
    }
    if (!suggest || q.length < 2 || !remote) return [];
    const d = remote.data;
    const titles: Option[] = (d.titles ?? [])
      .filter((x) => x.title)
      .slice(0, 6)
      .map((x) => ({ kind: "title", key: `t-${x.title}`, label: x.title!, count: x.vacancies }));
    const seen = new Set(titles.map((o) => o.label.toLocaleLowerCase()));
    const companies: Option[] = (d.companies ?? []).slice(0, 3).map((c) => ({
      kind: "company", key: `c-${c.id}`, label: c.name, slug: c.slug, logo: c.logo_url, verified: c.verified,
    }));
    const skills: Option[] = (d.skills ?? [])
      .filter((s) => !seen.has(s.name.toLocaleLowerCase()))
      .slice(0, 4)
      .map((s) => ({ kind: "skill", key: `s-${s.id}`, label: s.name }));
    return [
      { id: "titles", label: t("inputs.suggestTitles"), options: titles },
      { id: "companies", label: t("nav.companies"), options: companies },
      { id: "skills", label: t("jobs.skills"), options: skills },
    ].filter((g) => g.options.length);
  }, [q, recent, recents, suggest, remote, t]);
  const flat = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const listOpen = open && flat.length > 0;

  // New results → no option is highlighted until the user arrows into the list.
  useEffect(() => setActive(-1), [groups]);

  // Anchored under the whole bar; under the text row when the bar is stacked (phones + region).
  const hasRegions = Boolean(regions);
  const place = useCallback(() => {
    const pop = popRef.current;
    const anchor = hasRegions && !window.matchMedia("(min-width: 40rem)").matches ? rowRef.current : formRef.current;
    if (pop && anchor) placeUnder(pop, anchor, { maxHeight: 384, gap: 8 });
  }, [hasRegions]);

  useLayoutEffect(() => {
    const pop = popRef.current;
    if (!pop || typeof pop.showPopover !== "function") return;
    if (!listOpen) {
      if (pop.matches(":popover-open")) pop.hidePopover();
      return;
    }
    if (!pop.matches(":popover-open")) pop.showPopover();
    place();
    return followAnchor(pop, place);
  }, [listOpen, flat.length, place]);

  useEffect(() => {
    if (listOpen && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listOpen, listId]);

  const choose = (o: Option) => {
    if (o.kind === "company") {
      setOpen(false);
      navigate(localizedPath(locale, `/companies/${o.slug}`));
      return;
    }
    // Put the words in the field first, so the submitted form carries them.
    flushSync(() => {
      setText(o.label);
      setOpen(false);
    });
    formRef.current?.requestSubmit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    switch (e.key) {
      case "ArrowDown":
        if (!flat.length) return;
        e.preventDefault();
        if (!open) setOpen(true);
        setActive((a) => (open ? (a + 1) % flat.length : 0));
        break;
      case "ArrowUp":
        if (!listOpen) return;
        e.preventDefault();
        setActive((a) => (a <= 0 ? flat.length - 1 : a - 1));
        break;
      case "Enter":
        if (listOpen && active >= 0 && flat[active]) {
          e.preventDefault();
          choose(flat[active]);
        }
        break; // otherwise the form submits as usual
      case "Escape":
        // First Escape closes the list; the next one lets the browser clear the field.
        if (listOpen) {
          e.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    setOpen(false);
    if (recent && q) saveRecent(q);
    // Phones: drop the keyboard so the results aren't hidden under it.
    if (window.matchMedia("(pointer: coarse)").matches) inputRef.current?.blur();
    if (onSearch) {
      e.preventDefault();
      const region = new FormData(e.currentTarget).get(regionName);
      onSearch({ query: q, region: typeof region === "string" ? region : "" });
      return;
    }
    // Clean, shareable URLs: "/vacancies?q=kassir", not "?q=kassir&region_id=". The router reads
    // the form right after this handler, so empty fields sit out for that one read.
    const form = e.currentTarget;
    const empty = [...form.querySelectorAll<HTMLInputElement>("input[name]")].filter((el) => !el.value);
    for (const el of empty) {
      el.dataset.name = el.name;
      el.removeAttribute("name");
    }
    setTimeout(() => {
      for (const el of empty) el.setAttribute("name", el.dataset.name ?? "");
    });
  };

  // Presses on the row's padding or icon focus the field, like a native input box.
  const focusField = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input, button")) return;
    e.preventDefault();
    inputRef.current?.focus();
  };

  const lg = size === "lg";
  const glass = material === "glass";
  const stacked = Boolean(regions);
  const combo = suggest || recent; // a plain search box otherwise
  // The bar's own fields win over same-named extras (the query, the region).
  const hidden = Object.entries(extraParams ?? {}).filter(([k]) => k !== queryName && !(regions && k === regionName));
  const rowH = lg ? "h-13" : "h-11";
  const icon = lg ? "size-5" : "size-4.5";
  let index = -1;

  return (
    <Form
      ref={formRef}
      method="get"
      action={localizedPath(locale, action)}
      role="search"
      preventScrollReset={preventScrollReset}
      onSubmit={onSubmit}
      className={cn(
        "group/search relative flex min-w-0",
        stacked ? "flex-col gap-1 sm:flex-row sm:items-center sm:gap-1" : "items-center gap-1",
        glass ? "glass-panel rounded-sheet p-2" : cn(fieldShell, lg ? "rounded-panel p-1.5" : "p-1"),
        className,
      )}
    >
      {/* Glass keeps its own shadows: the focus ring is a separate layer that only fades in. */}
      {glass && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 shadow-ring transition-opacity duration-200 group-focus-within/search:opacity-100"
        />
      )}
      {hidden.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <div ref={rowRef} onMouseDown={focusField} className={cn("flex min-w-0 flex-1 cursor-text items-center gap-2.5 rounded-control pl-3 pr-1", rowH)}>
        <Search className={cn("shrink-0 text-ink-3", icon)} aria-hidden="true" />
        <label htmlFor={inputId} className="sr-only">{label ?? placeholder ?? t("search.what")}</label>
        <input
          ref={inputRef}
          id={inputId}
          name={queryName}
          type="search"
          {...(combo && {
            role: "combobox",
            "aria-expanded": listOpen,
            "aria-controls": listId,
            "aria-autocomplete": "list" as const,
            "aria-activedescendant": listOpen && active >= 0 ? `${listId}-${active}` : undefined,
          })}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={100}
          autoFocus={autoFocus}
          value={text}
          placeholder={placeholder ?? t("search.what")}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
            if (recent) setRecents(readRecent());
          }}
          onBlur={() => {
            setFocused(false);
            setOpen(false);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            fieldControl,
            "h-full flex-1 truncate",
            lg ? "text-base" : "text-md",
            "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
          )}
        />
        {text && (
          <button
            type="button"
            aria-label={t("inputs.clearQuery")}
            title={t("inputs.clearQuery")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setText("");
              setOpen(true);
              inputRef.current?.focus();
            }}
            className="relative grid size-8 shrink-0 place-items-center rounded-full text-ink-3 transition-colors duration-150 hover:bg-sunken hover:text-ink focus-visible:-outline-offset-2 after:absolute after:-inset-1.5"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {regions && (
        <>
          <span aria-hidden="true" className="mx-3 h-px shrink-0 bg-line sm:mx-0 sm:h-8 sm:w-px" />
          <div className={cn("flex min-w-0 items-center gap-2.5 rounded-control pl-3 sm:w-56 sm:shrink-0", rowH)}>
            <MapPin className={cn("shrink-0 text-ink-3", icon)} aria-hidden="true" />
            <Select
              name={regionName}
              variant="bare"
              defaultValue={defaultRegion ?? ""}
              options={regions}
              placeholder={t("search.anywhere")}
              aria-label={t("search.where")}
              className="h-full min-w-0 flex-1"
            />
          </div>
        </>
      )}

      <Button type="submit" size={lg ? "lg" : "md"} className={cn(lg && "px-7", stacked && "w-full sm:w-auto")}>
        {submitLabel ?? t("search.submit")}
      </Button>

      <div
        ref={popRef}
        popover="manual"
        className="popover-panel glass-sheet fixed inset-auto m-0 overflow-y-auto overscroll-contain rounded-panel p-1.5 text-ink"
      >
        <div id={listId} role="listbox" aria-label={t("inputs.suggestions")}>
          {groups.map((g) => (
            <div key={g.id} role="group" aria-labelledby={`${listId}-${g.id}`} className="not-first:mt-1">
              <div id={`${listId}-${g.id}`} role="presentation" className="px-3 pb-1 pt-2 text-xs font-semibold text-ink-3">
                {g.label}
              </div>
              {g.options.map((o) => {
                const i = ++index;
                const on = i === active;
                return (
                  <div
                    key={o.key}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={on}
                    // mousedown would blur the field first and close the list.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                    onPointerMove={() => !on && setActive(i)}
                    className={cn(
                      "flex min-h-10 cursor-pointer select-none items-center gap-3 rounded-control px-3 py-2 text-md text-ink-2 pointer-coarse:min-h-11",
                      on && "bg-sunken text-ink",
                    )}
                  >
                    {o.kind === "company" ? (
                      <Avatar name={o.label} src={o.logo} square size="xs" />
                    ) : o.kind === "recent" ? (
                      <Clock className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                    ) : o.kind === "skill" ? (
                      <Tag className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                    ) : (
                      <Search className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{highlight(o.label, q)}</span>
                    {o.kind === "company" && o.verified && (
                      <BadgeCheck className="size-4 shrink-0 text-firuza" aria-label={t("common.verified")} />
                    )}
                    {o.kind === "title" && o.count != null && (
                      <>
                        <span className="num shrink-0 text-sm text-ink-3" aria-hidden="true">{groupDigits(o.count)}</span>
                        <span className="sr-only">{t("jobs.total", { count: o.count })}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Announces how many suggestions arrived (the list itself is not a live region). */}
      <span className="sr-only" aria-live="polite">
        {listOpen && q ? t("inputs.suggestCount", { count: flat.length }) : ""}
      </span>
    </Form>
  );
}
