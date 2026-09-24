import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, CircleCheck, Laptop, LogOut, Mail, Palette, Pencil, Phone, Send, ShieldCheck, Smartphone, Trash2, TriangleAlert, UserRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { MeterSkeleton, ProfileMeter, useAccountSummary } from "./layout";
import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { updateUser, useSession, withAuth } from "~/shared/auth/session";
import { CodeInput } from "~/shared/forms/CodeInput";
import { FormError } from "~/shared/forms/FormError";
import { PasswordInput } from "~/shared/forms/PasswordInput";
import { useSubmit } from "~/shared/forms/useSubmit";
import { localeNames, locales, type Locale } from "~/shared/i18n/config";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation, type TFunction } from "~/shared/i18n/i18n";
import { GlassControl, LanguageLinks, ThemeControl } from "~/shared/layout/Switchers";
import { useSignOut } from "~/shared/layout/UserArea";
import { cn } from "~/shared/lib/cn";
import { ApiFailure, authed } from "~/shared/query/query";
import { uploadFile, LIMITS } from "~/shared/upload/upload";
import { Badge } from "~/shared/ui/Badge";
import { Button, IconButton } from "~/shared/ui/Button";
import { Card, CardFooter } from "~/shared/ui/Card";
import { useConfirm } from "~/shared/ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "~/shared/ui/DataTable";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Field, Input } from "~/shared/ui/Field";
import { FileDropzone } from "~/shared/ui/FileDropzone";
import { PhoneInput } from "~/shared/ui/PhoneInput";
import { RelTime } from "~/shared/ui/RelTime";
import { PageHeader } from "~/shared/ui/Section";
import { Select } from "~/shared/ui/Select";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";
import { Switch } from "~/shared/ui/Toggle";

type User = Schemas["User"];
type Session = Schemas["Session"];

const failText = (t: TFunction, e: unknown) => (e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network"));

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useSession();
  if (!user) return null;
  const seeker = user.role !== "employer";
  return (
    <>
      <PageHeader title={t("account.settings")} description={t("accountPage.settingsHint")} />
      <div className="flex flex-col gap-6">
        {seeker && <MeterCard user={user} />}
        <SettingsCard id="profile" icon={<UserRound />} title={t("settings.profile")} description={t(seeker ? "settings.profileHint" : "accountPage.profileHintEmployer")}>
          <ProfileForm user={user} />
        </SettingsCard>
        <SettingsCard id="contacts" icon={<Mail />} title={t("settings.contacts")} description={t(seeker ? "settings.contactsHint" : "accountPage.contactsHintEmployer")}>
          <Contacts user={user} />
        </SettingsCard>
        <SettingsCard id="notifications" icon={<Bell />} title={t("account.notifications")} description={t("settings.notifyHint")}>
          <NotificationSettings />
        </SettingsCard>
        <SettingsCard id="appearance" icon={<Palette />} title={t("shell.appearance")} description={t("accountPage.appearanceHint")}>
          <Appearance />
        </SettingsCard>
        <SettingsCard id="security" icon={<ShieldCheck />} title={t("accountPage.security")} description={t("accountPage.securityHint")}>
          <PasswordForm hasPassword={user.has_password} />
          <Sessions />
        </SettingsCard>
        <SettingsCard id="danger" tone="anor" icon={<TriangleAlert />} title={t("accountPage.danger")} description={t("accountPage.dangerHint")}>
          <DangerZone />
        </SettingsCard>
      </div>
    </>
  );
}

/**
 * One settings block: icon tile + title/description, body aligned under the title from md.
 * scroll-mt clears the header and, below lg, the docked section strip (links like /me#contacts).
 */
function SettingsCard({ id, icon, title, description, tone = "lapis", children }: {
  id: string;
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  tone?: "lapis" | "anor";
  children: ReactNode;
}) {
  return (
    <Card as="section" id={id} aria-labelledby={`${id}-title`} className="scroll-mt-40 lg:scroll-mt-28">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-control [&_svg]:size-5",
            tone === "anor" ? "bg-anor-soft text-anor-ink" : "bg-lapis-soft text-lapis-ink",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 id={`${id}-title`} className="break-words text-lead font-semibold tracking-snug text-ink">{title}</h2>
          {description && <p className="mt-1 break-words text-md text-ink-2">{description}</p>}
        </div>
      </div>
      <div className="mt-6 min-w-0 md:pl-14">{children}</div>
    </Card>
  );
}

