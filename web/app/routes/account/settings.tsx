import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Camera, Laptop, Send, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { updateUser, useSession, withAuth } from "~/shared/auth/session";
import { CodeInput } from "~/shared/forms/CodeInput";
import { FormError } from "~/shared/forms/FormError";
import { PasswordInput } from "~/shared/forms/PasswordInput";
import { useSubmit } from "~/shared/forms/useSubmit";
import { localeNames, locales, type Locale } from "~/shared/i18n/config";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { relativeTime } from "~/shared/lib/format";
import { ApiFailure, authed } from "~/shared/query/query";
import { uploadFile, LIMITS } from "~/shared/upload/upload";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Field, Input } from "~/shared/ui/Field";
import { PageHeader, Section } from "~/shared/ui/Section";
import { Select } from "~/shared/ui/Select";
import { Skeleton } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";
import { Switch } from "~/shared/ui/Toggle";

type User = Schemas["User"];

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useSession();
  if (!user) return null;
  return (
    <>
      <PageHeader title={t("account.settings")} />
      <div className="rounded-sheet border border-line bg-surface px-5 py-8 md:px-8">
        <Section title={t("settings.profile")} description={t("settings.profileHint")}>
          <ProfileForm user={user} />
        </Section>
        <Section title={t("settings.contacts")} description={t("settings.contactsHint")}>
          <Contacts user={user} />
        </Section>
        <Section id="notifications" title={t("account.notifications")} description={t("settings.notifyHint")}>
          <NotificationSettings />
        </Section>
        <Section title={t("settings.password")} description={user.has_password ? t("settings.passwordHint") : t("settings.passwordNone")}>
          <PasswordForm hasPassword={user.has_password} />
        </Section>
        <Section title={t("settings.sessions")} description={t("settings.sessionsHint")}>
          <Sessions />
        </Section>
      </div>
    </>
  );
}

