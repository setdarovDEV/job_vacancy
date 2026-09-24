import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useTranslation } from "../i18n/i18n";
import { Button } from "./Button";
import { DialogContent, DialogRoot } from "./Dialog";

export type ConfirmTone = "danger" | "default";

export type ConfirmOptions = {
  title: ReactNode;
  body?: ReactNode;
  /** Default: t("overlay.confirm"). Prefer the verb itself ("Delete", "Withdraw"). */
  confirmLabel?: string;
  /** Default: t("common.cancel"). */
  cancelLabel?: string;
  /** "danger": anor confirm button, and Cancel gets the initial focus. */
  tone?: ConfirmTone;
};

export type ConfirmDialogProps = ConfirmOptions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Busy state owned by the caller (e.g. `mutation.isPending`) when onConfirm doesn't return a promise. */
  loading?: boolean;
  /**
   * Runs on confirm. Return a promise to keep the dialog open with a spinner until it settles: it
   * closes when the promise resolves and stays open (for a retry) when it rejects — report the
   * error yourself (toast). A plain function closes the dialog at once, unless `loading` is
   * passed: then the caller closes it (e.g. in the mutation's onSuccess).
   */
  onConfirm: () => void | Promise<unknown>;
};

const isThenable = (v: unknown): v is PromiseLike<unknown> =>
  typeof v === "object" && v !== null && typeof (v as PromiseLike<unknown>).then === "function";

/**
 * Confirmation for consequential actions (delete, withdraw, archive). An alertdialog: the
 * destructive tone focuses Cancel first so a stray Enter never destroys anything, and while
 * the action runs the dialog can't be dismissed. Focus returns to the trigger on close.
 */
export function ConfirmDialog({
  open, onOpenChange, title, body, confirmLabel, cancelLabel, tone = "default", loading, onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const busy = running || Boolean(loading);

  const run = () => {
    if (busy) return;
    const result: unknown = onConfirm();
    if (isThenable(result)) {
      setRunning(true);
      result.then(
        () => {
          setRunning(false);
          onOpenChange(false);
        },
        () => {
          setRunning(false);
          // The busy button lost focus when it was disabled: give it back for the retry.
          requestAnimationFrame(() => confirmRef.current?.focus());
        },
      );
    } else if (loading === undefined) {
      onOpenChange(false);
    }
  };

  return (
    <DialogRoot open={open} onOpenChange={(o) => (o || !busy) && onOpenChange(o)}>
      <DialogContent
        size="sm"
        role="alertdialog"
        title={title}
        description={body}
        closeLabel={t("common.close")}
        initialFocus={tone === "danger" ? cancelRef : confirmRef}
        dismissible={!busy}
        footer={
          <>
            <Button ref={cancelRef} variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
              {cancelLabel ?? t("common.cancel")}
            </Button>
            <Button ref={confirmRef} variant={tone === "danger" ? "danger" : "primary"} loading={busy} onClick={run}>
              {confirmLabel ?? t("overlay.confirm")}
            </Button>
          </>
        }
      />
    </DialogRoot>
  );
}

/**
 * Promise-based confirmation for event handlers:
 *   const { confirm, dialog } = useConfirm();
 *   if (await confirm({ title, body, tone: "danger", confirmLabel: t("common.delete") })) remove.mutate();
 *   …render {dialog} once in the component.
 * Resolves true on confirm, false on cancel, Escape, outside click or unmount.
 */
export function useConfirm() {
  const [request, setRequest] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    // Keep the options while closing, so the exit animation still shows the same text.
    setRequest((r) => (r ? { ...r, open: false } : r));
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false); // a newer question replaces an unanswered one
        resolver.current = resolve;
        setRequest({ ...options, open: true });
      }),
    [],
  );

  useEffect(() => () => resolver.current?.(false), []);

  const dialog = request ? (
    <ConfirmDialog
      {...request}
      onOpenChange={(o) => {
        if (!o) settle(false);
      }}
      onConfirm={() => settle(true)}
    />
  ) : null;

  return { confirm, dialog };
}
