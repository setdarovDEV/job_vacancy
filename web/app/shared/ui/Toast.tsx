import { useEffect, useReducer, useRef, useState, useSyncExternalStore, type ComponentType } from "react";

import { useTranslation } from "../i18n/i18n";
import { getToasts, subscribeToasts, type ToastItem } from "./toast-store";

export { dismissToast, toast } from "./toast-store";
export type { ToastAction, ToastItem, ToastOptions, ToastTone } from "./toast-store";

type ViewportProps = { items: ToastItem[]; closeLabel: string };

// The visual stack is its own small chunk: it loads when the page goes idle or with the first
// toast, never in the core bundle. A failed load (offline) is retried with the next toast.
let Viewport: ComponentType<ViewportProps> | null = null;
let loading: Promise<void> | null = null;
const load = () =>
  (loading ??= import("./ToastViewport").then(
    (m) => { Viewport = m.default; },
    () => { loading = null; },
  ));

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * Mount once (root). Screen readers hear every toast from the two live regions here, which exist
 * from the first paint and don't wait for the chunk: errors assertively, the rest politely.
 */
export function Toaster({ closeLabel }: { closeLabel?: string }) {
  const { t } = useTranslation();
  const items = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  const [, loaded] = useReducer((n: number) => n + 1, 0);
  const [said, setSaid] = useState<{ polite?: ToastItem; assertive?: ToastItem }>({});
  const seen = useRef(0);

  // Warm the chunk while idle, so the first toast shows at once, even if the network drops later.
  useEffect(() => {
    const w = window as IdleWindow;
    const go = () => void load().then(loaded);
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(go, { timeout: 5000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(go, 3000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (items.length && !Viewport) void load().then(loaded);
    const last = items.at(-1);
    if (!last || last.id <= seen.current) return;
    seen.current = last.id;
    setSaid((s) => (last.tone === "error" ? { ...s, assertive: last } : { ...s, polite: last }));
  }, [items]);

  const say = (i?: ToastItem) =>
    i && (
      <span key={i.id}>
        <span>{i.title}</span>
        {i.body && <span> {i.body}</span>}
        {i.action && <span> {t("overlay.toastAction", { action: i.action.label })}</span>}
      </span>
    );

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{say(said.polite)}</div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">{say(said.assertive)}</div>
      {Viewport && items.length > 0 && <Viewport items={items} closeLabel={closeLabel ?? t("common.close")} />}
    </>
  );
}