/**
 * Profile completeness where the sidebar meter isn't visible (below lg). Always the same size
 * (skeleton → meter, complete or not), so the cards below never jump when the counts arrive.
 */
function MeterCard({ user }: { user: User }) {
  const summary = useAccountSummary(true);
  const resumes = summary.data?.resumes;
  if (!summary.isPending && resumes == null) return null;
  return (
    <Card padding="sm" className="lg:hidden">
      {resumes == null ? <MeterSkeleton /> : <ProfileMeter user={user} resumes={resumes} />}
    </Card>
  );
}

/**
 * Inline "Saqlandi ✓" that fades after ~2s. The live region stays mounted; each save remounts
 * the text so screen readers hear it again.
 */
function useSavedFlash() {
  const { t } = useTranslation();
  const [n, setN] = useState(0);
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = useCallback(() => {
    setN((x) => x + 1);
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), 2200);
  }, []);
  const node = (
    <span role="status" className="mr-auto min-w-0">
      {n > 0 && (
        <span
          key={n}
          aria-hidden={!on}
          className={cn(
            "inline-flex items-center gap-1.5 text-sm font-medium text-firuza-ink transition-opacity duration-300",
            on ? "anim-fade" : "opacity-0",
          )}
        >
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          {t("common.saved")}
        </span>
      )}
    </span>
  );
  return [node, flash] as const;
}

/* ---- profile ------------------------------------------------------------------------------ */

function ProfileForm({ user }: { user: User }) {
  const { t } = useTranslation();
  const [name, setName] = useState(user.full_name);
  const [lang, setLang] = useState<Locale>(user.locale as Locale);
  const { pending, error, fields, run } = useSubmit();
  const [progress, setProgress] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saved, flash] = useSavedFlash();
  const dirty = name.trim() !== user.full_name || lang !== user.locale;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    void run(
      () => withAuth(() => api.PATCH("/me", { body: { full_name: name.trim(), locale: lang } })),
      (res) => {
        if (res.data?.data) updateUser(res.data.data);
        setName((n) => n.trim());
        flash();
      },
    );
  };

  const upload = async (file: File) => {
    setPhotoError(null);
    setProgress(0);
    try {
      const f = await uploadFile(file, "avatar", { onProgress: (p) => setProgress(Math.round(p * 100)) });
      updateUser(await authed<User>(() => api.PUT("/me/avatar", { body: { file_id: f.id } })));
      flash();
    } catch (e) {
      setPhotoError(e instanceof ApiFailure ? errorText(t, e.error) : t("settings.uploadFailed"));
    } finally {
      setProgress(null);
    }
  };

  const removePhoto = async () => {
    setPhotoError(null);
    try {
      updateUser(await authed<User>(() => api.PUT("/me/avatar", { body: { file_id: null } })));
      flash();
    } catch (e) {
      toast({ tone: "error", title: failText(t, e) });
    }
  };

  return (
    <form onSubmit={save}>
      <FileDropzone
        variant="avatar"
        accept="image/jpeg,image/png,image/webp"
        maxSize={LIMITS.avatar}
        onFiles={([f]) => void upload(f)}
        progress={progress}
        previewUrl={user.avatar_url}
        label={user.avatar_url ? t("settings.changePhoto") : t("settings.uploadPhoto")}
        error={photoError}
        onRemove={removePhoto}
        className="max-w-xl"
      />
      <FormError className="mt-5">{error}</FormError>
      <div className="mt-5 grid max-w-xl gap-4 sm:grid-cols-2">
        <Field label={t("auth.fullName")} error={fields.full_name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" enterKeyHint="done" />
        </Field>
        <Field label={t("settings.language")} hint={t("settings.languageHint")}>
          <Select value={lang} onValueChange={(v) => setLang(v as Locale)} options={locales.map((l) => ({ value: l, label: localeNames[l] }))} />
        </Field>
      </div>
      <CardFooter className="mt-6">
        {saved}
        <Button type="submit" loading={pending} disabled={!dirty}>{t("common.save")}</Button>
      </CardFooter>
    </form>
  );
}

