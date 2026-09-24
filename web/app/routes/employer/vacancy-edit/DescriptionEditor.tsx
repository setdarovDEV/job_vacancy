import { Bold, Eye, LayoutTemplate, List, ListOrdered, PencilLine, Sparkles } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import { LIMITS } from "./model";
import { useTranslation } from "~/shared/i18n/i18n";
import { RichText } from "~/shared/lib/markdown";
import { Badge } from "~/shared/ui/Badge";
import { Button, IconButton } from "~/shared/ui/Button";
import { Field, Textarea } from "~/shared/ui/Field";
import { SegmentedControl, segmentedPanelProps } from "~/shared/ui/SegmentedControl";

/*
 * The vacancy text with a small markdown toolbar. It only writes what RichText
 * (shared/lib/markdown.tsx) renders: **bold**, "- " bullets and "1. " numbered items. Edits go
 * through execCommand("insertText") where available, so the browser's own undo (Ctrl+Z) still
 * works after a toolbar action; otherwise the new text is set directly.
 */

type Sel = { value: string; start: number; end: number };
type Edit = { start: number; end: number; text: string; selStart: number; selEnd: number };

const BULLET = /^(\s*)[-•*]\s+/;
const NUMBER = /^(\s*)\d{1,3}[.)]\s+/;
// A list marker at the start of a line, kept outside the bold marks.
const MARKER = /^(\s*(?:[-•*]|\d{1,3}[.)])\s+|\s*)(.*?)(\s*)$/;

function lineBounds(value: string, start: number, end: number) {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  // A selection that ends right after a newline doesn't take in the next line.
  const stop = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const nl = value.indexOf("\n", stop);
  return { from, to: nl < 0 ? value.length : nl };
}

function toggleBold({ value, start, end }: Sel, sample: string): Edit {
  // Already bold around the selection: take the marks off.
  if (value.slice(start - 2, start) === "**" && value.slice(end, end + 2) === "**" && end > start) {
    return { start: start - 2, end: end + 2, text: value.slice(start, end), selStart: start - 2, selEnd: end - 2 };
  }
  const sel = value.slice(start, end);
  if (/^\*\*[^*\n]+\*\*$/.test(sel)) {
    const inner = sel.slice(2, -2);
    return { start, end, text: inner, selStart: start, selEnd: start + inner.length };
  }
  if (!sel.trim()) {
    const text = `**${sample}**`;
    return { start, end, text, selStart: start + 2, selEnd: start + 2 + sample.length };
  }
  // RichText reads **…** within one line: wrap every line on its own, spaces and list markers outside.
  const lines = sel.split("\n").map((line) => {
    const m = MARKER.exec(line)!;
    const core = m[2].replace(/\*\*/g, "");
    return core ? `${m[1]}**${core}**${m[3]}` : line;
  });
  const text = lines.join("\n");
  if (lines.length === 1) {
    const m = MARKER.exec(sel)!;
    const core = m[2].replace(/\*\*/g, "");
    const at = start + m[1].length + 2;
    return { start, end, text, selStart: at, selEnd: at + core.length };
  }
  return { start, end, text, selStart: start, selEnd: start + text.length };
}

function toggleList({ value, start, end }: Sel, kind: "ul" | "ol"): Edit {
  const { from, to } = lineBounds(value, start, end);
  const lines = value.slice(from, to).split("\n");
  const own = kind === "ul" ? BULLET : NUMBER;
  const other = kind === "ul" ? NUMBER : BULLET;
  const filled = lines.filter((l) => l.trim());
  // Every line is already this kind of item: turn the list back into plain lines.
  const off = filled.length > 0 && filled.every((l) => own.test(l));
  let n = 0;
  const text = filled.length
    ? lines.map((l) => {
        if (!l.trim()) return l;
        if (off) return l.replace(own, "$1");
        const bare = l.replace(other, "$1").replace(own, "$1");
        const indent = /^\s*/.exec(bare)![0];
        return `${indent}${kind === "ul" ? "-" : `${++n}.`} ${bare.slice(indent.length)}`;
      }).join("\n")
    : kind === "ul" ? "- " : "1. ";
  const collapsed = start === end && lines.length === 1;
  return {
    start: from, end: to, text,
    // A caret stays a caret (at the end of its line); a selection keeps covering the whole block.
    selStart: collapsed ? from + text.length : from,
    selEnd: from + text.length,
  };
}

/** Enter inside a list item starts the next item; Enter on an empty item ends the list. */
function continueList({ value, start, end }: Sel): Edit | null {
  if (start !== end) return null;
  const from = value.lastIndexOf("\n", start - 1) + 1;
  const m = /^(\s*)(?:([-•*])|(\d{1,3})([.)]))(\s+)/.exec(value.slice(from, start));
  if (!m) return null;
  const nl = value.indexOf("\n", start);
  const to = nl < 0 ? value.length : nl;
  if (!value.slice(from + m[0].length, to).trim()) return { start: from, end: to, text: "", selStart: from, selEnd: from };
  const text = `\n${m[1]}${m[2] ?? `${Number(m[3]) + 1}${m[4]}`} `;
  return { start, end, text, selStart: start + text.length, selEnd: start + text.length };
}

