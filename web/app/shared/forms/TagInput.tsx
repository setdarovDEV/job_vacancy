import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { api, dataOf } from "../api/client";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { fieldControl, fieldShell } from "../ui/Field";
import { followAnchor, placeUnder } from "../ui/anchor";

type TagInputProps = {
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  placeholder?: string;
  label?: string;
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
};

/**
 * Free-text tags with suggestions from the skills catalog (an ARIA combobox).
 * Enter or comma adds, Backspace on an empty field removes the last tag. The suggestion list
 * is a top-layer popover, so it's never clipped by a card and never shifts the layout.
 */
export function TagInput({
  value, onChange, max = 20, placeholder, label, id: idProp, disabled,
  "aria-invalid": invalid, "aria-describedby": describedBy,
}: TagInputProps) {
  const { t } = useTranslation();
  const genId = useId();
  const id = idProp ?? genId;
  const listId = `${id}-list`;
  const helpId = `${id}-help`;
  const [text, setText] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const has = (s: string) => value.some((v) => v.toLowerCase() === s.toLowerCase());
  const full = value.length >= max;

  useEffect(() => {
    const q = text.trim();
    if (!q) return setItems([]);
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await api.GET("/catalog/skills", { params: { query: { q, limit: 8 } }, signal: ctl.signal });
        setItems((dataOf<{ name: string }[]>(res) ?? []).map((s) => s.name).filter((n) => !has(n)));
        setActive(-1);
      } catch {
        /* aborted or offline: no suggestions */
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const showList = open && items.length > 0 && !full;

  // Show / hide the popover and keep it under the field while the page scrolls.
  useLayoutEffect(() => {
    const pop = popRef.current;
    const shell = shellRef.current;
    if (!pop || !shell || typeof pop.showPopover !== "function") return;
    if (!showList) {
      if (pop.matches(":popover-open")) pop.hidePopover();
      return;
    }
    if (!pop.matches(":popover-open")) pop.showPopover();
    const place = () => placeUnder(pop, shell, { minWidth: 240, maxHeight: 320, gap: 6 });
    place();
    return followAnchor(pop, place);
  }, [showList, items.length]);

  useEffect(() => {
    if (showList && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, showList, listId]);

  const add = (raw: string) => {
    const s = raw.trim().replace(/\s+/g, " ").slice(0, 50);
    if (!s || has(s) || full) return;
    onChange([...value, s]);
    setText("");
    setItems([]);
  };

  return (
    <div
      ref={shellRef}
      className={cn(fieldShell, "flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 px-2 py-1.5")}
      // Pressing the padding between tags focuses the text field, like any input box.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }}
    >
      {value.map((v) => (
        <span
          key={v}
          className="inline-flex h-7 min-w-0 max-w-full items-center gap-1 rounded-pill bg-lapis-soft pl-2.5 pr-1 text-sm font-medium text-lapis-ink pointer-coarse:h-9"
        >
          <span className="min-w-0 truncate" title={v}>{v}</span>
          <button
            type="button"
            disabled={disabled}
            aria-label={t("inputs.removeTag", { name: v })}
            onClick={() => {
              onChange(value.filter((x) => x !== v));
              inputRef.current?.focus(); // the button is gone: don't drop focus on <body>
            }}
            className="relative grid size-5 shrink-0 place-items-center rounded-full transition-colors duration-150 hover:bg-lapis/15 focus-visible:outline-offset-0 pointer-coarse:size-7 after:absolute after:-inset-1.5 pointer-coarse:after:-inset-2"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-label={label}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        aria-describedby={[describedBy, helpId].filter(Boolean).join(" ")}
        autoComplete="off"
        enterKeyHint="enter"
        value={text}
        disabled={disabled}
        placeholder={value.length ? undefined : placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(",")) add(v.slice(0, -1));
          else setText(v);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          setOpen(false);
          // Moving on to another field keeps a typed tag (not lost on Save); switching apps doesn't add one.
          if (e.relatedTarget && text.trim()) add(text);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "ArrowDown" && items.length) { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % items.length); }
          else if (e.key === "ArrowUp" && items.length) { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
          else if (e.key === "Enter") { if (text.trim() || (showList && active >= 0)) { e.preventDefault(); add(showList && active >= 0 ? items[active] : text); } }
          else if (e.key === "Escape") { if (showList) { e.preventDefault(); setOpen(false); } }
          else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
        }}
        className={cn(fieldControl, "h-8 min-w-32 flex-1 px-1.5 text-md")}
      />
      <span id={helpId} className="sr-only">{t("inputs.tagHelp")}</span>
      <div
        ref={popRef}
        popover="manual"
        className="popover-panel glass-sheet fixed inset-auto m-0 overflow-y-auto overscroll-contain rounded-panel p-1.5 text-ink"
      >
        <ul id={listId} role="listbox" aria-label={label}>
          {items.map((s, i) => (
            <li
              key={s}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown would blur the input first and close the list.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s)}
              onPointerMove={() => i !== active && setActive(i)}
              className={cn(
                "flex min-h-10 cursor-pointer select-none items-center rounded-control px-3 py-2 text-md text-ink pointer-coarse:min-h-11",
                i === active && "bg-sunken",
              )}
            >
              <span className="min-w-0 break-words">{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