/* ---- contacts ------------------------------------------------------------------------------ */

function ContactRow({ icon, label, children, action }: { icon: ReactNode; label: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4 first:pt-0 last:pb-0">
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-sunken text-ink-2 [&_svg]:size-4.5">{icon}</span>
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-sm text-ink-2">{label}</p>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2 text-md font-medium text-ink">{children}</div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:pl-14">{action}</div>}
    </div>
  );
}

function Contacts({ user }: { user: User }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col divide-y divide-line">
      <ContactRow
        icon={<Mail />}
        label={t("form.email")}
        action={user.email && !user.email_verified && (
          <Button asChild variant="secondary" size="sm">
            <LocalizedLink to={`/verify-email?email=${encodeURIComponent(user.email)}&next=/me`}>{t("settings.verify")}</LocalizedLink>
          </Button>
        )}
      >
        <span className="min-w-0 break-all">{user.email ?? "—"}</span>
        {user.email && (user.email_verified
          ? <Badge tone="firuza" icon={<CircleCheck />}>{t("common.verified")}</Badge>
          : <Badge tone="zafaron">{t("accountPage.notVerified")}</Badge>)}
      </ContactRow>
      <PhoneVerify user={user} />
    </div>
  );
}

/** Phone confirmation: the code arrives in Telegram's "Verification Codes" chat. */
function PhoneVerify({ user }: { user: User }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(!user.phone_verified);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const send = useSubmit();
  const verify = useSubmit();
  const [saved, flash] = useSavedFlash();

  const row = (
    <ContactRow
      icon={<Phone />}
      label={t("settings.phone")}
      action={!editing && (
        <Button type="button" variant="ghost" size="sm" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>{t("common.edit")}</Button>
      )}
    >
      <span className="num">{user.phone ?? "—"}</span>
      {user.phone && (user.phone_verified
        ? <Badge tone="firuza" icon={<CircleCheck />}>{t("common.verified")}</Badge>
        : <Badge tone="zafaron">{t("accountPage.notVerified")}</Badge>)}
      {!editing && saved}
    </ContactRow>
  );

  if (!editing) return row;

  return (
    <div className="flex gap-4 py-4 last:pb-0">
      <span aria-hidden="true" className="hidden size-10 shrink-0 place-items-center rounded-full bg-sunken text-ink-2 sm:grid"><Phone className="size-4.5" /></span>
      <div className="min-w-0 flex-1">
      {sentTo ? (
        <form
          className="flex max-w-md flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void verify.run(
              () => withAuth(() => api.POST("/auth/phone/verify", { body: { code } })),
              (res) => {
                if (res.data?.data) updateUser(res.data.data);
                setEditing(false);
                setSentTo(null);
                setCode("");
                flash();
              },
            );
          }}
        >
          <p className="text-md text-ink-2">{t("settings.phoneCodeSent", { phone: sentTo })}</p>
          <FormError>{verify.error}</FormError>
          <CodeInput value={code} onChange={setCode} label={t("auth.code")} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={verify.pending} disabled={code.length !== 6}>{t("auth.verifySubmit")}</Button>
            <Button type="button" variant="ghost" onClick={() => { setSentTo(null); setCode(""); }}>{t("common.back")}</Button>
          </div>
        </form>
      ) : (
        <form
          className="flex max-w-md flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send.run(
              () => withAuth(() => api.POST("/auth/phone/send-code", { body: { phone } })),
              (res) => setSentTo((res.data?.data?.phone as string | undefined) ?? phone),
            );
          }}
        >
          <Field label={t("settings.phone")} hint={t("settings.phoneHint")} error={send.fields.phone ?? send.error ?? undefined}>
            <PhoneInput value={phone} onChange={setPhone} required />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary" icon={<Send className="size-4" />} loading={send.pending} disabled={phone.length !== 13}>
              {t("settings.sendTelegramCode")}
            </Button>
            {user.phone_verified && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>}
          </div>
        </form>
      )}
      </div>
    </div>
  );
}

/* ---- notifications ------------------------------------------------------------------------- */

type NotifySettings = { email: boolean; telegram: boolean; telegram_linked: boolean; telegram_bot: string };
const NOTIFY_KEY = ["notification-settings"];

function NotificationSettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [waiting, setWaiting] = useState(false);
  const [saved, flash] = useSavedFlash();
  const q = useQuery({
    queryKey: NOTIFY_KEY,
    queryFn: () => authed<NotifySettings>(() => api.GET("/me/notification-settings")),
    // While the user is in Telegram pressing Start, poll until the link shows up.
    refetchInterval: waiting ? 2500 : false,
  });
  const loading = useSkeletonHold(q.isPending);
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
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: NOTIFY_KEY });
      const prev = qc.getQueryData<NotifySettings>(NOTIFY_KEY);
      qc.setQueryData<NotifySettings>(NOTIFY_KEY, (d) => (d ? { ...d, ...body } : d));
      return { prev };
    },
    onError: (e, _b, ctx) => {
      if (ctx?.prev) qc.setQueryData(NOTIFY_KEY, ctx.prev);
      toast({ tone: "error", title: failText(t, e) });
    },
    onSuccess: () => flash(),
    onSettled: () => qc.invalidateQueries({ queryKey: NOTIFY_KEY }),
  });

  const unlink = useMutation({
    mutationFn: () => authed(() => api.DELETE("/me/telegram")),
    onError: (e) => toast({ tone: "error", title: failText(t, e) }),
    onSuccess: () => flash(),
    onSettled: () => qc.invalidateQueries({ queryKey: NOTIFY_KEY }),
  });

  const link = async () => {
    // Open the tab synchronously (popup blockers), then point it at the deep link.
    const win = window.open("", "_blank");
    try {
      const r = await authed<{ url: string }>(() => api.POST("/me/telegram/link"));
      if (win) win.location.href = r.url;
      else location.href = r.url;
      setWaiting(true);
    } catch (e) {
      win?.close();
      toast({ tone: "error", title: failText(t, e) });
    }
  };

  if (loading) {
    return (
      // Mirrors the loaded block: two switch rows and the footer with the Telegram button.
      <SkeletonDelay className="max-w-xl">
        <div className="flex flex-col divide-y divide-line">
          {[0, 1].map((i) => (
            <div key={i} className={i ? "pt-2" : "pb-2"}>
              <div className="flex min-h-11 items-center gap-4 py-1.5">
                <div className="flex flex-1 flex-col gap-1.5"><Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-3/5" /></div>
                <Skeleton className="h-6 w-10" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end border-t border-line pt-4"><Skeleton className="h-11 w-44 rounded-control" /></div>
      </SkeletonDelay>
    );
  }
  if (q.isError) return <ErrorState compact error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data!;
  return (
    <div className="max-w-xl">
      <div className="flex flex-col divide-y divide-line">
        <div className="pb-2">
          <Switch checked={s.email} onCheckedChange={(v) => save.mutate({ email: v })} label={t("settings.byEmail")} description={t("settings.byEmailHint")} />
        </div>
        <div className="pt-2">
          <Switch
            checked={s.telegram && s.telegram_linked}
            disabled={!s.telegram_linked}
            onCheckedChange={(v) => save.mutate({ telegram: v })}
            label={t("settings.byTelegram")}
            description={s.telegram_linked ? t("settings.telegramOn", { bot: `@${s.telegram_bot}` }) : t("settings.telegramOff")}
          />
        </div>
      </div>
      <CardFooter className="mt-4">
        {saved}
        {s.telegram_linked ? (
          <Button variant="ghost" loading={unlink.isPending} onClick={() => unlink.mutate()}>{t("settings.telegramUnlink")}</Button>
        ) : (
          <Button variant="secondary" icon={<Send className="size-4" />} loading={waiting} onClick={link}>
            {waiting ? t("settings.telegramWaiting") : t("settings.telegramLink")}
          </Button>
        )}
      </CardFooter>
    </div>
  );
}

/* ---- appearance ------------------------------------------------------------------------------ */

function Appearance() {
  const { t } = useTranslation();
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h3 className="mb-2 text-md font-medium text-ink">{t("accountPage.interfaceLanguage")}</h3>
        <LanguageLinks />
      </div>
      {/* Phones get the compact controls (full labels fit 360px); only one of each pair is displayed. */}
      <div>
        <h3 className="mb-2 text-md font-medium text-ink">{t("theme.label")}</h3>
        <ThemeControl compact className="sm:hidden" />
        <ThemeControl className="max-sm:hidden" />
      </div>
      <div>
        <h3 className="mb-2 text-md font-medium text-ink">{t("shell.glass.label")}</h3>
        <GlassControl compact className="sm:hidden" />
        <GlassControl className="max-sm:hidden" />
      </div>
    </div>
  );
}

/* ---- security ------------------------------------------------------------------------------ */

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const { t } = useTranslation();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const { pending, error, fields, run } = useSubmit();
  const qc = useQueryClient();
  const [saved, flash] = useSavedFlash();
  return (
    <form
      aria-labelledby="password-title"
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          () => withAuth(() => api.PUT("/me/password", { body: { current_password: hasPassword ? cur : undefined, new_password: next } })),
          () => {
            setCur("");
            setNext("");
            // Changing the password signs every other device out.
            void qc.invalidateQueries({ queryKey: ["sessions"] });
            updateHasPassword();
            flash();
          },
        );
      }}
    >
      <h3 id="password-title" className="text-md font-semibold text-ink">{t("settings.password")}</h3>
      <p className="mt-1 text-sm text-ink-2">{hasPassword ? t("settings.passwordHint") : t("settings.passwordNone")}</p>
      <FormError className="mt-4">{error}</FormError>
      <div className="mt-4 grid max-w-xl gap-4">
        {hasPassword && (
          <Field label={t("settings.currentPassword")} error={fields.current_password}>
            <PasswordInput value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />
          </Field>
        )}
        <Field label={t("auth.newPassword")} hint={t("auth.passwordHint")} error={fields.new_password}>
          <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required minLength={8} strength />
        </Field>
      </div>
      <CardFooter className="mt-5">
        {saved}
        <Button type="submit" variant="secondary" loading={pending} disabled={!next || (hasPassword && !cur)}>{t("settings.changePassword")}</Button>
      </CardFooter>
    </form>
  );
}

