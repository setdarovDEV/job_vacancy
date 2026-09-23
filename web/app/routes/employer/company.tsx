import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ExternalLink, Trash2, UserPlus } from "lucide-react";
import { useRef, useState } from "react";

import { EmployerOnly } from "./EmployerOnly";
import { useMyCompany, type Company } from "./company-hook";
import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { useSession, withAuth } from "~/shared/auth/session";
import { nameOf, useCatalog } from "~/shared/catalog/catalog";
import { FormError } from "~/shared/forms/FormError";
import { useSubmit } from "~/shared/forms/useSubmit";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { ApiFailure, authed } from "~/shared/query/query";
import { LIMITS, uploadFile } from "~/shared/upload/upload";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Field, Input, Textarea } from "~/shared/ui/Field";
import { MonthPicker } from "~/shared/ui/MonthPicker";
import { PageHeader, Section } from "~/shared/ui/Section";
import { Select } from "~/shared/ui/Select";
import { Skeleton } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";

type CompanyInput = Schemas["CompanyInput"];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] as const;

export default function CompanyPage() {
  return <EmployerOnly><Page /></EmployerOnly>;
}

function Page() {
  const { t } = useTranslation();
  const { company, isPending } = useMyCompany();
  if (isPending) return <Skeleton className="h-[32rem] rounded-sheet" />;
  const canEdit = !company || company.my_role !== "recruiter";
  return (
    <>
      <PageHeader
        title={company ? t("employer.company") : t("employer.createCompany")}
        description={company ? undefined : t("employer.createHint")}
        actions={company && (
          <Button asChild variant="ghost" icon={<ExternalLink className="size-4" />}>
            <LocalizedLink to={`/companies/${company.slug}`}>{t("employer.publicPage")}</LocalizedLink>
          </Button>
        )}
      />
      <div className="rounded-sheet border border-line bg-surface px-5 py-8 md:px-8">
        {company && (
          <Section title={t("employer.logo")} description={t("employer.logoHint")}>
            <Logo company={company} disabled={!canEdit} />
          </Section>
        )}
        <Section title={t("employer.profile")} description={company && !company.verified ? t("employer.unverifiedHint") : t("employer.profileHint")}>
          {company && (
            <p className="mb-4">{company.verified ? <Badge tone="firuza">{t("common.verified")}</Badge> : <Badge tone="zafaron">{t("employer.notVerified")}</Badge>}</p>
          )}
          <CompanyForm company={company ?? null} disabled={!canEdit} />
        </Section>
        {company && (
          <Section title={t("employer.team")} description={t("employer.teamHint")}>
            <Members company={company} />
          </Section>
        )}
      </div>
    </>
  );
}

