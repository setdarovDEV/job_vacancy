import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CircleCheck, ExternalLink, LogOut, Mail, UserMinus, UserPlus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { CompanySwitcher, EmployerOnly } from "./EmployerOnly";
import { useMyCompany, type Company } from "./company-hook";
import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { useSession, withAuth } from "~/shared/auth/session";
import { GirihPattern } from "~/shared/brand/GirihPattern";
import { nameOf, useCatalog } from "~/shared/catalog/catalog";
import { FormError } from "~/shared/forms/FormError";
import { useSubmit } from "~/shared/forms/useSubmit";
import { useUnsavedChanges } from "~/shared/forms/useUnsavedChanges";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { groupDigits } from "~/shared/lib/format";
import { ApiFailure, authed } from "~/shared/query/query";
import { LIMITS, uploadFile } from "~/shared/upload/upload";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Button, IconButton } from "~/shared/ui/Button";
import { Callout } from "~/shared/ui/Callout";
import { Card, CardBody, CardHeader } from "~/shared/ui/Card";
import { useConfirm } from "~/shared/ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "~/shared/ui/DataTable";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Field, Input, Textarea } from "~/shared/ui/Field";
import { FileDropzone } from "~/shared/ui/FileDropzone";
import { MonthPicker } from "~/shared/ui/MonthPicker";
import { PhoneInput } from "~/shared/ui/PhoneInput";
import { RelTime } from "~/shared/ui/RelTime";
import { PageHeader } from "~/shared/ui/Section";
import { Select } from "~/shared/ui/Select";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";

type CompanyInput = Schemas["CompanyInput"];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] as const;
// Column ids (a constant, not literals: test/i18n-keys.mjs reads every `key: "…"` as a message key).
const COL = { member: "member", role: "role", joined: "joined", actions: "actions" } as const;

export default function CompanyPage() {
  return <EmployerOnly><Page /></EmployerOnly>;
}

function Page() {
  const my = useMyCompany();
  const loading = useSkeletonHold(my.isPending);
  if (loading) {
    return (
      <SkeletonDelay>
        <CompanySkeleton />
      </SkeletonDelay>
    );
  }
  if (my.isError) {
    return (
      <Card padding="none">
        <ErrorState error={my.error} headingAs="h1" onRetry={() => my.refetch()} />
      </Card>
    );
  }
  // Keyed: the form starts from the saved profile of whichever company is picked (or a blank one).
  return <Editor key={my.company?.id ?? "new"} company={my.company ?? null} />;
}

