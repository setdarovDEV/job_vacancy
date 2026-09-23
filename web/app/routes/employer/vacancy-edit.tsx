import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { EmployerOnly } from "./EmployerOnly";
import { useMyCompany } from "./company-hook";
import { api, type Schemas } from "~/shared/api/client";
import { withAuth } from "~/shared/auth/session";
import { nameOf, useCatalog } from "~/shared/catalog/catalog";
import { FormError } from "~/shared/forms/FormError";
import { TagInput } from "~/shared/forms/TagInput";
import { useSubmit } from "~/shared/forms/useSubmit";
import { localizedPath } from "~/shared/i18n/config";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { groupDigits } from "~/shared/lib/format";
import { authed } from "~/shared/query/query";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { EmptyState } from "~/shared/ui/EmptyState";
import { Field, Input, Textarea } from "~/shared/ui/Field";
import { PageHeader } from "~/shared/ui/Section";
import { Select } from "~/shared/ui/Select";
import { Skeleton } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";

type VInput = Schemas["VacancyInput"];
type Detail = Schemas["VacancyDetail"];

const ENUMS = {
  employment_type: ["full_time", "part_time", "project", "internship", "volunteer"],
  work_format: ["office", "remote", "hybrid"],
  experience: ["none", "1_3", "3_6", "6_plus"],
  schedule: ["full_day", "shift", "flexible", "rotation"],
} as const;

export default function VacancyEdit() {
  return <EmployerOnly><Loader /></EmployerOnly>;
}

function Loader() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { company, isPending } = useMyCompany();
  const q = useQuery({
    queryKey: ["vacancy", id],
    enabled: Boolean(id),
    queryFn: () => authed<Detail>(() => api.GET("/vacancies/{vacancy}", { params: { path: { vacancy: id! } } })),
  });
  if (isPending || (id && !q.data && !q.error)) return <Skeleton className="h-[40rem] rounded-sheet" />;
  if (!company) {
    return <EmptyState title={t("employer.noCompany")} action={<Button asChild><LocalizedLink to="/employer/company">{t("employer.createCompany")}</LocalizedLink></Button>} />;
  }
  if (q.error) return <EmptyState title={t("apiErrors.vacancy_not_found")} />;
  return <VacancyForm companyId={company.id} verified={company.verified} existing={q.data} />;
}

