import type { Schemas } from "~/shared/api/client";
import type { TFunction } from "~/shared/i18n/i18n";

export type VInput = Schemas["VacancyInput"];
export type Detail = Schemas["VacancyDetail"];
export type EditorStep = "basics" | "conditions" | "description" | "skills" | "preview";

export const STEPS: EditorStep[] = ["basics", "conditions", "description", "skills", "preview"];

// The API's limits (backend vacancy.Input), checked here so the person sees them before sending.
export const LIMITS = { titleMin: 3, titleMax: 150, descriptionMin: 30, descriptionMax: 10_000, address: 300, skills: 20 } as const;

export const ENUMS = {
  work_format: ["office", "remote", "hybrid"],
  employment_type: ["full_time", "part_time", "project", "internship", "volunteer"],
  experience: ["none", "1_3", "3_6", "6_plus"],
  schedule: ["full_day", "shift", "flexible", "rotation"],
} as const;

export const EMPTY: VInput = {
  title: "", description: "", category_id: 0, region_id: 0, currency: "UZS",
  employment_type: "full_time", work_format: "office", experience: "none", schedule: "full_day", skills: [],
};

export function fromDetail(v: Detail): VInput {
  return {
    title: v.title, description: v.description, category_id: v.category_id, region_id: v.region_id,
    district_id: v.district_id ?? undefined, address: v.address ?? "",
    salary_min: v.salary?.min ?? undefined, salary_max: v.salary?.max ?? undefined,
    currency: v.salary?.currency === "USD" ? "USD" : "UZS",
    employment_type: v.employment_type, work_format: v.work_format, experience: v.experience, schedule: v.schedule,
    skills: v.skills.map((s) => s.name),
  };
}

/** Which step owns a field: client keys and the API's validation keys are the same JSON names. */
export function stepOf(key: string): EditorStep {
  if (/^(salary|currency|employment_type|work_format|experience|schedule)/.test(key)) return "conditions";
  if (key === "description") return "description";
  if (key.startsWith("skills")) return "skills";
  return "basics";
}

/** Required fields per step, in tab order (Enter jumps to the first one still missing). */
export const REQUIRED: Partial<Record<EditorStep, { field: keyof VInput; id: string }[]>> = {
  basics: [{ field: "title", id: "f-title" }, { field: "category_id", id: "f-category" }, { field: "region_id", id: "f-region" }],
  description: [{ field: "description", id: "f-description" }],
};

/** Drops list markers left empty (e.g. from the template): they would show up as lone "-" lines. */
export const tidyDescription = (text: string) => text.replace(/^[ \t]*(?:[-•*]|\d{1,3}[.)])[ \t]*$\n?/gm, "").trim();

export const salaryInverted = (f: VInput) => f.salary_min != null && f.salary_max != null && f.salary_min > f.salary_max;

/** The rules the API enforces for both drafts and publishing. */
export function validate(f: VInput, t: TFunction): Record<string, string> {
  const e: Record<string, string> = {};
  const required = t("validation.required");
  const title = f.title.trim();
  if (title.length < LIMITS.titleMin) e.title = title ? t("validation.min", { n: LIMITS.titleMin }) : required;
  if (!f.category_id) e.category_id = required;
  if (!f.region_id) e.region_id = required;
  const description = tidyDescription(f.description);
  if (description.length < LIMITS.descriptionMin) e.description = description ? t("validation.min", { n: LIMITS.descriptionMin }) : required;
  if (salaryInverted(f)) e.salary_max = t("validation.gtefield");
  return e;
}

export type CheckId = "title" | "category" | "region" | "salary" | "description" | "skills";
export type Check = { id: CheckId; step: EditorStep; done: boolean; required: boolean };

/** What a strong vacancy has: the required fields plus a salary and a few skills (they drive search and replies). */
export function readiness(f: VInput) {
  const items: Check[] = [
    { id: "title", step: "basics", required: true, done: f.title.trim().length >= LIMITS.titleMin },
    { id: "category", step: "basics", required: true, done: Boolean(f.category_id) },
    { id: "region", step: "basics", required: true, done: Boolean(f.region_id) },
    { id: "salary", step: "conditions", required: false, done: (f.salary_min != null || f.salary_max != null) && !salaryInverted(f) },
    { id: "description", step: "description", required: true, done: tidyDescription(f.description).length >= LIMITS.descriptionMin },
    { id: "skills", step: "skills", required: false, done: (f.skills?.length ?? 0) >= 3 },
  ];
  const done = items.filter((c) => c.done).length;
  return {
    items,
    percent: Math.round((done / items.length) * 100),
    missingRequired: items.filter((c) => c.required && !c.done).length,
  };
}
export type Readiness = ReturnType<typeof readiness>;
