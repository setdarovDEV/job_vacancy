import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { SeekerOnly } from "./layout";
import { api, type Schemas } from "~/shared/api/client";
import { withAuth } from "~/shared/auth/session";
import { nameOf, useCatalog } from "~/shared/catalog/catalog";
import { FormError } from "~/shared/forms/FormError";
import { TagInput } from "~/shared/forms/TagInput";
import { useSubmit } from "~/shared/forms/useSubmit";
import { localizedPath } from "~/shared/i18n/config";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { groupDigits } from "~/shared/lib/format";
import { cn } from "~/shared/lib/cn";
import { authed } from "~/shared/query/query";
import { Button } from "~/shared/ui/Button";
import { Chip } from "~/shared/ui/Chip";
import { Field, Input, Textarea } from "~/shared/ui/Field";
import { MonthPicker } from "~/shared/ui/MonthPicker";
import { PageHeader } from "~/shared/ui/Section";
import { Select } from "~/shared/ui/Select";
import { Skeleton } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";
import { Checkbox } from "~/shared/ui/Toggle";

type Input_ = Schemas["ResumeInput"];
type Exp = NonNullable<Input_["experiences"]>[number];
type Edu = NonNullable<Input_["educations"]>[number];
type Lang = NonNullable<Input_["languages"]>[number];

const EMPTY: Input_ = {
  title: "", about: "", relocate: false, currency: "UZS", employment_types: [], work_formats: [], visibility: "public",
  experiences: [], educations: [], skills: [], languages: [{ language: "uz", level: "native" }],
};
const LEVELS = ["secondary", "vocational", "incomplete_higher", "bachelor", "master", "phd"] as const;
const LANG_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2", "native"] as const;
const LANGS = ["uz", "ru", "en", "tr", "ko", "de", "zh", "ar", "kk", "tg", "ky", "fr", "ja"];

export default function ResumeEdit() {
  return <SeekerOnly><Editor /></SeekerOnly>;
}

function Editor() {
  const { id } = useParams();
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["resume", id],
    enabled: Boolean(id),
    queryFn: () => authed<Schemas["ResumeDetail"]>(() => api.GET("/resumes/{resume}", { params: { path: { resume: id! } } })),
  });
  if (id && !q.data) return <div className="flex flex-col gap-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-96 rounded-sheet" /></div>;
  return <ResumeForm id={id} initial={q.data ? fromDetail(q.data) : EMPTY} title={id ? t("resume.editTitle") : t("resume.newTitle")} />;
}

function fromDetail(d: Schemas["ResumeDetail"]): Input_ {
  return {
    title: d.title, about: d.about ?? "", category_id: d.category_id ?? undefined, region_id: d.region_id ?? undefined,
    relocate: d.relocate, desired_salary: d.desired_salary?.amount, currency: (d.desired_salary?.currency as "UZS" | "USD") ?? "UZS",
    employment_types: (d.employment_types ?? []) as Input_["employment_types"], work_formats: (d.work_formats ?? []) as Input_["work_formats"],
    visibility: d.visibility ?? "public",
    experiences: d.experiences ?? [], educations: d.educations ?? [],
    skills: d.skills.map((s) => s.name), languages: d.languages ?? [],
  };
}

