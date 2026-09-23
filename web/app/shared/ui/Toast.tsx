import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";

import { getToasts, subscribeToasts } from "./toast-store";

export { toast } from "./toast-store";

// The animated viewport (and Motion with it) loads only once the first toast appears.
const Viewport = lazy(() => import("./ToastViewport"));

export function Toaster({ closeLabel }: { closeLabel: string }) {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  const [used, setUsed] = useState(false);
  useEffect(() => {
    if (items.length > 0) setUsed(true);
  }, [items.length]);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:left-auto md:right-6 md:items-end"
    >
      {(used || items.length > 0) && (
        <Suspense fallback={null}>
          <Viewport items={items} closeLabel={closeLabel} />
        </Suspense>
      )}
    </div>
  );
}
