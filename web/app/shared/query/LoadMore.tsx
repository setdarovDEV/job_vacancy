import { useEffect, useRef, useState } from "react";

import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { Button } from "../ui/Button";

/**
 * "Load more" for cursor-paginated lists. After the second manual click the user has shown
 * they want to keep scrolling, so the next pages load as the button nears the viewport (the
 * button stays for keyboard and screen-reader users). Each finished load is announced politely;
 * pass `loadedCount` (items shown so far) to announce how many were added.
 */
export function LoadMore({ hasNext, loading, onClick, loadedCount, className }: {
  hasNext: boolean;
  loading: boolean;
  onClick: () => void;
  loadedCount?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const [clicks, setClicks] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);
  const onClickRef = useRef(onClick);
  useEffect(() => { onClickRef.current = onClick; });

  // Remember the count when a load starts; announce the difference when it ends.
  const before = useRef<number | undefined>(undefined);
  const wasLoading = useRef(loading);
  useEffect(() => {
    // Screen readers skip a live region whose text didn't change, so a repeat of the same
    // sentence gets an invisible trailing no-break space.
    const announce = (msg: string) => setAnnouncement((prev) => (prev === msg ? `${msg}\u00a0` : msg));
    if (loading && !wasLoading.current) before.current = loadedCount;
    if (!loading && wasLoading.current) {
      const added = loadedCount !== undefined && before.current !== undefined ? loadedCount - before.current : undefined;
      if (added === undefined) announce(t(hasNext ? "states.moreLoaded" : "states.allLoaded"));
      else if (added > 0) announce(t(hasNext ? "states.loadedMore" : "states.loadedMoreEnd", { n: added }));
    }
    wasLoading.current = loading;
  }, [loading, loadedCount, hasNext, t]);

  // A shrinking list means a new query (filters changed): start over with manual clicks.
  const lastCount = useRef(loadedCount);
  useEffect(() => {
    if (loadedCount !== undefined && lastCount.current !== undefined && loadedCount < lastCount.current) setClicks(0);
    lastCount.current = loadedCount;
  }, [loadedCount]);

  const auto = clicks >= 2;
  // Re-created whenever a load finishes, so a sentinel that is still in range triggers the
  // next page (the observer reports the current state on observe()).
  useEffect(() => {
    const el = sentinel.current;
    if (!auto || loading || !hasNext || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); onClickRef.current(); } },
      { rootMargin: "0px 0px 600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [auto, loading, hasNext]);

  return (
    <div ref={sentinel} className={cn("mt-5 flex justify-center", !hasNext && "mt-0", className)}>
      {hasNext && (
        <Button
          variant="secondary"
          loading={loading}
          onClick={() => { setClicks((c) => c + 1); onClick(); }}
        >
          {t("jobs.loadMore")}
        </Button>
      )}
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
    </div>
  );
}
