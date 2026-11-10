import { ShieldAlert, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";

import { errorText } from "~/shared/api/errors";
import { useSession } from "~/shared/auth/session";
import { TwoFactorEnroll } from "~/shared/account/two-factor/Enroll";
import { useTwoFactorStatus } from "~/shared/account/two-factor/Settings";
import { Skeleton } from "~/shared/ui/Skeleton";
import { useTranslation } from "~/shared/i18n/i18n";
import { ApiFailure } from "~/shared/query/query";
import { Button } from "~/shared/ui/Button";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { EmptyState } from "~/shared/ui/EmptyState";
import { Field, Textarea } from "~/shared/ui/Field";
import { toast } from "~/shared/ui/toast-store";

/** Shortest reason a rejection or takedown accepts (vacancy.MinRejectReason on the server). */
export const MIN_REASON_LENGTH = 5;

/** Admin pages: anyone else following a link gets an explanation instead of a 403 toast. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const isAdmin = user?.role === "admin";
  const twoFactor = useTwoFactorStatus(isAdmin);
  if (!isAdmin) return <EmptyState icon={<ShieldAlert className="size-6" />} title={t("admin.onlyAdmins")} />;
  if (twoFactor.isPending) return <Skeleton className="h-64 rounded-sheet" />;
  // The API refuses /admin to admins without 2FA (two_factor_setup_required); enroll here.
  if (twoFactor.data?.required && !twoFactor.data.enabled) {
    return (
      <div className="rounded-sheet border border-line bg-surface px-5 py-8 md:px-8">
        <h1 className="font-display text-xl font-semibold text-ink">{t("twoFactor.enrollTitle")}</h1>
        <p className="mt-2 max-w-prose text-ink-2">{t("twoFactor.enrollBody")} {t("twoFactor.intro")}</p>
        <div className="mt-6"><TwoFactorEnroll /></div>
      </div>
    );
  }
  return <>{children}</>;
}

/** Filters kept in the URL (shareable, survive reload); empty values are dropped. */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const [sp, setSp] = useSearchParams();
  const values = useMemo(
    () => Object.fromEntries(keys.map((k) => [k, sp.get(k) ?? ""])) as Record<K, string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sp],
  );
  const set = (k: K, v: string) => {
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v);
    else next.delete(k);
    setSp(next, { replace: true, preventScrollReset: true });
  };
  return { values, set };
}

/** Search box that commits on submit (one request per search, not per keystroke). */
export function SearchForm({ value, placeholder, onSearch }: { value: string; placeholder: string; onSearch: (q: string) => void }) {
  const { t } = useTranslation();
  return (
    <form
      role="search"
      className="flex gap-2"
      onSubmit={(e) => { e.preventDefault(); onSearch(String(new FormData(e.currentTarget).get("q") ?? "").trim()); }}
    >
      <label className="flex h-11 flex-1 items-center gap-3 rounded-control border border-line-strong bg-surface px-3.5 focus-within:border-lapis focus-within:shadow-[0_0_0_4px_var(--lapis-soft)]">
        <Search className="size-4.5 shrink-0 text-ink-3" aria-hidden="true" />
        <span className="sr-only">{placeholder}</span>
        <input key={value} name="q" type="search" defaultValue={value} placeholder={placeholder} className="h-full w-full bg-transparent text-ink outline-none placeholder:text-ink-3" />
      </label>
      <Button type="submit">{t("search.submit")}</Button>
    </form>
  );
}

/** Yes/no dialog for destructive admin actions. */
export function ConfirmDialog({
  open, title, body, confirmLabel, pending, onConfirm, onClose,
}: { open: boolean; title: string; body: string; confirmLabel: string; pending: boolean; onConfirm: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <DialogRoot open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={title}
        description={body}
        closeLabel={t("common.close")}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
            <Button variant="danger" loading={pending} onClick={onConfirm}>{confirmLabel}</Button>
          </>
        }
      />
    </DialogRoot>
  );
}

/**
 * A dialog that asks for a text before confirming (rejection reason, internal note).
 * With minLength the text is required; otherwise it may stay empty.
 */
export function NoteDialog({
  open, title, body, label, placeholder, minLength, confirmLabel, danger, pending, extra, onConfirm, onClose,
}: {
  open: boolean; title: string; body: string; label: string; placeholder?: string; minLength?: number;
  confirmLabel: string; danger?: boolean; pending: boolean; extra?: ReactNode;
  onConfirm: (text: string) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const tooShort = !!minLength && text.trim().length < minLength;
  return (
    <DialogRoot open={open} onOpenChange={(o) => { if (!o) { onClose(); setText(""); } }}>
      <DialogContent title={title} description={body} closeLabel={t("common.close")}>
        <form onSubmit={(e) => { e.preventDefault(); if (!tooShort) onConfirm(text.trim()); }} className="flex flex-col gap-5">
          <Field label={label} optional={minLength ? undefined : t("common.optional")}>
            <Textarea rows={3} maxLength={1000} minLength={minLength} required={!!minLength} value={text}
              onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
          </Field>
          {extra}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" variant={danger ? "danger" : "primary"} disabled={tooShort} loading={pending}>{confirmLabel}</Button>
          </div>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

/** Toast for a failed mutation, in the user's language. */
export function useFailToast() {
  const { t } = useTranslation();
  return (e: Error) => toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network") });
}
