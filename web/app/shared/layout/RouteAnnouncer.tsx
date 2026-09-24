import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";

/**
 * Client-side navigations are silent for screen readers: the URL and title change, focus stays
 * where it was. This says the new page's title (already translated) in a polite live region, and
 * when the focused element went away with the old page (or nothing was focused) it moves focus
 * to <main id="main"> so Tab continues in the new content. Focus inside the persistent chrome
 * (header, tab bar, a layout's own nav) stays put. Search-only changes (filters, pages) are the
 * page's own business: they announce their results themselves.
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  // The page the announcer last saw. Not a "first render" flag: StrictMode re-runs mount effects,
  // and the first page load is announced by the browser itself (focus must stay at the top).
  const seen = useRef(pathname);

  useEffect(() => {
    if (seen.current === pathname) return;
    seen.current = pathname;
    // One frame later the new route's <title> is in the document.
    const raf = requestAnimationFrame(() => {
      setMessage(document.title);
      const active = document.activeElement;
      if (!active || active === document.body || !active.isConnected) {
        document.getElementById("main")?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}
