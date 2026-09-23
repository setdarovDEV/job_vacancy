import { Check, ChevronDown, Search } from "lucide-react";
import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { placeUnder } from "./anchor";

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

/**
 * Dropdown select drawn by us (the browser's native list can't be styled and looked foreign
 * next to the rest of the UI). Built as an ARIA combobox + listbox on the HTML Popover API:
 * top-layer stacking, outside-click and Escape come from the browser. Keyboard: arrows,
 * Home/End, Enter, Escape, type-to-jump; long lists get a filter field.
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

  const place = useCallback(() => {
    if (pop.current && trigger.current) placeUnder(pop.current, trigger.current, { minWidth: 224 });
  }, []);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  // Keep the active option in view.
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${uid}-o${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, uid]);

  const onToggle = (e: React.ToggleEvent<HTMLDivElement>) => {
    const isOpen = e.newState === "open";
    setOpen(isOpen);
    if (isOpen) {
      place();
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
          "flex w-full items-center gap-2 text-left text-ink outline-none transition-[border-color,box-shadow,background-color] duration-150",
          size === "sm" ? "h-9 text-sm" : "h-11 text-[0.9375rem]",
          bare
            ? "h-full bg-transparent"
            : cn(
                "rounded-control border border-line-strong bg-surface pl-3.5 pr-3 hover:border-ink-3",
                "focus-visible:border-lapis focus-visible:shadow-[0_0_0_4px_var(--lapis-soft)] aria-[invalid=true]:border-anor",
                open && "border-lapis shadow-[0_0_0_4px_var(--lapis-soft)]",
                size === "sm" && "pl-3 pr-2.5",
              ),
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selectedLabel && "text-ink-3")}>{selectedLabel ?? placeholder ?? " "}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
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
        onToggle={onToggle}
        onKeyDown={onListKey}
        className="popover-panel select-panel fixed inset-auto m-0 flex-col overflow-hidden [&:popover-open]:flex rounded-panel border border-line bg-surface p-1.5 text-ink shadow-pop"
      >
        {searchable && (
          <label className="mb-1 flex h-10 shrink-0 items-center gap-2 rounded-control bg-sunken px-3">
            <Search className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
            <span className="sr-only">{t("common.search")}</span>
            <input
              ref={search}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              placeholder={t("common.search")}
              role="searchbox"
              aria-controls={listId}
              aria-activedescendant={active >= 0 && visible[active] ? `${uid}-o${active}` : undefined}
              className="h-full w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
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
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none"
        >
          {rows.map((r) =>
            r.kind === "group" ? (
              <li key={`g-${r.label}`} role="presentation" className="px-2.5 pb-1 pt-3 text-xs font-semibold text-ink-3 first:pt-1.5">
                {r.label}
              </li>
            ) : (
              <li
                key={`o-${r.value}`}
                id={`${uid}-o${r.index}`}
                role="option"
                aria-selected={r.value === current}
                onPointerMove={() => r.index !== active && setActive(r.index)}
                onClick={() => choose(r.value)}
                className={cn(
                  "flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-[0.625rem] px-2.5 py-2 text-sm",
                  r.index === active && "bg-sunken",
                  r.value === current ? "font-medium text-lapis-ink" : r.value === "" ? "text-ink-3" : "text-ink",
                )}
              >
                <span className="min-w-0 flex-1">{r.label}</span>
                {r.value === current && r.value !== "" && <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />}
              </li>
            ),
          )}
          {visible.length === 0 && <li className="px-2.5 py-6 text-center text-sm text-ink-3">{t("common.noResults")}</li>}
        </ul>
      </div>
    </div>
  );
});
