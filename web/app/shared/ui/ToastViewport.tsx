import { AnimatePresence, m } from "motion/react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

import { Motion } from "../motion/Motion";
import { dismissToast, type ToastItem } from "./toast-store";

export default function ToastViewport({ items, closeLabel }: { items: ToastItem[]; closeLabel: string }) {
  return (
    <Motion>
    <AnimatePresence initial={false}>
      {items.map((t) => (
        <m.div
          key={t.id}
          layout
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          role={t.tone === "error" ? "alert" : "status"}
          className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-panel border border-line bg-surface p-4 shadow-pop"
        >
          {t.tone === "error" ? (
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-anor" />
          ) : (
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-firuza" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{t.title}</p>
            {t.body && <p className="mt-0.5 text-sm text-ink-2">{t.body}</p>}
          </div>
          <button onClick={() => dismissToast(t.id)} aria-label={closeLabel} className="-m-1 grid size-7 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink">
            <X className="size-4" />
          </button>
        </m.div>
      ))}
    </AnimatePresence>
    </Motion>
  );
}
