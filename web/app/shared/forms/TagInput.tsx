import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { api, dataOf } from "../api/client";
import { cn } from "../lib/cn";

/**
 * Free-text tags with suggestions from the skills catalog (an ARIA combobox).
 * Enter or comma adds, Backspace on an empty field removes the last tag.
 */
export function TagInput({
  value, onChange, max = 20, placeholder, label, id: idProp,
}: { value: string[]; onChange: (v: string[]) => void; max?: number; placeholder?: string; label?: string; id?: string }) {
  const genId = useId();
  const id = idProp ?? genId;
  const listId = `${id}-list`;
  const [text, setText] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const has = (s: string) => value.some((v) => v.toLowerCase() === s.toLowerCase());

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

  const add = (raw: string) => {
    const s = raw.trim().replace(/\s+/g, " ").slice(0, 50);
    if (!s || has(s) || value.length >= max) return;
    onChange([...value, s]);
    setText("");
    setItems([]);
  };

  const showList = open && items.length > 0;
  return (
    <div
      className="flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-control border border-line-strong bg-surface px-2 py-1.5 transition-[border-color,box-shadow] focus-within:border-lapis focus-within:shadow-[0_0_0_4px_var(--lapis-soft)]"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((v) => (
        <span key={v} className="inline-flex h-7 items-center gap-1 rounded-md bg-lapis-soft pl-2.5 pr-1 text-sm text-lapis-ink">
          {v}
          <button type="button" aria-label={`${v} ×`} onClick={() => onChange(value.filter((x) => x !== v))} className="grid size-5 place-items-center rounded hover:bg-lapis/15">
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <div className="relative min-w-[8rem] flex-1">
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-label={label}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          value={text}
          disabled={value.length >= max}
          placeholder={value.length ? undefined : placeholder}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v.slice(0, -1));
            else setText(v);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && items.length) { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
            else if (e.key === "ArrowUp" && items.length) { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
            else if (e.key === "Enter") { if (text.trim() || active >= 0) { e.preventDefault(); add(active >= 0 ? items[active] : text); } }
            else if (e.key === "Escape") setOpen(false);
            else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
          }}
          className="h-8 w-full bg-transparent px-1.5 text-[0.9375rem] text-ink outline-none placeholder:text-ink-3"
        />
        {showList && (
          <ul id={listId} role="listbox" className="absolute left-0 top-full z-20 mt-2 max-h-64 w-64 overflow-auto rounded-panel border border-line bg-surface p-1 shadow-pop">
            {items.map((s, i) => (
              <li
                key={s}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); add(s); }}
                className={cn("cursor-pointer rounded-lg px-2.5 py-2 text-sm text-ink", i === active ? "bg-sunken" : "hover:bg-sunken")}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