function ProfileForm({ user }: { user: User }) {
  const { t } = useTranslation();
  const [name, setName] = useState(user.full_name);
  const [lang, setLang] = useState<Locale>(user.locale as Locale);
  const { pending, error, fields, run } = useSubmit();
  const [uploading, setUploading] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    void run(
      () => withAuth(() => api.PATCH("/me", { body: { full_name: name.trim(), locale: lang } })),
      (res) => {
        if (res.data?.data) updateUser(res.data.data);
        toast({ tone: "success", title: t("common.saved") });
      },
    );
  };

  const pick = async (file: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast({ tone: "error", title: t("validation.not_allowed") });
    if (file.size > LIMITS.avatar) return toast({ tone: "error", title: t("validation.too_large") });
    setUploading(0);
    try {
      const f = await uploadFile(file, "avatar", { onProgress: setUploading });
      const u = await authed<User>(() => api.PUT("/me/avatar", { body: { file_id: f.id } }));
      updateUser(u);
    } catch (e) {
      toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("settings.uploadFailed") });
    } finally {
      setUploading(null);
    }
  };

  const removeAvatar = async () => {
    const u = await authed<User>(() => api.PUT("/me/avatar", { body: { file_id: null } })).catch(() => null);
    if (u) updateUser(u);
  };

  return (
    <form onSubmit={save} className="flex max-w-md flex-col gap-5">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar name={user.full_name} src={user.avatar_url} size="xl" />
          {uploading !== null && (
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <circle cx="18" cy="18" r="17" fill="none" stroke="var(--lapis)" strokeWidth="2" strokeDasharray={`${uploading * 106.8} 106.8`} />
            </svg>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />
          <Button type="button" variant="secondary" size="sm" icon={<Camera className="size-4" />} loading={uploading !== null} onClick={() => fileRef.current?.click()}>
            {user.avatar_url ? t("settings.changePhoto") : t("settings.uploadPhoto")}
          </Button>
          {user.avatar_url && (
            <Button type="button" variant="ghost" size="sm" onClick={removeAvatar}>{t("common.delete")}</Button>
          )}
        </div>
      </div>
      <FormError>{error}</FormError>
      <Field label={t("auth.fullName")} error={fields.full_name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" />
      </Field>
      <Field label={t("settings.language")} hint={t("settings.languageHint")}>
        <Select value={lang} onValueChange={(v) => setLang(v as Locale)} options={locales.map((l) => ({ value: l, label: localeNames[l] }))} />
      </Field>
      <div>
        <Button type="submit" loading={pending}>{t("common.save")}</Button>
      </div>
    </form>
  );
}

function Contacts({ user }: { user: User }) {
  const { t } = useTranslation();
  return (
    <div className="flex max-w-md flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-ink">{t("form.email")}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-ink-2">{user.email ?? "—"}</span>
          {user.email && (user.email_verified
            ? <Badge tone="firuza"><BadgeCheck className="size-3.5" />{t("common.verified")}</Badge>
            : <LocalizedLink to={`/verify-email?email=${encodeURIComponent(user.email)}&next=/me`} className="text-sm font-medium text-lapis-ink hover:underline">{t("settings.verify")}</LocalizedLink>)}
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
        <p className="text-sm text-ink-2">{t("settings.phoneCodeSent", { phone: sentTo })}</p>
        <FormError>{verify.error}</FormError>
        <CodeInput value={code} onChange={setCode} label={t("auth.code")} />
        <div className="flex gap-2">
          <Button type="submit" loading={verify.pending} disabled={code.length !== 6}>{t("auth.verifySubmit")}</Button>
          <Button type="button" variant="ghost" onClick={() => { setSentTo(null); setCode(""); }}>{t("common.back")}</Button>
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
          (res) => setSentTo((res.data?.data?.phone as string | undefined) ?? phone),
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

type NotifySettings = { email: boolean; telegram: boolean; telegram_linked: boolean; telegram_bot: string };

function NotificationSettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [waiting, setWaiting] = useState(false);
  const q = useQuery({
    queryKey: ["notification-settings"],
    queryFn: () => authed<NotifySettings>(() => api.GET("/me/notification-settings")),
    // While the user is in Telegram pressing Start, poll until the link shows up.
    refetchInterval: waiting ? 2500 : false,
  });
  useEffect(() => {
    if (waiting && q.data?.telegram_linked) {
      setWaiting(false);
      toast({ tone: "success", title: t("settings.telegramLinked") });
    }
  }, [waiting, q.data?.telegram_linked, t]);
  useEffect(() => {
    if (!waiting) return;
    const stop = setTimeout(() => setWaiting(false), 3 * 60_000);
    return () => clearTimeout(stop);
  }, [waiting]);

  const save = useMutation({
    mutationFn: (body: Partial<Pick<NotifySettings, "email" | "telegram">>) => authed<NotifySettings>(() => api.PUT("/me/notification-settings", { body })),
    onMutate: (body) => qc.setQueryData<NotifySettings>(["notification-settings"], (d) => (d ? { ...d, ...body } : d)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notification-settings"] }),
  });

  const link = async () => {
    // Open the tab synchronously (popup blockers), then point it at the deep link.
    const win = window.open("", "_blank");
    try {
      const r = await authed<{ url: string }>(() => api.POST("/me/telegram/link"));
      if (win) win.location.href = r.url;
      else location.href = r.url;
      setWaiting(true);
    } catch {
      win?.close();
      toast({ tone: "error", title: t("errors.internal_error") });
    }
  };
  const unlink = async () => {
    await authed(() => api.DELETE("/me/telegram")).catch(() => null);
    void qc.invalidateQueries({ queryKey: ["notification-settings"] });
  };

  if (!q.data) return <div className="flex max-w-md flex-col gap-4"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>;
  const s = q.data;
  return (
    <div className="flex max-w-md flex-col gap-5">
      <Switch checked={s.email} onCheckedChange={(v) => save.mutate({ email: v })} label={t("settings.byEmail")} description={t("settings.byEmailHint")} />
      <Switch
        checked={s.telegram && s.telegram_linked}
        disabled={!s.telegram_linked}
        onCheckedChange={(v) => save.mutate({ telegram: v })}
        label={t("settings.byTelegram")}
        description={s.telegram_linked ? t("settings.telegramOn", { bot: `@${s.telegram_bot}` }) : t("settings.telegramOff")}
      />
      <div>
        {s.telegram_linked ? (
          <Button variant="ghost" size="sm" className="-ml-3" onClick={unlink}>{t("settings.telegramUnlink")}</Button>
        ) : (
          <Button variant="secondary" icon={<Send className="size-4" />} loading={waiting} onClick={link}>
            {waiting ? t("settings.telegramWaiting") : t("settings.telegramLink")}
          </Button>
        )}
      </div>
    </div>
  );
}

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const { t } = useTranslation();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const { pending, error, fields, run } = useSubmit();
  const qc = useQueryClient();
  return (
    <form
      className="flex max-w-md flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          () => withAuth(() => api.PUT("/me/password", { body: { current_password: hasPassword ? cur : undefined, new_password: next } })),
          () => {
            setCur("");
            setNext("");
            void qc.invalidateQueries({ queryKey: ["sessions"] });
            toast({ tone: "success", title: t("settings.passwordChanged") });
          },
        );
      }}
    >
      <FormError>{error}</FormError>
      {hasPassword && (
        <Field label={t("settings.currentPassword")} error={fields.current_password}>
          <PasswordInput value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />
        </Field>
      )}
      <Field label={t("auth.newPassword")} hint={t("auth.passwordHint")} error={fields.new_password}>
        <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required minLength={8} />
      </Field>
      <div>
        <Button type="submit" variant="secondary" loading={pending}>{t("settings.changePassword")}</Button>
      </div>
    </form>
  );
}

function deviceName(ua: string, platform: string) {
  if (platform === "android") return "Android";
  if (platform === "ios") return "iPhone";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /YaBrowser/.test(ua) ? "Yandex" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : ua.split(/[\s/]/)[0] || "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser}, ${os}` : browser;
}

function Sessions() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sessions"], queryFn: () => authed<Schemas["Session"][]>(() => api.GET("/me/sessions")) });
  const revoke = useMutation({
    mutationFn: (id: string) => authed(() => api.DELETE("/me/sessions/{id}", { params: { path: { id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
  if (!q.data) return <div className="flex flex-col gap-3"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>;
  const others = q.data.filter((s) => !s.current);
  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-line rounded-panel border border-line">
        {q.data.map((s) => {
          const Icon = s.platform === "web" ? Laptop : Smartphone;
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Icon className="size-5 shrink-0 text-ink-3" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {deviceName(s.user_agent, s.platform)}
                  {s.current && <Badge tone="lapis" className="ml-2 h-5">{t("settings.thisDevice")}</Badge>}
                </p>
                <p className="num truncate text-xs text-ink-3">{[s.ip, relativeTime(s.last_used_at, t)].filter(Boolean).join(", ")}</p>
              </div>
              {!s.current && (
                <button
                  type="button"
                  aria-label={t("settings.signOutDevice")}
                  title={t("settings.signOutDevice")}
                  onClick={() => revoke.mutate(s.id)}
                  className="grid size-9 place-items-center rounded-control text-ink-3 hover:bg-sunken hover:text-anor-ink"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {others.length > 1 && (
        <div>
          <Button variant="ghost" size="sm" className="-ml-3" onClick={() => others.forEach((s) => revoke.mutate(s.id))}>
            {t("settings.signOutOthers")}
          </Button>
        </div>
      )}
    </div>
  );
}