function CompanyForm({ company, disabled }: { company: Company | null; disabled: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const qc = useQueryClient();
  const { categories, regions } = useCatalog();
  const [f, setF] = useState<CompanyInput>(() => ({
    name: company?.name ?? "", industry_id: company?.industry_id, size: company?.size, website: company?.website?.replace(/^https?:\/\//, "") ?? "",
    email: company?.email ?? "", phone: company?.phone ?? "", region_id: company?.region_id, address: company?.address ?? "",
    about: company?.about ?? "", founded_year: company?.founded_year,
  }));
  const set = <K extends keyof CompanyInput>(k: K, v: CompanyInput[K]) => setF((s) => ({ ...s, [k]: v }));
  const { pending, error, fields, run } = useSubmit();
  const blank = (v?: string) => (v?.trim() ? v.trim() : undefined);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: CompanyInput = { ...f, name: f.name.trim(), website: blank(f.website), email: blank(f.email), phone: blank(f.phone), address: blank(f.address), about: blank(f.about) };
    void run(
      () => withAuth(() => (company ? api.PUT("/companies/{company}", { params: { path: { company: company.id } }, body }) : api.POST("/companies", { body }))),
      () => {
        void qc.invalidateQueries({ queryKey: ["my-companies"] });
        toast({ tone: "success", title: company ? t("common.saved") : t("employer.companyCreated") });
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-4">
      <FormError>{error}</FormError>
      <fieldset disabled={disabled} className="flex flex-col gap-4">
        <Field label={t("employer.name")} error={fields.name}>
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={120} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("employer.industry")} error={fields.industry_id}>
            <Select value={String(f.industry_id ?? "")} placeholder={t("resume.choose")} onValueChange={(v) => set("industry_id", v ? Number(v) : undefined)}
              options={categories.map((c) => ({ value: String(c.id), label: nameOf(c.name, locale) }))} />
          </Field>
          <Field label={t("companies.size")} error={fields.size}>
            <Select value={f.size ?? ""} placeholder={t("resume.choose")} onValueChange={(v) => set("size", (v || undefined) as CompanyInput["size"])}
              options={SIZES.map((s) => ({ value: s, label: s }))} />
          </Field>
          <Field label={t("resume.city")} error={fields.region_id}>
            <Select value={String(f.region_id ?? "")} placeholder={t("resume.choose")} onValueChange={(v) => set("region_id", v ? Number(v) : undefined)}
              options={regions.map((r) => ({ value: String(r.id), label: nameOf(r.name, locale) }))} />
          </Field>
          <Field label={t("companies.founded")} optional={t("common.optional")} error={fields.founded_year}>
            <MonthPicker mode="year" min="1900" max={String(new Date().getFullYear())} value={f.founded_year ? String(f.founded_year) : ""}
              onChange={(v) => set("founded_year", v ? Number(v) : undefined)} />
          </Field>
        </div>
        <Field label={t("jobs.address")} optional={t("common.optional")} error={fields.address}>
          <Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} maxLength={300} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("companies.website")} optional={t("common.optional")} error={fields.website}>
            <Input value={f.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="example.uz" inputMode="url" />
          </Field>
          <Field label={t("form.email")} optional={t("common.optional")} error={fields.email}>
            <Input type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </Field>
        </div>
        <Field label={t("companies.about")} optional={t("common.optional")} hint={t("employer.aboutHint")} error={fields.about}>
          <Textarea rows={5} maxLength={5000} value={f.about ?? ""} onChange={(e) => set("about", e.target.value)} />
        </Field>
        <div>
          <Button type="submit" loading={pending}>{company ? t("common.save") : t("employer.createCompany")}</Button>
        </div>
      </fieldset>
    </form>
  );
}

function Logo({ company, disabled }: { company: Company; disabled: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const setLogo = async (fileId: string | null) => {
    await authed(() => api.PUT("/companies/{company}/logo", { params: { path: { company: company.id } }, body: { file_id: fileId } }));
    await qc.invalidateQueries({ queryKey: ["my-companies"] });
  };
  const pick = async (file: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast({ tone: "error", title: t("validation.not_allowed") });
    if (file.size > LIMITS.company_logo) return toast({ tone: "error", title: t("validation.too_large") });
    setBusy(true);
    try {
      const f = await uploadFile(file, "company_logo");
      await setLogo(f.id);
    } catch (e) {
      toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("settings.uploadFailed") });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-4">
      <Avatar name={company.name} src={company.logo_url} square size="xl" />
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon={<Camera className="size-4" />} loading={busy} disabled={disabled} onClick={() => input.current?.click()}>
          {company.logo_url ? t("settings.changePhoto") : t("employer.uploadLogo")}
        </Button>
        {company.logo_url && !disabled && <Button variant="ghost" size="sm" onClick={() => void setLogo(null)}>{t("common.delete")}</Button>}
      </div>
    </div>
  );
}

type Member = { user_id: string; full_name: string; email: string | null; avatar_url: string | null; role: "owner" | "admin" | "recruiter"; joined_at: string };

function Members({ company }: { company: Company }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const qc = useQueryClient();
  const key = ["members", company.id];
  const q = useQuery({ queryKey: key, queryFn: () => authed<Member[]>(() => api.GET("/companies/{company}/members", { params: { path: { company: company.id } } })) });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "recruiter">("recruiter");
  const add = useSubmit();
  const remove = useMutation({
    mutationFn: (id: string) => authed(() => api.DELETE("/companies/{company}/members/{user}", { params: { path: { company: company.id, user: id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network") }),
  });
  const manage = company.my_role === "owner" || company.my_role === "admin";

  return (
    <div className="flex flex-col gap-5">
      {!q.data ? <Skeleton className="h-16" /> : (
        <ul className="divide-y divide-line rounded-panel border border-line">
          {q.data.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={m.full_name} src={m.avatar_url} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{m.full_name}</p>
                <p className="truncate text-xs text-ink-3">{m.email}</p>
              </div>
              <Badge tone={m.role === "owner" ? "lapis" : "neutral"}>{t(`employer.roles.${m.role}`)}</Badge>
              {m.role !== "owner" && (manage || m.user_id === user?.id) && (
                <button type="button" aria-label={t("common.delete")} onClick={() => remove.mutate(m.user_id)} className="grid size-9 place-items-center rounded-control text-ink-3 hover:bg-sunken hover:text-anor-ink">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {manage && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void add.run(
              () => withAuth(() => api.POST("/companies/{company}/members", { params: { path: { company: company.id } }, body: { email: email.trim(), role } })),
              () => { setEmail(""); void qc.invalidateQueries({ queryKey: key }); toast({ tone: "success", title: t("employer.memberAdded") }); },
            );
          }}
        >
          <FormError>{add.error}</FormError>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="email" required placeholder={t("employer.memberEmail")} aria-label={t("employer.memberEmail")} value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
            <Select aria-label={t("employer.role")} className="sm:w-40" value={role} onValueChange={(v) => setRole(v as "admin" | "recruiter")}
              options={(company.my_role === "owner" ? ["recruiter", "admin"] : ["recruiter"]).map((r) => ({ value: r, label: t(`employer.roles.${r}`) }))} />
            <Button type="submit" variant="secondary" icon={<UserPlus className="size-4" />} loading={add.pending}>{t("employer.addMember")}</Button>
          </div>
          <p className="text-xs text-ink-3">{t("employer.memberHint")}</p>
        </form>
      )}
    </div>
  );
}
