import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

import { useConsent, type CookieConsent } from "../consent/consent";
import { useRuntime } from "../runtime/runtime";

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

/** Load gtag.js once; page views are sent by hand on every navigation. */
function start(id: string) {
  window[`ga-disable-${id}`] = false;
  if (window.gtag) return;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // gtag.js expects the arguments object itself.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", id, { send_page_view: false, anonymize_ip: true });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

/** Consent withdrawn: stop sending and drop the _ga cookies. */
function stop(id: string) {
  window[`ga-disable-${id}`] = true;
  const host = location.hostname.split(".").slice(-2).join(".");
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0].trim();
    if (!name.startsWith("_ga")) continue;
    for (const domain of ["", `; Domain=.${host}`, `; Domain=${location.hostname}`]) {
      document.cookie = `${name}=; Path=/; Max-Age=0${domain}`;
    }
  }
}

/** Google Analytics 4: only with GA4_ID set and after the visitor accepted all cookies. */
export function Analytics({ initialConsent }: { initialConsent: CookieConsent }) {
  const { ga4Id } = useRuntime();
  const consent = useConsent(initialConsent);
  const { pathname, search } = useLocation();
  const on = Boolean(ga4Id) && consent === "all";
  const wasOn = useRef(false);

  useEffect(() => {
    if (!ga4Id) return;
    if (on) start(ga4Id);
    else if (wasOn.current) stop(ga4Id);
    wasOn.current = on;
  }, [ga4Id, on]);

  useEffect(() => {
    if (!on || !window.gtag) return;
    window.gtag("event", "page_view", { page_path: pathname + search, page_location: location.href, page_title: document.title });
  }, [on, pathname, search]);

  return null;
}
