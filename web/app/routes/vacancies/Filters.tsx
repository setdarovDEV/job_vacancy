import type { ReactNode } from "react";

import { nameOf, useCatalog } from "~/shared/catalog/catalog";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { Chip } from "~/shared/ui/Chip";
import { Field } from "~/shared/ui/Field";
import { MoneyInput } from "~/shared/ui/MoneyInput";
import { Select } from "~/shared/ui/Select";
import { Checkbox } from "~/shared/ui/Toggle";
import { multiValues, toggleMulti, withValue, type Query } from "./params";

const ENUMS = {
  work_format: ["office", "remote", "hybrid"],
  employment_type: ["full_time", "part_time", "project", "internship", "volunteer"],
  experience: ["none", "1_3", "3_6", "6_plus"],
  schedule: ["full_day", "shift", "flexible", "rotation"],
} as const;

const LABEL: Record<keyof typeof ENUMS, string> = {
  work_format: "jobs.filters.format",
  employment_type: "jobs.filters.employment",
  experience: "jobs.filters.experience",
  schedule: "jobs.filters.schedule",
};

/**
 * The filter controls, used both in the desktop sidebar (every change applies at once) and in
 * the mobile sheet (`draft`: changes collect until "Show results", so the salary field reports
 * every keystroke instead of waiting for blur/Enter).
 */
export function Filters({
  q, onChange, draft,
}: { q: Query; onChange: (next: Query) => void; draft?: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { categories, regions } = useCatalog();

  const categoryGroups = categories.map((c) => ({
    label: nameOf(c.name, locale),
    options: [
      { value: String(c.id), label: t("jobs.filters.allIn", { name: nameOf(c.name, locale) }) },
      ...(c.children ?? []).map((ch) => ({ value: String(ch.id), label: nameOf(ch.name, locale) })),
    ],
  }));
  const region = regions.find((r) => String(r.id) === q.region_id);
  const districts = region?.children ?? [];
  const salaryFrom = q.salary_from ? Number(q.salary_from) : null;
  const setSalary = (v: number | null) => onChange(withValue(q, "salary_from", v == null ? null : String(v)));

  return (
    <div className="flex flex-col">
      <Group>
        <Field label={t("jobs.filters.category")}>
          <Select
            value={q.category_id ?? ""}
            onValueChange={(v) => onChange(withValue(q, "category_id", v))}
            placeholder={t("jobs.filters.anyCategory")}
            groups={categoryGroups}
          />
        </Field>
      </Group>

      <Group>
        <Field label={t("jobs.filters.region")}>
          <Select
            value={q.region_id ?? ""}
            onValueChange={(v) => onChange(withValue(q, "region_id", v))}
            placeholder={t("search.anywhere")}
            options={regions.map((r) => ({ value: String(r.id), label: nameOf(r.name, locale) }))}
          />
        </Field>
        {districts.length > 0 && (
          <Select
            className="mt-2"
            aria-label={t("vacanciesPage.district", { region: nameOf(region?.name, locale) })}
            value={q.district_id ?? ""}
            onValueChange={(v) => onChange(withValue(q, "district_id", v))}
            placeholder={t("jobs.filters.allIn", { name: nameOf(region?.name, locale) })}
            options={districts.map((d) => ({ value: String(d.id), label: nameOf(d.name, locale) }))}
          />
        )}
      </Group>

      <Group>
        <Field label={t("jobs.filters.salaryFrom")}>
          {draft ? (
            <MoneyInput value={salaryFrom} onChange={setSalary} placeholder="3 000 000" />
          ) : (
            // Uncontrolled: typing doesn't refetch; the filter applies on Enter or blur. Keyed so a
            // chip removal or the back button resets the text.
            <MoneyInput key={q.salary_from ?? ""} defaultValue={salaryFrom} onCommit={setSalary} placeholder="3 000 000" />
          )}
        </Field>
        <div className="mt-2">
          <Checkbox
            checked={q.with_salary === "true"}
            onCheckedChange={(v) => onChange(withValue(q, "with_salary", v ? "true" : null))}
            label={t("jobs.filters.withSalary")}
          />
        </div>
      </Group>

      {(Object.keys(ENUMS) as (keyof typeof ENUMS)[]).map((key) => {
        const selected = multiValues(q, key);
        return (
          <Group key={key} legend={t(LABEL[key])}>
            <div className="flex flex-wrap gap-2">
              {ENUMS[key].map((v) => (
                <Chip key={v} selected={selected.includes(v)} onClick={() => onChange(toggleMulti(q, key, v))}>
                  {t(`enums.${key}.${v}`)}
                </Chip>
              ))}
            </div>
          </Group>
        );
      })}
    </div>
  );
}

/** One filter section; hairlines between sections keep a long panel scannable. */
function Group({ legend, children }: { legend?: string; children: ReactNode }) {
  const cls = "min-w-0 border-t border-line py-5 first:border-t-0 first:pt-0 last:pb-0";
  // A floated legend is laid out like a normal heading, so the hairline above stays unbroken.
  if (!legend) return <div className={cls}>{children}</div>;
  return (
    <fieldset className={cls}>
      <legend className="float-left mb-2.5 w-full text-sm font-medium text-ink">{legend}</legend>
      <div className="clear-left">{children}</div>
    </fieldset>
  );
}
