import { BadgeCheck, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { api, type Schemas } from "~/shared/api/client";
import { updateUser, useSession, withAuth } from "~/shared/auth/session";
import { CodeInput } from "~/shared/forms/CodeInput";
import { FormError } from "~/shared/forms/FormError";
import { useSubmit } from "~/shared/forms/useSubmit";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Field, Input } from "~/shared/ui/Field";
import { toast } from "~/shared/ui/toast-store";

type User = Schemas["User"];

/** True while the signed-in user has neither a confirmed email nor a confirmed phone. */
export function useNeedsVerification(): boolean {
  const { user } = useSession();
  return !!user && !user.email_verified && !user.phone_verified;
}

/**
 * Shown in place of (or above) an action the API refuses with `verification_required`:
 * says why, and lets the user confirm a contact right there. It disappears by itself once
 * the session reports a confirmed contact.
 */
export function VerifyContactCard({ reason, className }: { reason: string; className?: string }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const needs = useNeedsVerification();
  if (!user || !needs) return null;
  const here = typeof location === "undefined" ? "/me" : location.pathname + location.search;
  return (
    <section
      aria-labelledby="verify-contact-title"
      className={"rounded-panel border border-zafaron/40 bg-zafaron-soft/60 p-5 " + (className ?? "")}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-zafaron-soft text-zafaron-ink">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="verify-contact-title" className="font-display text-base font-semibold text-ink">{t("verifyGate.title")}</h2>
          <p className="mt-1 text-sm text-ink-2">{reason}</p>
        </div>
      </div>
      <div className="mt-5 sm:pl-13">
        <ContactVerification user={user} next={here} />
      </div>
    </section>
  );
}

/**
 * Email and phone confirmation. Creating a company, publishing a vacancy and applying all
 * need one confirmed contact, so this lives here and is reused wherever that's required.
 * `next` is where the email-code page returns to.
 */
export function ContactVerification({ user, next = "/me" }: { user: User; next?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex max-w-md flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-ink">{t("form.email")}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-ink-2">{user.email ?? "—"}</span>
          {user.email && (user.email_verified
            ? <Badge tone="firuza"><BadgeCheck className="size-3.5" />{t("common.verified")}</Badge>
            : <LocalizedLink to={`/verify-email?email=${encodeURIComponent(user.email)}&next=${encodeURIComponent(next)}`} className="text-sm font-medium text-lapis-ink hover:underline">{t("settings.verify")}</LocalizedLink>)}
        </div>
      </div>
      <PhoneVerify user={user} />
    </div>
  );
}

/** Phone confirmation: the code arrives in Telegram's "Verification Codes" chat. */
function PhoneVerify({ user }: { user: User }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(!user.phone_verified);
  const [phone, setPhone] = useState(user.phone ?? "+998 ");
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Test mode (no Telegram gateway): the API hands the code back instead of sending it.
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const send = useSubmit();
  const verify = useSubmit();

  if (!editing) {
    return (
      <div>
        <p className="text-sm font-medium text-ink">{t("settings.phone")}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="num text-ink-2">{user.phone}</span>
          <Badge tone="firuza"><BadgeCheck className="size-3.5" />{t("common.verified")}</Badge>
          <button type="button" className="text-sm font-medium text-lapis-ink hover:underline" onClick={() => setEditing(true)}>{t("common.edit")}</button>
        </div>
      </div>
    );
  }

  if (sentTo) {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void verify.run(
            () => withAuth(() => api.POST("/auth/phone/verify", { body: { code } })),
            (res) => {
              if (res.data?.data) updateUser(res.data.data);
              setEditing(false);
              setSentTo(null);
              toast({ tone: "success", title: t("settings.phoneVerified") });
            },
          );
        }}
      >
        {devCode ? (
          <p className="rounded-control border border-dashed border-zafaron/60 bg-zafaron-soft/60 px-3.5 py-2.5 text-sm text-ink-2">
            {t("settings.devCode")} <span className="num font-display font-semibold tracking-[0.2em] text-ink">{devCode}</span>
          </p>
        ) : (
          <p className="text-sm text-ink-2">{t("settings.phoneCodeSent", { phone: sentTo })}</p>
        )}
        <FormError>{verify.error}</FormError>
        <CodeInput value={code} onChange={setCode} label={t("auth.code")} />
        <div className="flex gap-2">
          <Button type="submit" loading={verify.pending} disabled={code.length !== 6}>{t("auth.verifySubmit")}</Button>
          <Button type="button" variant="ghost" onClick={() => { setSentTo(null); setDevCode(null); setCode(""); }}>{t("common.back")}</Button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send.run(
          () => withAuth(() => api.POST("/auth/phone/send-code", { body: { phone } })),
          (res) => {
            const d = res.data?.data;
            setSentTo(d?.phone ?? phone);
            setDevCode(d?.dev_code ?? null);
            if (d?.dev_code) setCode(d.dev_code);
          },
        );
      }}
    >
      <Field label={t("settings.phone")} hint={t("settings.phoneHint")} error={send.fields.phone ?? send.error ?? undefined}>
        <Input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="num" />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="secondary" icon={<Send className="size-4" />} loading={send.pending}>{t("settings.sendTelegramCode")}</Button>
        {user.phone_verified && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>}
      </div>
    </form>
  );
}