function VacancyForm({ companyId, verified, existing }: { companyId: string; verified: boolean; existing?: Detail }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { categories, regions } = useCatalog();
  const [f, setF] = useState<VInput>(() => existing ? {
    title: existing.title, description: existing.description, category_id: existing.category_id, region_id: existing.region_id,
    district_id: existing.district_id ?? undefined, address: existing.address ?? "", salary_min: existing.salary?.min ?? undefined,
    salary_max: existing.salary?.max ?? undefined, currency: (existing.salary?.currency as "UZS" | "USD") ?? "UZS",
    employment_type: existing.employment_type, work_format: existing.work_format, experience: existing.experience, schedule: existing.schedule,
    skills: existing.skills.map((s) => s.name),
  } : {
    title: "", description: "", category_id: 0, region_id: 0, currency: "UZS",
    employment_type: "full_time", work_format: "office", experience: "none", schedule: "full_day", skills: [],
  });
  const set = <K extends keyof VInput>(k: K, v: VInput[K]) => setF((s) => ({ ...s, [k]: v }));
  const { pending, error, fields, run } = useSubmit();
  const [publishing, setPublishing] = useState(false);
  const live = existing?.status === "published" || existing?.status === "moderation";
  const region = regions.find((r) => r.id === f.region_id);

  const save = (publish: boolean) => {
    setPublishing(publish);
    const body: VInput = { ...f, title: f.title.trim(), address: f.address?.trim() || undefined, district_id: f.district_id || undefined };
    void run(
      () => withAuth(() => existing
        ? api.PUT("/vacancies/{vacancy}", { params: { path: { vacancy: existing.id } }, body })
        : api.POST("/companies/{company}/vacancies", { params: { path: { company: companyId } }, body })),
      async (res) => {
        const v = res.data?.data as Detail | undefined;
        let status = v?.status;
        if (publish && v && !live) {
          const sub = await withAuth(() => api.POST("/vacancies/{vacancy}/submit", { params: { path: { vacancy: v.id } } }));
          status = (sub.data?.data as Detail | undefined)?.status ?? status;
        }
        void qc.invalidateQueries({ queryKey: ["company-vacancies", companyId] });
        void qc.invalidateQueries({ queryKey: ["vacancy", existing?.id] });
        toast({ tone: "success", title: status === "published" ? t("employer.published") : status === "moderation" ? t("employer.sentToModeration") : t("employer.draftSaved") });
        navigate(localizedPath(locale, "/employer"));
      },
    );
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(true); }}>
      <PageHeader title={existing ? t("employer.editVacancy") : t("nav.postVacancy")} description={t("employer.formHint")} />
      <FormError>{error}</FormError>
      <div className="mt-4 flex flex-col gap-4">
        <Panel title={t("employer.what")}>
          <Field label={t("employer.vacancyTitle")} hint={t("employer.vacancyTitleHint")} error={fields.title}>
            <Input value={f.title} onChange={(e) => set("title", e.target.value)} required minLength={3} maxLength={150} />
          </Field>
          <Field label={t("jobs.filters.category")} error={fields.category_id}>
            <Select required value={f.category_id ? String(f.category_id) : ""} placeholder={t("resume.choose")} onValueChange={(v) => set("category_id", Number(v))}
              groups={categories.map((c) => ({ label: nameOf(c.name, locale), options: (c.children?.length ? c.children : [c]).map((ch) => ({ value: String(ch.id), label: nameOf(ch.name, locale) })) }))} />
          </Field>
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="vac-desc" className="text-sm font-medium text-ink">{t("jobs.description")}</label>
              <span className="flex items-center gap-1.5 text-xs text-ink-3" title={t("employer.aiWriter")}>
                <Sparkles className="size-3.5 text-zafaron" />{t("employer.aiWriter")}<Badge tone="zafaron" className="h-5">{t("common.soon")}</Badge>
              </span>
            </div>
            <Textarea id="vac-desc" rows={12} required minLength={30} maxLength={10000} value={f.description} onChange={(e) => set("description", e.target.value)}
              aria-invalid={fields.description ? true : undefined} placeholder={t("employer.descriptionPlaceholder")} />
            <p className={cn("mt-1.5 text-xs", fields.description ? "text-anor-ink" : "text-ink-3")}>{fields.description ?? t("employer.descriptionHint")}</p>
          </div>
          <Field label={t("jobs.skills")} hint={t("resume.skillsHint")} error={fields.skills}>
            <TagInput value={f.skills ?? []} onChange={(v) => set("skills", v)} max={20} placeholder={t("resume.skillsPlaceholder")} label={t("jobs.skills")} />
          </Field>
        </Panel>

        <Panel title={t("employer.conditions")}>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_8rem]">
            <Field label={t("employer.salaryMin")} optional={t("common.optional")} error={fields.salary_min}>
              <MoneyInput value={f.salary_min} onChange={(v) => set("salary_min", v)} />
            </Field>
            <Field label={t("employer.salaryMax")} optional={t("common.optional")} error={fields.salary_max}>
              <MoneyInput value={f.salary_max} onChange={(v) => set("salary_max", v)} />
            </Field>
            <Field label={t("resume.currency")}>
              <Select value={f.currency ?? "UZS"} onValueChange={(v) => set("currency", v as "UZS" | "USD")} options={[{ value: "UZS", label: "so'm" }, { value: "USD", label: "USD" }]} />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-ink-3">{t("employer.salaryHint")}</p>
          {(Object.keys(ENUMS) as (keyof typeof ENUMS)[]).map((k) => (
            <Choice key={k} label={t(`jobs.filters.${k === "employment_type" ? "employment" : k === "work_format" ? "format" : k}`)}
              value={f[k]} options={ENUMS[k].map((v) => ({ value: v, label: t(`enums.${k}.${v}`) }))} onChange={(v) => set(k, v as never)} />
          ))}
        </Panel>

        <Panel title={t("employer.where")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("jobs.filters.region")} error={fields.region_id}>
              <Select required value={f.region_id ? String(f.region_id) : ""} placeholder={t("resume.choose")} onValueChange={(v) => setF((s) => ({ ...s, region_id: Number(v), district_id: undefined }))}
                options={regions.map((r) => ({ value: String(r.id), label: nameOf(r.name, locale) }))} />
            </Field>
            {(region?.children?.length ?? 0) > 0 && (
              <Field label={t("employer.district")} optional={t("common.optional")} error={fields.district_id}>
                <Select value={String(f.district_id ?? "")} placeholder={t("resume.choose")} onValueChange={(v) => set("district_id", v ? Number(v) : undefined)}
                  options={region!.children!.map((d) => ({ value: String(d.id), label: nameOf(d.name, locale) }))} />
              </Field>
            )}
          </div>
          <Field label={t("jobs.address")} optional={t("common.optional")} error={fields.address}>
            <Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} maxLength={300} placeholder={t("employer.addressPlaceholder")} />
          </Field>
        </Panel>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/90 px-4 py-4 backdrop-blur md:mx-0 md:rounded-panel md:border md:px-5">
        {!live && !verified && <p className="mr-auto hidden text-xs text-ink-3 sm:block">{t("employer.moderationNote")}</p>}
        {!live && <Button type="button" variant="ghost" loading={pending && !publishing} onClick={() => save(false)}>{t("employer.saveDraft")}</Button>}
        <Button type="submit" loading={pending && publishing}>{live ? t("common.save") : t("employer.publish")}</Button>
      </div>
    </form>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-sheet border border-line bg-surface p-5 md:p-6">
      <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** Single choice drawn as chips (a radio group). */
function Choice({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className={cn(
            "inline-flex h-9 cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus",
            value === o.value ? "border-transparent bg-lapis text-on-lapis" : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink",
          )}>
            <input type="radio" className="sr-only" name={label} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function MoneyInput({ value, onChange }: { value?: number; onChange: (v?: number) => void }) {
  return (
    <Input inputMode="numeric" className="num" value={value ? groupDigits(value) : ""}
      onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 12); onChange(d ? Number(d) : undefined); }} />
  );
}