function applyEdit(el: HTMLTextAreaElement, e: Edit, onChange: (v: string) => void) {
  const before = el.value;
  el.focus({ preventScroll: true });
  el.setSelectionRange(e.start, e.end);
  let ok = false;
  try {
    ok = e.text ? document.execCommand("insertText", false, e.text) : e.start === e.end || document.execCommand("delete");
  } catch {
    ok = false; // no execCommand: set the value ourselves (undo history is lost then)
  }
  if (!ok || el.value === before) onChange(before.slice(0, e.start) + e.text + before.slice(e.end));
  requestAnimationFrame(() => el.setSelectionRange(e.selStart, e.selEnd));
}

export function DescriptionEditor({ value, onChange, onBlur, error }: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const empty = !value.trim();

  const edit = (make: (s: Sel) => Edit | null) => {
    const el = ref.current;
    const e = el && make({ value: el.value, start: el.selectionStart, end: el.selectionEnd });
    if (el && e) applyEdit(el, e, onChange);
  };
  const bold = () => edit((s) => toggleBold(s, t("vacancyEditor.boldSample")));
  const template = () => {
    const text = t("vacancyEditor.templateText");
    const caret = text.indexOf("- ") + 2;
    edit((s) => ({ start: 0, end: s.value.length, text, selStart: caret, selEnd: caret }));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // e.code too: Ctrl+B on a Cyrillic layout reports key "и".
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key.toLowerCase() === "b" || e.code === "KeyB")) {
      e.preventDefault();
      bold();
      return;
    }
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    const next = continueList({ value: el.value, start: el.selectionStart, end: el.selectionEnd });
    if (!next) return;
    e.preventDefault();
    applyEdit(el, next, onChange);
  };

  // Arrow keys move between the toolbar buttons, as in any toolbar.
  const onToolbarKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    buttons[(at + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  };
  // Clicking a tool must not take focus (and the selection) away from the text.
  const keepFocus = { onMouseDown: (e: MouseEvent) => e.preventDefault() };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <label htmlFor="f-description" className="text-sm font-medium text-ink">{t("jobs.description")}</label>
        <SegmentedControl
          size="sm"
          label={t("vacancyEditor.mode")}
          value={mode}
          onChange={setMode}
          tabs={{ idPrefix: "vac-desc" }}
          options={[
            { value: "write", label: t("vacancyEditor.write"), icon: <PencilLine /> },
            { value: "preview", label: t("vacancyEditor.preview"), icon: <Eye /> },
          ]}
        />
      </div>

      {mode === "write" ? (
        <div {...segmentedPanelProps("vac-desc", "write")} tabIndex={undefined} className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="toolbar"
              aria-label={t("vacancyEditor.toolbar")}
              aria-controls="f-description"
              onKeyDown={onToolbarKey}
              className="flex items-center gap-0.5 rounded-pill border border-line bg-surface p-1"
            >
              <IconButton size="sm" shape="pill" label={t("vacancyEditor.bold")} aria-keyshortcuts="Control+B Meta+B" onClick={bold} {...keepFocus}>
                <Bold className="size-4" />
              </IconButton>
              <IconButton size="sm" shape="pill" label={t("vacancyEditor.bulletList")} onClick={() => edit((s) => toggleList(s, "ul"))} {...keepFocus}>
                <List className="size-4" />
              </IconButton>
              <IconButton size="sm" shape="pill" label={t("vacancyEditor.numberedList")} onClick={() => edit((s) => toggleList(s, "ol"))} {...keepFocus}>
                <ListOrdered className="size-4" />
              </IconButton>
              {empty && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  shape="pill"
                  title={t("vacancyEditor.templateHint")}
                  icon={<LayoutTemplate className="size-4" />}
                  onClick={template}
                  {...keepFocus}
                  className="anim-fade"
                >
                  {t("vacancyEditor.template")}
                </Button>
              )}
            </div>
            {/* Announced feature, not a control yet. */}
            <p className="ml-auto hidden items-center gap-1.5 text-sm text-ink-2 sm:flex">
              <Sparkles aria-hidden="true" className="size-4 text-zafaron" />
              {t("employer.aiWriter")}
              <Badge tone="zafaron">{t("common.soon")}</Badge>
            </p>
          </div>
          <Field hint={t("employer.descriptionHint")} error={error}>
            <Textarea
              ref={ref}
              id="f-description"
              rows={12}
              maxLength={LIMITS.descriptionMax}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={onBlur}
              placeholder={t("employer.descriptionPlaceholder")}
            />
          </Field>
        </div>
      ) : (
        <div
          {...segmentedPanelProps("vac-desc", "preview")}
          // About as tall as the 12-row text box, so switching tabs doesn't make the page jump.
          style={{ minHeight: "19.5rem" }}
          className="rounded-control border border-line bg-sunken/60 p-4 md:p-5"
        >
          {empty ? (
            <p className="text-md text-ink-2">{t("vacancyEditor.previewEmpty")}</p>
          ) : (
            <RichText text={value} className="rich-text" />
          )}
        </div>
      )}
    </div>
  );
}
