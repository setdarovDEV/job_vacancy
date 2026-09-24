import { useEffect, useRef, useState } from "react";

import { api } from "~/shared/api/client";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { groupDigits } from "~/shared/lib/format";
import { Button } from "~/shared/ui/Button";
import { DialogRoot, SheetContent } from "~/shared/ui/Dialog";
import { Filters } from "./Filters";
import { activeCount, canonicalSearch, clearFilters, type Query } from "./params";

type Count = { total: number; capped: boolean } | null;

// Counts per canonical query, for the whole visit: going back to a combination is instant.
const counts = new Map<string, Count>();

/**
 * Live "Show N vacancies" for a draft: one `limit=1` request (only meta.total is read), 250 ms
 * after the last change, the previous request aborted. While it runs the old number stays,
 * dimmed; if it fails the button falls back to a plain label.
 */
function useDraftCount(draft: Query, known: { key: string; count: Count }, open: boolean) {
  const key = canonicalSearch(draft, ["sort"]);
  const [, rerender] = useState(0);
  const last = useRef<Count>(known.count);
  const cached = key === known.key ? known.count : counts.get(key);

  useEffect(() => {
    if (!open || cached !== undefined) return;
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await api.GET("/vacancies", {
          params: { query: { ...(Object.fromEntries(new URLSearchParams(key)) as Record<string, never>), limit: 1 } },
          signal: ctl.signal,
        });
        const meta = (res.data as { meta?: { total?: number; total_capped?: boolean } } | undefined)?.meta;
        counts.set(key, res.response.ok && meta?.total != null ? { total: meta.total, capped: Boolean(meta.total_capped) } : null);
      } catch {
        if (ctl.signal.aborted) return;
        counts.set(key, null);
      }
      rerender((n) => n + 1);
    }, 250);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [open, key, cached]);

  if (cached !== undefined) last.current = cached;
  return { count: cached !== undefined ? cached : last.current, pending: cached === undefined };
}

/** Mobile/tablet filters: a bottom sheet whose changes apply only on "Show results". */
export default function FilterSheet({
  open, onOpenChange, query, total, capped, onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: Query;
  total: number | undefined;
  capped: boolean;
  onApply: (next: Query) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(query);
  // Every opening starts from the applied filters (a dismissed sheet discards its draft).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(query);
  }

  const known = { key: canonicalSearch(query, ["sort"]), count: total != null ? { total, capped } : null };
  const { count, pending } = useDraftCount(draft, known, open);
  const label = !count
    ? t("jobs.filters.show")
    : count.capped
      ? t("vacanciesPage.showCapped")
      : count.total === 0
        ? t("vacanciesPage.showNone")
        : t("vacanciesPage.showCount", { count: count.total, n: groupDigits(count.total) });

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={t("common.filters")}
        closeLabel={t("common.close")}
        footer={
          <>
            {/* A quiet text action beside the primary (Airbnb's "Clear all"): the live count keeps
                the room it needs at 360px in the longest locales. */}
            <Button variant="ghost" className="px-3" disabled={activeCount(draft) === 0} onClick={() => setDraft(clearFilters(draft))}>
              {t("common.clear")}
            </Button>
            <Button
              className="min-w-0 flex-1 px-3"
              onClick={() => {
                // Nothing changed: just close, no refetch of the same page.
                if (canonicalSearch(draft) !== canonicalSearch(query)) onApply(draft);
                onOpenChange(false);
              }}
            >
              <span aria-live="polite" className={cn("num truncate transition-opacity duration-200", pending && "opacity-60")}>
                {label}
              </span>
            </Button>
          </>
        }
      >
        <Filters q={draft} onChange={setDraft} draft />
      </SheetContent>
    </DialogRoot>
  );
}