const toInput = (c: Company | null): CompanyInput => ({
  name: c?.name ?? "", industry_id: c?.industry_id, size: c?.size, website: c?.website?.replace(/^https?:\/\//, "") ?? "",
  email: c?.email ?? "", phone: c?.phone ?? "", region_id: c?.region_id, address: c?.address ?? "",
  about: c?.about ?? "", founded_year: c?.founded_year,
});
const same = (a: CompanyInput, b: CompanyInput) =>
  (Object.keys(a) as (keyof CompanyInput)[]).every((k) => String(a[k] ?? "").trim() === String(b[k] ?? "").trim());
const blank = (v?: string) => (v?.trim() ? v.trim() : undefined);

function Editor({ company }: { company: Company | null }) {
  const { t } = useTranslation();
  const canEdit = !company || company.my_role !== "recruiter";
  const [f, setF] = useState<CompanyInput>(() => toInput(company));
  // What the server has: the form is dirty while it differs, and becomes this after a save.
  const [saved, setSaved] = useState<CompanyInput>(() => toInput(company));
  const dirty = canEdit && !same(f, saved);
  const guard = useUnsavedChanges(dirty);
  const set = <K extends keyof CompanyInput>(k: K, v: CompanyInput[K]) => setF((s) => ({ ...s, [k]: v }));

  return (
    <>
      <PageHeader
        title={company ? t("dashboardPage.companyTitle") : t("employer.createCompany")}
        description={company ? t("dashboardPage.companyHint") : t("employer.createHint")}
        actions={company && (
          <>
            <CompanySwitcher disabled={dirty} />
            <Button asChild variant="secondary" icon={<ExternalLink className="size-4" />}>
              <LocalizedLink to={`/companies/${company.slug}`} prefetch="intent">{t("employer.publicPage")}</LocalizedLink>
            </Button>
          </>
        )}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        {/* Live preview: first on phones and tablets (context for the form), a sticky aside on wide screens. */}
        <aside aria-labelledby="preview-title" className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-24 xl:col-start-2 xl:row-start-1">
          <Preview f={f} company={company} />
          {company && (
            company.verified ? (
              <Callout tone="success" title={t("dashboardPage.verifiedTitle")}>{t("employer.profileHint")}</Callout>
            ) : (
              <Callout tone="warning" title={t("dashboardPage.unverifiedTitle")}>{t("employer.unverifiedHint")}</Callout>
            )
          )}
        </aside>
        <div className="flex min-w-0 flex-col gap-6 xl:col-start-1 xl:row-start-1">
          {!canEdit && <Callout tone="info">{t("dashboardPage.readOnly")}</Callout>}
          {company && <LogoCard company={company} disabled={!canEdit} />}
          <ProfileForm
            company={company}
            f={f}
            set={set}
            dirty={dirty}
            disabled={!canEdit}
            onSaved={(v) => setSaved(v)}
            onReset={() => setF(saved)}
          />
          {company && <Team company={company} />}
        </div>
      </div>
      {guard}
    </>
  );
}

/* ---- live preview ---------------------------------------------------------------------------- */

/** The public company header as candidates will see it, updated while typing. */
function Preview({ f, company }: { f: CompanyInput; company: Company | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { categories, regions } = useCatalog();
  const industry = categories.find((c) => c.id === f.industry_id);
  const region = regions.find((r) => r.id === f.region_id);
  const meta = [
    industry && nameOf(industry.name, locale),
    region && nameOf(region.name, locale),
    f.size && t("dashboardPage.employees", { size: f.size }),
  ].filter(Boolean);
  const name = f.name.trim();
  const site = f.website?.trim().replace(/^https?:\/\//, "");
  return (
    <section aria-labelledby="preview-title">
      <h2 id="preview-title" className="mb-2.5 text-xs font-semibold uppercase tracking-caps text-ink-2">{t("dashboardPage.preview")}</h2>
      <Card padding="none" className="overflow-hidden">
        <div className="relative h-20 overflow-hidden bg-sunken md:h-24">
          {company?.cover_url ? (
            <img src={company.cover_url} alt="" width={640} height={160} decoding="async" className="size-full object-cover" />
          ) : (
            // Same fallback as the public page: aurora light with the girih tile.
            <>
              <div aria-hidden="true" className="aurora-hero absolute inset-0" />
              <GirihPattern reveal={false} focus="ellipse 80% 120% at 70% 30%" />
            </>
          )}
        </div>
        <div className="px-5 pb-5">
          <div className="relative -mt-8 w-fit rounded-sheet bg-surface p-1 shadow-2">
            <Avatar name={name || "?"} src={company?.logo_url} square size="lg" />
          </div>
          <p className={cn("mt-3 break-words font-display text-lg font-semibold tracking-heading", name ? "text-ink" : "text-ink-3")}>
            {name || t("dashboardPage.namePlaceholder")}
            {/* NBSP: the badge wraps together with the last word, never alone on a line. */}
            {company?.verified && (
              <>
                {"\u00a0"}
                <BadgeCheck role="img" aria-label={t("common.verified")} className="inline-block size-5 align-middle text-firuza" />
              </>
            )}
          </p>
          {meta.length > 0 && <p className="mt-1 break-words text-sm text-ink-2">{meta.join(" · ")}</p>}
          {site && <p className="mt-1 truncate text-sm text-lapis-ink">{site}</p>}
          <p className={cn("mt-3 line-clamp-3 whitespace-pre-line break-words text-sm", f.about?.trim() ? "text-ink-2" : "text-ink-3")}>
            {f.about?.trim() || t("dashboardPage.aboutPlaceholder")}
          </p>
        </div>
      </Card>
    </section>
  );
}

/* ---- logo -------------------------------------------------------------------------------- */

function LogoCard({ company, disabled }: { company: Company; disabled: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const put = (logo: string | null) =>
    qc.setQueryData<Company[]>(["my-companies"], (list) => list?.map((c) => (c.id === company.id ? { ...c, logo_url: logo } : c)));
  const failText = (e: unknown) => (e instanceof ApiFailure ? errorText(t, e.error) : t("settings.uploadFailed"));

  const pick = async ([file]: File[]) => {
    setError(null);
    const blob = URL.createObjectURL(file);
    setLocal(blob);
    setProgress(0);
    try {
      const up = await uploadFile(file, "company_logo", { onProgress: (x) => setProgress(Math.round(x * 100)) });
      const c = await authed<Company>(() => api.PUT("/companies/{company}/logo", { params: { path: { company: company.id } }, body: { file_id: up.id } }));
      const url = c?.logo_url ?? up.url ?? null;
      // Swap the local preview for the stored image only once it has loaded: no blank frame.
      if (url) await new Promise((done) => { const img = new window.Image(); img.onload = img.onerror = done; img.src = url; });
      put(url);
      toast({ tone: "success", title: t("dashboardPage.logoUpdated") });
      void qc.invalidateQueries({ queryKey: ["my-companies"] });
    } catch (e) {
      setError(failText(e));
    } finally {
      setProgress(null);
      setLocal(null);
      URL.revokeObjectURL(blob);
    }
  };

  // Optimistic: the logo disappears at once and comes back if the server refuses.
  const remove = useMutation<unknown, Error, void, string | null>({
    mutationFn: () => authed(() => api.PUT("/companies/{company}/logo", { params: { path: { company: company.id } }, body: { file_id: null } })),
    onMutate: () => {
      const prev = company.logo_url;
      put(null);
      return prev;
    },
    onSuccess: () => toast({ tone: "success", title: t("dashboardPage.logoRemoved") }),
    onError: (e, _v, prev) => {
      put(prev ?? null);
      toast({ tone: "error", title: failText(e) });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["my-companies"] }),
  });

  return (
    <Card as="section" id="logo" aria-labelledby="logo-title">
      <CardHeader id="logo-title" title={t("employer.logo")} description={t("dashboardPage.logoHint")} />
      <CardBody>
        <FileDropzone
          variant="logo"
          accept="image/jpeg,image/png,image/webp"
          maxSize={LIMITS.company_logo}
          onFiles={(files) => void pick(files)}
          progress={progress}
          previewUrl={local ?? company.logo_url}
          label={company.logo_url ? t("dashboardPage.changeLogo") : t("employer.uploadLogo")}
          error={error}
          disabled={disabled}
          onRemove={disabled ? undefined : () => remove.mutate()}
          removeLabel={t("dashboardPage.removeLogo")}
        />
      </CardBody>
    </Card>
  );
}

/* ---- profile form -------------------------------------------------------------------------- */

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-4 text-xs font-semibold uppercase tracking-caps text-ink-2">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function ProfileForm({ company, f, set, dirty, disabled, onSaved, onReset }: {
  company: Company | null;
  f: CompanyInput;
  set: <K extends keyof CompanyInput>(k: K, v: CompanyInput[K]) => void;
  dirty: boolean;
  disabled: boolean;
  onSaved: (v: CompanyInput) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const qc = useQueryClient();
  const { categories, regions } = useCatalog();
  const { selectCompany } = useMyCompany();
  const { pending, error, fields, run } = useSubmit();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body: CompanyInput = {
      ...f, name: f.name.trim(), website: blank(f.website), email: blank(f.email), phone: blank(f.phone), address: blank(f.address), about: blank(f.about),
    };
    void run(
      () => withAuth(() => (company ? api.PUT("/companies/{company}", { params: { path: { company: company.id } }, body }) : api.POST("/companies", { body }))),
      (res) => {
        onSaved(f);
        // A new company becomes the one every employer page works with.
        const created = (res.data as { data?: Company } | undefined)?.data;
        if (!company && created?.id) selectCompany(created.id);
        void qc.invalidateQueries({ queryKey: ["my-companies"] });
        toast({ tone: "success", title: company ? t("common.saved") : t("employer.companyCreated") });
      },
    );
  };

  return (
    <Card as="form" padding="none" aria-labelledby="profile-title" onSubmit={submit}>
      <div className="p-5 md:p-6">
        <CardHeader id="profile-title" title={company ? t("employer.profile") : t("dashboardPage.newCompany")} description={t("dashboardPage.profileHint")} />
        <FormError className="mt-4">{error}</FormError>
        <fieldset disabled={disabled} className="mt-6 flex min-w-0 flex-col gap-8">
          <Group title={t("dashboardPage.basics")}>
            <Field label={t("employer.name")} error={fields.name} className="sm:col-span-2">
              <Input value={f.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={120} autoComplete="organization" />
            </Field>
            <Field label={t("employer.industry")} error={fields.industry_id}>
              <Select value={String(f.industry_id ?? "")} placeholder={t("resume.choose")} onValueChange={(v) => set("industry_id", v ? Number(v) : undefined)}
                options={categories.map((c) => ({ value: String(c.id), label: nameOf(c.name, locale) }))} />
            </Field>
            <Field label={t("companies.size")} error={fields.size}>
              <Select value={f.size ?? ""} placeholder={t("resume.choose")} onValueChange={(v) => set("size", (v || undefined) as CompanyInput["size"])}
                options={SIZES.map((s) => ({ value: s, label: t("dashboardPage.employees", { size: s }) }))} />
            </Field>
            <Field label={t("companies.founded")} optional={t("common.optional")} error={fields.founded_year}>
              <MonthPicker mode="year" min="1900" max={String(new Date().getFullYear())} value={f.founded_year ? String(f.founded_year) : ""}
                onChange={(v) => set("founded_year", v ? Number(v) : undefined)} />
            </Field>
          </Group>
          <Group title={t("dashboardPage.location")}>
            <Field label={t("resume.city")} error={fields.region_id}>
              <Select value={String(f.region_id ?? "")} placeholder={t("resume.choose")} onValueChange={(v) => set("region_id", v ? Number(v) : undefined)}
                options={regions.map((r) => ({ value: String(r.id), label: nameOf(r.name, locale) }))} />
            </Field>
            <Field label={t("jobs.address")} optional={t("common.optional")} error={fields.address}>
              <Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} maxLength={300} autoComplete="street-address" />
            </Field>
            <Field label={t("companies.website")} optional={t("common.optional")} error={fields.website}>
              <Input value={f.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="example.uz" inputMode="url" autoComplete="url" />
            </Field>
            <Field label={t("form.email")} optional={t("common.optional")} error={fields.email}>
              <Input type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
            </Field>
            <Field label={t("settings.phone")} optional={t("common.optional")} error={fields.phone}>
              <PhoneInput value={f.phone ?? ""} onChange={(v) => set("phone", v)} />
            </Field>
          </Group>
          <Group title={t("companies.about")}>
            <Field label={t("dashboardPage.aboutLabel")} optional={t("common.optional")} hint={t("employer.aboutHint")} error={fields.about} className="sm:col-span-2">
              <Textarea rows={5} maxLength={5000} value={f.about ?? ""} onChange={(e) => set("about", e.target.value)} />
            </Field>
          </Group>
        </fieldset>
      </div>
      {!disabled && <SaveBar editing={!!company} dirty={dirty} pending={pending} onReset={onReset} />}
    </Card>
  );
}

/**
 * Footer of the form. While there are unsaved changes it turns into a floating glass bar that
 * stays above the tab bar as the form scrolls, so Save is always one tap away.
 */
function SaveBar({ editing, dirty, pending, onReset }: { editing: boolean; dirty: boolean; pending: boolean; onReset: () => void }) {
  const { t } = useTranslation();
  const floating = editing && dirty;
  return (
    // The sticky wrapper and the glass live on separate elements (glass sets its own position).
    <div className={cn("z-20 p-2 pt-0", floating && "sticky bottom-above-tabbar")}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-control px-3 py-2.5 sm:pl-4",
          floating ? "glass-chrome shadow-3" : "bg-sunken",
        )}
      >
        <p role="status" className="flex min-w-0 flex-1 basis-40 items-center gap-2 text-sm text-ink-2">
          {!editing ? null : dirty ? (
            <>
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-zafaron" />
              {t("dashboardPage.unsaved")}
            </>
          ) : (
            <>
              <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-firuza-ink" />
              {t("dashboardPage.allSaved")}
            </>
          )}
        </p>
        <div className="flex flex-1 justify-end gap-2 sm:flex-none">
          {floating && (
            <Button type="button" variant="ghost" onClick={onReset} disabled={pending} className="max-sm:flex-1">
              {t("dashboardPage.discard")}
            </Button>
          )}
          <Button type="submit" loading={pending} disabled={editing && !dirty} className="max-sm:flex-1">
            {editing ? t("common.save") : t("employer.createCompany")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---- team -------------------------------------------------------------------------------- */

type Member = { user_id: string; full_name: string; email: string | null; avatar_url: string | null; role: "owner" | "admin" | "recruiter"; joined_at: string };

function Team({ company }: { company: Company }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();
  const key = ["members", company.id];
  const q = useQuery({ queryKey: key, queryFn: () => authed<Member[]>(() => api.GET("/companies/{company}/members", { params: { path: { company: company.id } } })) });
  const loading = useSkeletonHold(q.isPending);
  const { confirm, dialog } = useConfirm();
  const manage = company.my_role === "owner" || company.my_role === "admin";

  const remove = useMutation<unknown, Error, Member, Member[] | undefined>({
    mutationFn: (m) => authed(() => api.DELETE("/companies/{company}/members/{user}", { params: { path: { company: company.id, user: m.user_id } } })),
    onMutate: async (m) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Member[]>(key);
      qc.setQueryData<Member[]>(key, (list) => list?.filter((x) => x.user_id !== m.user_id));
      return prev;
    },
    onSuccess: (_d, m) => {
      const self = m.user_id === user?.id;
      toast({ tone: "success", title: self ? t("dashboardPage.team.left") : t("dashboardPage.team.removed", { name: m.full_name }) });
      // Leaving: the company is no longer ours, so the employer pages move to the next one.
      if (self) void qc.invalidateQueries({ queryKey: ["my-companies"] });
    },
    onError: (e, _m, prev) => {
      qc.setQueryData(key, prev);
      toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network") });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const ask = async (m: Member) => {
    const self = m.user_id === user?.id;
    const ok = await confirm(
      self
        ? { title: t("dashboardPage.team.leaveTitle"), body: t("dashboardPage.team.leaveBody"), confirmLabel: t("dashboardPage.team.leave"), tone: "danger" }
        : { title: t("dashboardPage.team.removeTitle"), body: t("dashboardPage.team.removeBody", { name: m.full_name }), confirmLabel: t("dashboardPage.team.remove"), tone: "danger" },
    );
    if (ok) remove.mutate(m);
  };

  const action = (m: Member) => {
    const self = m.user_id === user?.id;
    if (m.role === "owner" || !(manage || self)) return null;
    return (
      <IconButton size="sm" label={self ? t("dashboardPage.team.leave") : t("dashboardPage.team.removeNamed", { name: m.full_name })} onClick={() => void ask(m)} className="hover:text-anor-ink">
        {self ? <LogOut className="size-4.5" /> : <UserMinus className="size-4.5" />}
      </IconButton>
    );
  };

  const who = (m: Member) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={m.full_name} src={m.avatar_url} size="md" />
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-2 text-md font-semibold text-ink">
          <span className="truncate">{m.full_name}</span>
          {m.user_id === user?.id && <Badge tone="outline" className="shrink-0">{t("dashboardPage.team.you")}</Badge>}
        </p>
        {m.email && <p className="truncate text-sm text-ink-2">{m.email}</p>}
      </div>
    </div>
  );
  const role = (m: Member) => <Badge tone={m.role === "owner" ? "lapis" : "neutral"}>{t(`employer.roles.${m.role}`)}</Badge>;

  const columns: DataTableColumn<Member>[] = [
    { key: COL.member, header: t("dashboardPage.team.member"), cell: who },
    { key: COL.role, header: t("employer.role"), className: "w-40", cell: role },
    {
      key: COL.joined,
      header: t("dashboardPage.team.joined"),
      className: "hidden w-40 lg:table-cell",
      cell: (m) => <RelTime iso={m.joined_at} className="text-sm text-ink-2" />,
    },
    { key: COL.actions, header: <span className="sr-only">{t("dashboardPage.actions")}</span>, align: "end", className: "w-16", cell: action },
  ];
  const members = q.data ?? [];

  return (
    <section aria-labelledby="team-title" className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h2 id="team-title" className="font-display text-lg font-semibold tracking-heading text-ink md:text-xl">{t("employer.team")}</h2>
          {q.data && (
            <span className="num grid h-6 min-w-6 place-items-center rounded-pill bg-sunken px-2 text-xs font-semibold text-ink-2">
              {groupDigits(members.length)}
            </span>
          )}
        </div>
        <p className="mt-1 text-md text-ink-2">{t("employer.teamHint")}</p>
      </div>
      {loading ? (
        <SkeletonDelay>
          <DataTable rows={[]} rowKey={(m) => m.user_id} columns={columns} loading caption={t("dashboardPage.team.caption")} />
        </SkeletonDelay>
      ) : q.isError ? (
        <Card padding="none">
          <ErrorState error={q.error} compact onRetry={() => q.refetch()} />
        </Card>
      ) : (
        <DataTable
          rows={members}
          rowKey={(m) => m.user_id}
          columns={columns}
          caption={t("dashboardPage.team.caption")}
          mobileCard={(m) => (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">{who(m)}</div>
              <div className="shrink-0">{role(m)}</div>
              {action(m) && <div className="-mr-2 shrink-0">{action(m)}</div>}
            </div>
          )}
        />
      )}
      {manage && <AddMember company={company} />}
      {dialog}
    </section>
  );
}

/**
 * Adds an existing employer account straight away (current API). The consent-based invitation
 * (the colleague accepts first, TZ FN-05) replaces this once the backend ships it.
 */
function AddMember({ company }: { company: Company }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "recruiter">("recruiter");
  const add = useSubmit();
  const roles = company.my_role === "owner" ? (["recruiter", "admin"] as const) : (["recruiter"] as const);

  return (
    <Card
      as="form"
      aria-labelledby="add-member-title"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void add.run(
          () => withAuth(() => api.POST("/companies/{company}/members", { params: { path: { company: company.id } }, body: { email: email.trim(), role } })),
          () => {
            setEmail("");
            void qc.invalidateQueries({ queryKey: ["members", company.id] });
            toast({ tone: "success", title: t("employer.memberAdded") });
          },
        );
      }}
    >
      <CardHeader as="h3" id="add-member-title" title={t("dashboardPage.team.addTitle")} description={t("employer.memberHint")} />
      <CardBody className="flex flex-col gap-4">
        <FormError>{add.error}</FormError>
        <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Field label={t("employer.memberEmail")} error={add.fields.email}>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.uz"
              autoComplete="off"
              enterKeyHint="send"
              leading={<Mail className="size-4.5" />}
            />
          </Field>
          <Field label={t("employer.role")} error={add.fields.role}>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "recruiter")} options={roles.map((r) => ({ value: r, label: t(`employer.roles.${r}`) }))} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" icon={<UserPlus className="size-4.5" />} loading={add.pending} className="max-sm:w-full">
            {t("employer.addMember")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* ---- skeleton ------------------------------------------------------------------------------ */

function CompanySkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true">
        <div className="mb-6 flex flex-col gap-3 md:mb-8">
          <Skeleton className="h-8 w-60 rounded-control md:h-9" />
          <Skeleton className="h-4 w-4/5 max-w-md" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
          <div className="xl:col-start-2 xl:row-start-1">
            <Skeleton className="mb-2.5 h-3 w-28" />
            <div className="surface-card overflow-hidden">
              <Skeleton className="h-20 w-full rounded-none md:h-24" />
              <div className="px-5 pb-5">
                <Skeleton className="-mt-8 size-16 rounded-sheet" />
                <Skeleton className="mt-3 h-6 w-1/2 rounded-control" />
                <Skeleton className="mt-2 h-4 w-2/3" />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-6 xl:col-start-1 xl:row-start-1">
            <div className="surface-card p-5 md:p-6">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-2 h-4 w-2/3" />
              <Skeleton className="mt-5 h-28 w-full rounded-panel" />
            </div>
            <div className="surface-card p-5 md:p-6">
              <Skeleton className="h-5 w-40" />
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={cn("flex flex-col gap-2", i === 0 && "sm:col-span-2")}>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-11 w-full rounded-control" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
