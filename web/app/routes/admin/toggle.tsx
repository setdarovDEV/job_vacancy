import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Ban, Undo2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog, useFailToast } from "./admin-ui";
import { invalidateAdmin } from "./keys";
import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";
import { toast } from "~/shared/ui/toast-store";

/**
 * Any admin action: on success the given lists and the overview counters refresh and a
 * toast says what happened (`done` may depend on the variables); failures toast the error.
 */
export function useAdminMutation<V, R>({ mutationFn, done, invalidate }: {
  mutationFn: (vars: V) => Promise<R>;
  done: string | ((vars: V) => string);
  invalidate: QueryKey[];
}) {
  const qc = useQueryClient();
  const fail = useFailToast();
  return useMutation({
    mutationFn,
    onSuccess: (_, vars) => {
      invalidateAdmin(qc, ...invalidate);
      toast({ tone: "success", title: typeof done === "string" ? done : done(vars) });
    },
    onError: fail,
  });
}

/**
 * A PUT-sets / DELETE-clears flag (verification, block): mutate(true) sets it, mutate(false)
 * clears it.
 */
export function useToggleResource<R>({ set, clear, done, invalidate }: {
  set: () => Promise<R>;
  clear: () => Promise<R>;
  done: { set: string; clear: string };
  invalidate: QueryKey[];
}) {
  return useAdminMutation({
    mutationFn: (on: boolean) => (on ? set() : clear()),
    done: (on) => (on ? done.set : done.clear),
    invalidate,
  });
}

/** Block (after a confirmation) or unblock, for anything with a blocked flag. */
export function BlockToggle({ blocked, disabled, pending, onToggle, confirmTitle, confirmBody }: {
  blocked: boolean;
  disabled?: boolean;
  pending: boolean;
  onToggle: (block: boolean) => Promise<unknown>;
  confirmTitle: string;
  confirmBody: string;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  if (blocked) {
    return (
      <Button variant="secondary" size="sm" icon={<Undo2 className="size-4" />} loading={pending} onClick={() => void onToggle(false).catch(() => {})}>
        {t("admin.unblock")}
      </Button>
    );
  }
  return (
    <>
      <Button variant="ghost" size="sm" className="text-anor-ink" icon={<Ban className="size-4" />} disabled={disabled} onClick={() => setConfirming(true)}>
        {t("admin.block")}
      </Button>
      <ConfirmDialog
        open={confirming}
        title={confirmTitle}
        body={confirmBody}
        confirmLabel={t("admin.block")}
        pending={pending}
        onConfirm={() => void onToggle(true).then(() => setConfirming(false), () => {})}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
