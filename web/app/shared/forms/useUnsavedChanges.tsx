import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useBlocker, type BlockerFunction } from "react-router";

import { useTranslation } from "../i18n/i18n";
import { Button } from "../ui/Button";
import { DialogContent, DialogRoot } from "../ui/Dialog";

/**
 * Guards a long editor (resume, vacancy, company) while it has unsaved changes: in-app
 * navigation asks first in a dialog, closing or reloading the tab gets the browser's prompt.
 * Render the returned element once inside the editor. To leave on purpose right after a save,
 * clear `dirty` first or navigate with `state: { allowLeave: true }`.
 */
export function useUnsavedChanges(dirty: boolean): ReactNode {
  const { t } = useTranslation();
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      // Same editor with other query params (tabs, steps) isn't leaving.
      currentLocation.pathname !== nextLocation.pathname &&
      !(nextLocation.state as { allowLeave?: boolean } | null)?.allowLeave,
    [dirty],
  );
  const blocker = useBlocker(shouldBlock);
  const stay = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // older Chrome / Safari still need it for the prompt
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Saved (or undone) while the dialog was up: nothing to lose any more, let the navigation through.
  useEffect(() => {
    if (blocker.state === "blocked" && !dirty) blocker.proceed();
  }, [blocker, dirty]);

  return (
    <DialogRoot
      open={blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open && blocker.state === "blocked") blocker.reset();
      }}
    >
      <DialogContent
        size="sm"
        role="alertdialog"
        // The safe choice takes focus first: Enter must never throw work away.
        initialFocus={stay}
        title={t("inputs.unsavedTitle")}
        description={t("inputs.unsavedBody")}
        closeLabel={t("common.close")}
        footer={
          <>
            <Button ref={stay} variant="secondary" onClick={() => blocker.reset?.()}>
              {t("inputs.stay")}
            </Button>
            <Button variant="danger" onClick={() => blocker.proceed?.()}>
              {t("inputs.leave")}
            </Button>
          </>
        }
      />
    </DialogRoot>
  );
}
