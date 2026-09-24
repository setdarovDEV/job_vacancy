import { Check, ChevronDown, Search } from "lucide-react";
import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { followAnchor, placeUnder } from "./anchor";
import { popoverPanel } from "./Popover";

export type SelectOption = { value: string; label: string };
export type SelectGroup = { label: string; options: SelectOption[] };

type Props = {
  options?: SelectOption[];
  /** Shown after `options`, each under its own heading. */
  groups?: SelectGroup[];
  /** Text while nothing is chosen; also offered as the "clear" choice unless `required`. */
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  /** Submits the value with a surrounding <form>. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  /** "bare": no border or background, for use inside a composite control (hero search). */
  variant?: "default" | "bare";
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

type Row = { kind: "group"; label: string } | { kind: "option"; value: string; label: string; index: number };

const SEARCH_FROM = 10; // lists longer than this get a filter field
const ROW = 44; // option height used to estimate the list before it's shown

/**
 * Dropdown select drawn by us (the browser's native list can't be styled and looked foreign
 * next to the rest of the UI). Built as an ARIA combobox + listbox on the HTML Popover API:
 * top-layer stacking, outside-click and Escape come from the browser. Keyboard: arrows,
 * Home/End, Enter, Escape, type-to-jump; long lists get a filter field. The list is placed
 * before it paints (beforetoggle) and follows the trigger while the page scrolls.
 */
export const Select = forwardRef<HTMLButtonElement, Props>(function Select(
  {
    options = [], groups, placeholder, value, defaultValue, onValueChange, name, required, disabled,
    size = "md", variant = "default", className, id, ...aria
  },
  forwardedRef,
) {
  const { t } = useTranslation();
  const uid = useId().replace(/:/g, "");
  const listId = `${uid}-list`;
  const popId = `${uid}-pop`;
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const pop = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const all = useMemo(() => {
    const base: SelectOption[] = [...(placeholder && !required ? [{ value: "", label: placeholder }] : []), ...options];
    return { base, groups: groups ?? [] };
  }, [options, groups, placeholder, required]);
  const flat = useMemo(() => [...all.base, ...all.groups.flatMap((g) => g.options)], [all]);
  const selectedLabel = flat.find((o) => o.value === current && o.value !== "")?.label;
  const searchable = flat.length > SEARCH_FROM;

  // Visible rows (headings + options) after filtering; `index` numbers the options only.
  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const hit = (s: string) => !q || s.toLocaleLowerCase().includes(q);
    const out: Row[] = [];
    let i = 0;
    for (const o of all.base) if (hit(o.label) && !(q && o.value === "")) out.push({ kind: "option", ...o, index: i++ });
    for (const g of all.groups) {
      const groupHit = q && hit(g.label);
      const opts = g.options.filter((o) => groupHit || hit(o.label));
      if (!opts.length) continue;
      out.push({ kind: "group", label: g.label });
      for (const o of opts) out.push({ kind: "option", ...o, index: i++ });
    }
    return out;
  }, [all, query]);
  const visible = useMemo(() => rows.filter((r): r is Extract<Row, { kind: "option" }> => r.kind === "option"), [rows]);

  const choose = (v: string) => {
    if (value === undefined) setInner(v);
    if (v !== current) onValueChange?.(v);
    pop.current?.hidePopover();
  };

  // The list scrolls inside the panel, so its natural height is the list's plus the chrome.
  const chrome = 12 + (searchable ? 44 : 0);
  const place = useCallback(() => {
    if (!pop.current || !trigger.current) return;
    const natural = list.current?.scrollHeight || rows.length * ROW;
    placeUnder(pop.current, trigger.current, { minWidth: 224, height: natural + chrome });
  }, [rows.length, chrome]);

  useEffect(() => (open && pop.current ? followAnchor(pop.current, place) : undefined), [open, place]);

  // Keep the active option in view.
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${uid}-o${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, uid]);

  const onToggle = (e: React.ToggleEvent<HTMLDivElement>) => {
    const isOpen = e.newState === "open";
    setOpen(isOpen);
    if (isOpen) {
      place(); // exact now that the list is laid out
      setQuery("");
      setActive(Math.max(0, flat.findIndex((o) => o.value === current)));
      // Phones: don't pop the keyboard up just because the list opened.
      const fine = window.matchMedia("(pointer: fine)").matches;
      requestAnimationFrame(() => (searchable && fine ? search.current : list.current)?.focus({ preventScroll: true }));
    } else if (pop.current?.contains(document.activeElement) || document.activeElement === document.body) {
      trigger.current?.focus({ preventScroll: true });
    }
  };

  const move = (to: number) => visible.length && setActive((to + visible.length) % visible.length);

  const onListKey = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); move(active + 1); break;
      case "ArrowUp": e.preventDefault(); move(active - 1); break;
      case "Home": if (e.target === list.current) { e.preventDefault(); move(0); } break;
      case "End": if (e.target === list.current) { e.preventDefault(); move(visible.length - 1); } break;
      case "PageDown": e.preventDefault(); move(Math.min(active + 8, visible.length - 1)); break;
      case "PageUp": e.preventDefault(); move(Math.max(active - 8, 0)); break;
      case "Enter": {
        e.preventDefault();
        const o = visible[active];
        if (o) choose(o.value);
        break;
      }
      case "Tab": pop.current?.hidePopover(); break;
      default:
        // Type-to-jump when there's no filter field.
        if (e.target === list.current && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
          const now = Date.now();
          typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + e.key.toLocaleLowerCase(), at: now };
          const i = visible.findIndex((o) => o.label.toLocaleLowerCase().startsWith(typed.current.text));
          if (i >= 0) setActive(i);
        }
    }
  };

  const onTriggerKey = (e: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp"].includes(e.key) && !open) {
      e.preventDefault();
      pop.current?.showPopover();
    }
  };

  const setRef = (el: HTMLButtonElement | null) => {
    trigger.current = el;
    if (typeof forwardedRef === "function") forwardedRef(el);
    else if (forwardedRef) forwardedRef.current = el;
  };

  const bare = variant === "bare";
  return (
    <div className={cn("relative", className)}>
      <button
        ref={setRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-required={required || undefined}
        {...aria}
        disabled={disabled}
        popoverTarget={popId}
        onKeyDown={onTriggerKey}
        className={cn(
          "flex w-full items-center gap-2 rounded-control text-left text-ink transition-[border-color,box-shadow,background-color] duration-150",
          size === "sm" ? "h-9 text-sm pointer-coarse:h-11" : "h-11 text-md",
          bare
            ? // Inside a composite bar: no box until it's focused, then a surface chip with the ring. The
              // chip reaches 8px left into the gap so the text stays where it was, and never past the right edge.
              "-ml-2 h-full w-[calc(100%+0.5rem)] bg-transparent pl-2 pr-1 outline-none focus-visible:bg-surface focus-visible:shadow-ring"
            : cn(
                // Same box and focus treatment as field-shell inputs.
                "border border-line-strong bg-surface pl-3.5 pr-3 hover:border-ink-3",
                "outline-none focus-visible:border-focus focus-visible:shadow-ring",
                "aria-[invalid=true]:border-anor aria-[invalid=true]:focus-visible:shadow-ring-danger",
                open && "border-focus shadow-ring hover:border-focus",
                size === "sm" && "pl-3 pr-2.5",
              ),
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selectedLabel && "text-ink-3")}>{selectedLabel ?? placeholder ?? " "}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform duration-200 ease-spring", open && "rotate-180")} aria-hidden="true" />
      </button>

      {/* Form value + native "required" validation, without a visible native control. */}
      {(name || required) && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          required={required}
          value={current}
          onChange={() => {}}
          onFocus={() => trigger.current?.focus()}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
        />
      )}

      <div
        ref={pop}
        id={popId}
        popover="auto"
        onBeforeToggle={(e) => e.newState === "open" && place()}
        onToggle={onToggle}
        onKeyDown={onListKey}
        className={cn("popover-panel select-panel fixed inset-auto m-0 flex-col overflow-hidden [&:popover-open]:flex", popoverPanel)}
      >
        {searchable && (
          <label className="relative mb-1 flex shrink-0 items-center">
            <Search className="pointer-events-none absolute left-3 size-4 text-ink-3" aria-hidden="true" />
            <span className="sr-only">{t("common.search")}</span>
            <input
              ref={search}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              placeholder={t("common.search")}
              role="searchbox"
              aria-controls={listId}
              aria-activedescendant={active >= 0 && visible[active] ? `${uid}-o${active}` : undefined}
              className="h-10 w-full rounded-control bg-sunken pl-9 pr-3 text-md text-ink outline-none transition-shadow placeholder:text-ink-3 focus-visible:shadow-ring pointer-coarse:h-11"
            />
          </label>
        )}
        <ul
          ref={list}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={aria["aria-label"]}
          aria-activedescendant={active >= 0 && visible[active] ? `${uid}-o${active}` : undefined}
          // The focused list shows focus on its active option (inset ring), not around itself.
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none focus-visible:[&_[data-active]]:ring-2"
        >
          {rows.map((r) =>
            r.kind === "group" ? (
              <li key={`g-${r.label}`} role="presentation" className="px-3 pb-1 pt-3 text-xs font-semibold text-ink-3 first:pt-1.5">
                {r.label}
              </li>
            ) : (
              <li
                key={`o-${r.value}`}
                id={`${uid}-o${r.index}`}
                role="option"
                aria-selected={r.value === current}
                data-active={r.index === active || undefined}
                onPointerMove={() => r.index !== active && setActive(r.index)}
                onClick={() => choose(r.value)}
                className={cn(
                  "flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-control px-3 py-2 text-md ring-inset ring-focus pointer-coarse:min-h-11",
                  r.index === active && "bg-sunken",
                  r.value === "" ? "text-ink-3" : r.value === current ? "font-medium text-lapis-ink" : "text-ink",
                )}
              >
                <span className="min-w-0 flex-1 break-words">{r.label}</span>
                {r.value === current && r.value !== "" && <Check className="size-4 shrink-0 text-lapis" strokeWidth={2.5} aria-hidden="true" />}
              </li>
            ),
          )}
          {visible.length === 0 && (
            <li role="presentation" aria-live="polite" className="px-3 py-6 text-center text-md text-ink-3">{t("common.noResults")}</li>
          )}
        </ul>
      </div>
    </div>
  );
});
