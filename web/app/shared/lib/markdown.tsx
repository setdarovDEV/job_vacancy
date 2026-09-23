import { Fragment, type ReactNode } from "react";

/**
 * Minimal, safe rendering of vacancy/resume text: paragraphs, line breaks, "-"/"•"/"1."
 * lists and **bold**. Everything becomes React text nodes — no HTML is ever injected.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*([-•*]|\d+[.)])\s+/.test(l))) {
          const ordered = /^\s*\d/.test(lines[0]);
          const items = lines.map((l) => l.replace(/^\s*([-•*]|\d+[.)])\s+/, ""));
          const List = ordered ? "ol" : "ul";
          return (
            <List key={i} className={ordered ? "list-decimal space-y-1.5 pl-5" : "list-disc space-y-1.5 pl-5 marker:text-ink-3"}>
              {items.map((it, j) => <li key={j}>{inline(it)}</li>)}
            </List>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : part,
  );
}