// Google-only accounts that just set a password now have one: refresh the session user so the
// form asks for the current password next time.
function updateHasPassword() {
  void authed<User>(() => api.GET("/me")).then(updateUser, () => undefined);
}

function deviceName(ua: string, platform: string) {
  if (platform === "android") return "Android";
  if (platform === "ios") return "iPhone";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /YaBrowser/.test(ua) ? "Yandex" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : ua.split(/[\s/]/)[0] || "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser}, ${os}` : browser;
}

const SESSIONS_KEY = ["sessions"];
const SHOWN = 5;
// Column ids (not translation keys).
const COL = { device: "device", ip: "ip", used: "used", actions: "actions" } as const;

function Sessions() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const signOut = useSignOut();
  const q = useQuery({ queryKey: SESSIONS_KEY, queryFn: () => authed<Session[]>(() => api.GET("/me/sessions")) });
  const loading = useSkeletonHold(q.isPending);
  const [all, setAll] = useState(false);

  // Optimistic: the rows disappear at once and come back if the server refuses.
  const revoke = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => authed(() => api.DELETE("/me/sessions/{id}", { params: { path: { id } } })))),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: SESSIONS_KEY });
      const prev = qc.getQueryData<Session[]>(SESSIONS_KEY);
      qc.setQueryData<Session[]>(SESSIONS_KEY, (l) => l?.filter((s) => !ids.includes(s.id)));
      return { prev };
    },
    onError: (e, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(SESSIONS_KEY, ctx.prev);
      toast({ tone: "error", title: failText(t, e) });
    },
    onSuccess: (_r, ids) => toast({ tone: "success", title: t("accountPage.signedOutDevices", { count: ids.length }) }),
    onSettled: () => qc.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });

  const everywhere = async () => {
    const ok = await confirm({
      title: t("accountPage.logoutAllTitle"),
      body: t("accountPage.logoutAllBody"),
      confirmLabel: t("accountPage.logoutAll"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await authed(() => api.POST("/auth/logout-all"));
      await signOut();
    } catch (e) {
      toast({ tone: "error", title: failText(t, e) });
    }
  };

  const device = (s: Session) => {
    const Icon = s.platform === "web" ? Laptop : Smartphone;
    return (
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-ink-2"><Icon className="size-4.5" /></span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-md font-medium text-ink">
            <span className="min-w-0 break-words">{deviceName(s.user_agent, s.platform)}</span>
            {s.current && <Badge tone="lapis">{t("settings.thisDevice")}</Badge>}
          </p>
        </div>
      </div>
    );
  };
  const revokeButton = (s: Session) =>
    !s.current && (
      <IconButton label={t("settings.signOutDevice")} size="sm" className="text-ink-2 hover:text-anor-ink" onClick={() => revoke.mutate([s.id])}>
        <LogOut className="size-4" />
      </IconButton>
    );

  const columns: DataTableColumn<Session>[] = [
    { key: COL.device, header: t("accountPage.device"), cell: device },
    { key: COL.ip, header: t("accountPage.ip"), cell: (s) => <span className="num text-ink-2">{s.ip ?? "—"}</span>, className: "whitespace-nowrap" },
    { key: COL.used, header: t("accountPage.lastActive"), cell: (s) => <RelTime iso={s.last_used_at} className="text-ink-2" />, className: "whitespace-nowrap" },
    { key: COL.actions, header: <span className="sr-only">{t("accountPage.actions")}</span>, align: "end", cell: revokeButton, className: "w-14" },
  ];

  const others = q.data?.filter((s) => !s.current) ?? [];
  // This device first, then the most recently used; long lists fold after SHOWN rows.
  const sorted = q.data ? [...q.data.filter((s) => s.current), ...others] : [];
  const rows = all ? sorted : sorted.slice(0, SHOWN);
  const hidden = sorted.length - rows.length;

  return (
    <section aria-labelledby="sessions-title" className="mt-8 border-t border-line pt-6">
      <h3 id="sessions-title" className="text-md font-semibold text-ink">{t("settings.sessions")}</h3>
      <p className="mt-1 text-sm text-ink-2">{t("settings.sessionsHint")}</p>
      <div className="mt-4">
        {q.isError ? (
          <ErrorState compact error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <DataTable
            rows={loading ? [] : rows}
            rowKey={(s) => s.id}
            columns={columns}
            loading={loading}
            caption={t("settings.sessions")}
            mobileCard={(s) => (
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {device(s)}
                  <p className="mt-1.5 flex flex-wrap gap-x-1.5 pl-12 text-sm text-ink-2">
                    <span className="num whitespace-nowrap">{s.ip ?? "—"}</span>
                    <span aria-hidden="true">·</span>
                    <RelTime iso={s.last_used_at} className="whitespace-nowrap" />
                  </p>
                </div>
                {revokeButton(s)}
              </div>
            )}
          />
        )}
      </div>
      {hidden > 0 && (
        <Button variant="ghost" size="sm" className="-ml-3 mt-2" onClick={() => setAll(true)}>
          {t("accountPage.moreDevices", { count: hidden })}
        </Button>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {others.length > 1 && (
          <Button variant="secondary" loading={revoke.isPending && (revoke.variables?.length ?? 0) > 1} onClick={() => revoke.mutate(others.map((s) => s.id))}>
            {t("settings.signOutOthers")}
          </Button>
        )}
        <Button variant="ghost" icon={<LogOut className="size-4" />} className="text-anor-ink hover:bg-anor-soft hover:text-anor-ink" onClick={everywhere}>
          {t("accountPage.logoutAll")}
        </Button>
      </div>
      {dialog}
    </section>
  );
}

/* ---- danger zone ------------------------------------------------------------------------------ */

// Account deletion has no API yet: the action is shown, disabled, with an honest way forward.
function DangerZone() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-md font-medium text-ink">{t("accountPage.deleteAccount")}</p>
        <p id="delete-account-hint" className="mt-1 text-sm text-ink-2">{t("accountPage.deleteSoon")}</p>
        <LocalizedLink to="/contacts" className="mt-1 inline-flex min-h-9 items-center text-sm font-medium text-lapis-ink underline underline-offset-3 pointer-coarse:min-h-11">
          {t("accountPage.contactSupport")}
        </LocalizedLink>
      </div>
      <Button variant="danger" icon={<Trash2 className="size-4" />} disabled aria-describedby="delete-account-hint" className="max-sm:w-full">
        {t("accountPage.deleteAccount")}
      </Button>
    </div>
  );
}