function ResumeForm({ id, initial, title }: { id?: string; initial: Input_; title: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { categories, regions } = useCatalog();
  const [f, setF] = useState<Input_>(initial);
  const { pending, error, fields, run } = useSubmit();
  const set = <K extends keyof Input_>(k: K, v: Input_[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggle = <K extends "employment_types" | "work_formats">(k: K, v: string) =>
    setF((s) => {
      const cur = (s[k] ?? []) as string[];
      return { ...s, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Input_ = {
      ...f,
      title: f.title.trim(),
      experiences: f.experiences?.map((x) => ({ ...x, end: x.end || null })),
      desired_salary: f.desired_salary || undefined,
    };
    void run(
      () => withAuth(() => (id
        ? api.PUT("/resumes/{resume}", { params: { path: { resume: id } }, body })
        : api.POST("/resumes", { body }))),
      () => {
        void qc.invalidateQueries({ queryKey: ["my-resumes"] });
        void qc.invalidateQueries({ queryKey: ["resume", id] });
        toast({ tone: "success", title: t("common.saved") });
        navigate(localizedPath(locale, "/me/resumes"));
      },
    );
  };

  const categoryGroups = categories.map((c) => ({
    label: nameOf(c.name, locale),
    options: (c.children?.length ? c.children : [c]).map((ch) => ({ value: String(ch.id), label: nameOf(ch.name, locale) })),
  }));

  return (
    <form onSubmit={submit} noValidate={false}>
      <PageHeader title={title} description={t("resume.formHint")} />
      <FormError>{error}</FormError>
      <div className="mt-4 flex flex-col gap-4">
        <Panel title={t("resume.basics")}>
          <Field label={t("resume.position")} hint={t("resume.positionHint")} error={fields.title}>
            <Input value={f.title} onChange={(e) => set("title", e.target.value)} required minLength={2} maxLength={150} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("jobs.filters.category")} error={fields.category_id}>
              <Select value={String(f.category_id ?? "")} onValueChange={(v) => set("category_id", v ? Number(v) : undefined)} placeholder={t("resume.choose")} groups={categoryGroups} />
            </Field>
            <Field label={t("resume.city")} error={fields.region_id}>
              <Select value={String(f.region_id ?? "")} onValueChange={(v) => set("region_id", v ? Number(v) : undefined)} placeholder={t("resume.choose")}
                options={regions.map((r) => ({ value: String(r.id), label: nameOf(r.name, locale) }))} />
            </Field>
          </div>
          <Checkbox checked={Boolean(f.relocate)} onCheckedChange={(v) => set("relocate", v)} label={t("resume.relocate")} />
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field label={t("resume.salary")} optional={t("common.optional")} error={fields.desired_salary}>
              <Input
                inputMode="numeric"
                className="num"
                value={f.desired_salary ? groupDigits(f.desired_salary) : ""}
                onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 12); set("desired_salary", d ? Number(d) : undefined); }}
              />
            </Field>
            <Field label={t("resume.currency")}>
              <Select value={f.currency ?? "UZS"} onValueChange={(v) => set("currency", v as "UZS" | "USD")} options={[{ value: "UZS", label: "so'm" }, { value: "USD", label: "USD" }]} />
            </Field>
          </div>
          <ChipField label={t("jobs.filters.employment")}>
            {(["full_time", "part_time", "project", "internship", "volunteer"] as const).map((v) => (
              <Chip key={v} selected={f.employment_types?.includes(v)} onClick={() => toggle("employment_types", v)}>{t(`enums.employment_type.${v}`)}</Chip>
            ))}
          </ChipField>
          <ChipField label={t("jobs.filters.format")}>
            {(["office", "remote", "hybrid"] as const).map((v) => (
              <Chip key={v} selected={f.work_formats?.includes(v)} onClick={() => toggle("work_formats", v)}>{t(`enums.work_format.${v}`)}</Chip>
            ))}
          </ChipField>
        </Panel>

        <Panel title={t("resume.about")} hint={t("resume.aboutHint")}>
          <Textarea rows={5} maxLength={5000} value={f.about ?? ""} onChange={(e) => set("about", e.target.value)} aria-label={t("resume.about")} />
        </Panel>

        <Panel title={t("resume.experience")} hint={t("resume.experienceHint")} error={fields.experiences && t("resume.datesError")}>
          {(f.experiences ?? []).map((x, i) => (
            <Repeated key={i} onRemove={() => set("experiences", f.experiences!.filter((_, j) => j !== i))} removeLabel={t("common.delete")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("resume.company")}><Input value={x.company} required maxLength={150} onChange={(e) => setExp(i, { company: e.target.value })} /></Field>
                <Field label={t("resume.role")}><Input value={x.position} required maxLength={150} onChange={(e) => setExp(i, { position: e.target.value })} /></Field>
                <Field label={t("resume.start")}>
                  <MonthPicker value={x.start} required max={thisMonth()} onChange={(v) => setExp(i, { start: v, ...(x.end && v > x.end ? { end: v } : {}) })} />
                </Field>
                <Field label={t("resume.end")}>
                  {x.end == null
                    ? <MonthPicker value="" disabled placeholder={t("resume.present")} onChange={() => {}} />
                    : <MonthPicker value={x.end} required min={x.start || undefined} max={thisMonth()} onChange={(v) => setExp(i, { end: v })} />}
                </Field>
              </div>
              <Checkbox checked={x.end == null} onCheckedChange={(v) => setExp(i, { end: v ? null : thisMonth() })} label={t("resume.current")} />
              <Field label={t("resume.duties")} optional={t("common.optional")}>
                <Textarea rows={3} maxLength={3000} value={x.description ?? ""} onChange={(e) => setExp(i, { description: e.target.value })} />
              </Field>
            </Repeated>
          ))}
          <AddButton disabled={(f.experiences?.length ?? 0) >= 20} onClick={() => set("experiences", [...(f.experiences ?? []), { company: "", position: "", start: "", end: null }])}>
            {t("resume.addExperience")}
          </AddButton>
        </Panel>

        <Panel title={t("resume.education")} error={fields.educations && t("resume.datesError")}>
          {(f.educations ?? []).map((x, i) => (
            <Repeated key={i} onRemove={() => set("educations", f.educations!.filter((_, j) => j !== i))} removeLabel={t("common.delete")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("resume.institution")} className="sm:col-span-2"><Input value={x.institution} required maxLength={200} onChange={(e) => setEdu(i, { institution: e.target.value })} /></Field>
                <Field label={t("resume.level")}>
                  <Select value={x.level} onValueChange={(v) => setEdu(i, { level: v as Edu["level"] })} options={LEVELS.map((l) => ({ value: l, label: t(`resume.levels.${l}`) }))} />
                </Field>
                <Field label={t("resume.field")} optional={t("common.optional")}><Input value={x.field ?? ""} maxLength={150} onChange={(e) => setEdu(i, { field: e.target.value })} /></Field>
                <Field label={t("resume.startYear")}>
                  <MonthPicker mode="year" min="1950" max={String(new Date().getFullYear())} value={x.start_year ? String(x.start_year) : ""}
                    onChange={(v) => setEdu(i, { start_year: v ? Number(v) : undefined, ...(v && x.end_year && Number(v) > x.end_year ? { end_year: Number(v) } : {}) })} />
                </Field>
                <Field label={t("resume.endYear")} hint={t("resume.endYearHint")}>
                  <MonthPicker mode="year" min={x.start_year ? String(x.start_year) : "1950"} max={String(new Date().getFullYear() + 8)} value={x.end_year ? String(x.end_year) : ""}
                    onChange={(v) => setEdu(i, { end_year: v ? Number(v) : undefined })} />
                </Field>
              </div>
            </Repeated>
          ))}
          <AddButton disabled={(f.educations?.length ?? 0) >= 10} onClick={() => set("educations", [...(f.educations ?? []), { institution: "", level: "bachelor" }])}>
            {t("resume.addEducation")}
          </AddButton>
        </Panel>

        <Panel title={t("jobs.skills")} hint={t("resume.skillsHint")}>
          <TagInput value={f.skills ?? []} onChange={(v) => set("skills", v)} max={30} placeholder={t("resume.skillsPlaceholder")} label={t("jobs.skills")} />
        </Panel>

        <Panel title={t("resume.languages")} error={fields.languages && t("resume.langDup")}>
          {(f.languages ?? []).map((x, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label={i === 0 ? t("resume.language") : undefined} className="flex-1">
                <Select value={x.language} onValueChange={(v) => setLang(i, { language: v })} options={LANGS.map((l) => ({ value: l, label: t(`langs.${l}`) }))} />
              </Field>
              <Field label={i === 0 ? t("resume.langLevel") : undefined} className="flex-1">
                <Select value={x.level} onValueChange={(v) => setLang(i, { level: v as Lang["level"] })} options={LANG_LEVELS.map((l) => ({ value: l, label: t(`resume.langLevels.${l}`) }))} />
              </Field>
              <button type="button" aria-label={t("common.delete")} onClick={() => set("languages", f.languages!.filter((_, j) => j !== i))} className="grid size-11 shrink-0 place-items-center rounded-control text-ink-3 hover:bg-sunken hover:text-anor-ink">
                <Trash2 className="size-4.5" />
              </button>
            </div>
          ))}
          <AddButton disabled={(f.languages?.length ?? 0) >= 10} onClick={() => set("languages", [...(f.languages ?? []), { language: LANGS.find((l) => !f.languages?.some((x) => x.language === l)) ?? "en", level: "b1" }])}>
            {t("resume.addLanguage")}
          </AddButton>
        </Panel>

        <Panel title={t("resume.visibility")}>
          <div className="grid gap-2">
            {(["public", "applied_only", "hidden"] as const).map((v) => (
              <label key={v} className={cn("flex cursor-pointer gap-3 rounded-control border px-4 py-3 transition-colors", f.visibility === v ? "border-lapis bg-lapis-soft/50" : "border-line-strong hover:border-ink-3")}>
                <input type="radio" name="visibility" checked={f.visibility === v} onChange={() => set("visibility", v)} className="mt-1 size-4 accent-[var(--lapis)]" />
                <span>
                  <span className="block font-medium text-ink">{t(`resume.vis.${v}`)}</span>
                  <span className="block text-sm text-ink-3">{t(`resume.visHint.${v}`)}</span>
                </span>
              </label>
            ))}
          </div>
        </Panel>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex justify-end gap-2 border-t border-line bg-paper/90 px-4 py-4 backdrop-blur md:mx-0 md:rounded-panel md:border md:px-5">
        <Button type="button" variant="ghost" onClick={() => navigate(-1)}>{t("common.cancel")}</Button>
        <Button type="submit" loading={pending}>{t("common.save")}</Button>
      </div>
    </form>
  );

  function setExp(i: number, patch: Partial<Exp>) {
    setF((s) => ({ ...s, experiences: s.experiences!.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  }
  function setEdu(i: number, patch: Partial<Edu>) {
    setF((s) => ({ ...s, educations: s.educations!.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  }
  function setLang(i: number, patch: Partial<Lang>) {
    setF((s) => ({ ...s, languages: s.languages!.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  }
}

const thisMonth = () => new Date().toISOString().slice(0, 7);

function Panel({ title, hint, error, children }: { title: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-sheet border border-line bg-surface p-5 md:p-6">
      <legend className="float-left w-full">
        <span className="block font-display text-base font-semibold tracking-[-0.01em] text-ink">{title}</span>
        {hint && <span className="mt-1 block text-sm text-ink-3">{hint}</span>}
      </legend>
      {error && <p role="alert" className="text-sm text-anor-ink">{error}</p>}
      {children}
    </fieldset>
  );
}

function ChipField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Repeated({ children, onRemove, removeLabel }: { children: React.ReactNode; onRemove: () => void; removeLabel: string }) {
  return (
    <div className="relative flex flex-col gap-4 rounded-panel border border-line bg-paper/50 p-4 pr-12">
      {children}
      <button type="button" aria-label={removeLabel} onClick={onRemove} className="absolute right-2 top-2 grid size-9 place-items-center rounded-control text-ink-3 hover:bg-sunken hover:text-anor-ink">
        <Trash2 className="size-4.5" />
      </button>
    </div>
  );
}

function AddButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <div>
      <Button type="button" variant="soft" size="sm" icon={<Plus className="size-4" />} onClick={onClick} disabled={disabled}>{children}</Button>
    </div>
  );
}
