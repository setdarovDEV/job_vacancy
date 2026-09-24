import { Fragment, type ReactNode } from "react";

/*
 * Minimal, safe markdown for vacancy / resume / company text. Supported: paragraphs, line
 * breaks, "#"-headings, "-" / "•" / "*" / "1." lists and **bold**. A short "Vazifalar:" line
 * right before a list, or a line that is bold as a whole, reads as a sub-heading (that is how
 * employers structure text without knowing markdown). Everything becomes React text nodes (or
 * escaped HTML in toHtml), so user text can never inject markup.
 */

type Block =
  | { kind: "h"; text: string }
  | { kind: "p"; lines: string[] }
  | { kind: "ul" | "ol"; items: string[] };

const LIST_ITEM = /^([-•*]|\d{1,3}[.)])\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.+?)\s*#*$/;
const WHOLE_BOLD = /^\*\*([^*]+)\*\*$/;

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;
  const endPara = () => {
    if (para.length) blocks.push({ kind: "p", lines: para });
    para = [];
  };
  const endList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      endPara();
      endList();
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      endPara();
      endList();
      blocks.push({ kind: "h", text: h[1] });
      continue;
    }
    const li = LIST_ITEM.exec(line);
    if (li) {
      endPara();
      const kind = /\d/.test(li[1]) ? "ol" : "ul";
      if (list && list.kind !== kind) endList();
      list ??= { kind, items: [] };
      list.items.push(li[2]);
      continue;
    }
    endList();
    para.push(line);
  }
  endPara();
  endList();

  // "Talablar:" followed by a list, or a standalone all-bold line → sub-heading.
  return blocks.map((b, i) => {
    if (b.kind !== "p" || b.lines.length !== 1) return b;
    const line = b.lines[0];
    const bold = WHOLE_BOLD.exec(line)?.[1].trim();
    const label = (bold ?? line).replace(/\*\*/g, "");
    const next = blocks[i + 1];
    const beforeList = next && next.kind !== "p" && next.kind !== "h" && label.endsWith(":");
    if (label.length <= 80 && (bold || beforeList)) return { kind: "h", text: label.replace(/:$/, "") };
    return b;
  });
}

/**
 * Renders the text as semantic HTML elements. Pair it with the `rich-text` utility for the
 * reading typography (className="rich-text"); headings are h3, so they sit under a section h2.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {parse(text).map((b, i) => {
        if (b.kind === "h") return <h3 key={i}>{inline(b.text)}</h3>;
        if (b.kind === "p")
          return (
            <p key={i}>
              {b.lines.map((l, j) => (
                <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>
              ))}
            </p>
          );
        const List = b.kind;
        // list-style kept on the element too, for callers that don't use the rich-text utility
        return (
          <List key={i} className={List === "ol" ? "list-decimal pl-5" : "list-disc pl-5"}>
            {b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}
          </List>
        );
      })}
    </div>
  );
}

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inlineHtml = (s: string) => escape(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

/** The same structure as escaped HTML, e.g. for JobPosting.description (Google wants HTML there). */
export function toHtml(text: string): string {
  return parse(text)
    .map((b) => {
      if (b.kind === "h") return `<h3>${inlineHtml(b.text)}</h3>`;
      if (b.kind === "p") return `<p>${b.lines.map(inlineHtml).join("<br>")}</p>`;
      return `<${b.kind}>${b.items.map((it) => `<li>${inlineHtml(it)}</li>`).join("")}</${b.kind}>`;
    })
    .join("");
}

/** One line of plain text without markdown marks, e.g. for meta descriptions. */
export function plainText(text: string, max = 160): string {
  const flat = parse(text)
    .map((b) => (b.kind === "h" ? `${b.text}:` : b.kind === "p" ? b.lines.join(" ") : b.items.join("; ")))
    .join(" ")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}
