import { useEffect, useState } from "react";

import { nameOf, useCatalog } from "~/shared/catalog/catalog";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { groupDigits } from "~/shared/lib/format";
import { Chip } from "~/shared/ui/Chip";
import { Select } from "~/shared/ui/Select";
import { Checkbox } from "~/shared/ui/Toggle";
import { multiValues, toggleMulti, withValue } from "./params";

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
 * The filter controls, used both in the desktop sidebar (changes apply at once) and in the
 * mobile sheet (changes collect in a draft until "Show results").
 */
export function Filters({ q, onChange }: { q: Record<string, string>; onChange: (next: Record<string, string>) => void }) {
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

  return (
    <div className="flex flex-col gap-6">
      <FilterGroup label={t("jobs.filters.category")}>
        <Select
          aria-label={t("jobs.filters.category")}
          value={q.category_id ?? ""}
          onValueChange={(v) => onChange(withValue(q, "category_id", v))}
          placeholder={t("jobs.filters.anyCategory")}
          groups={categoryGroups}
        />
      </FilterGroup>

      <FilterGroup label={t("jobs.filters.region")}>
        <Select
          aria-label={t("jobs.filters.region")}
          value={q.region_id ?? ""}
          onValueChange={(v) => onChange(withValue(q, "region_id", v))}
          placeholder={t("search.anywhere")}
          options={regions.map((r) => ({ value: String(r.id), label: nameOf(r.name, locale) }))}
        />
        {districts.length > 0 && (
          <Select
            className="mt-2"
            aria-label={nameOf(region?.name, locale)}
            value={q.district_id ?? ""}
            onValueChange={(v) => onChange(withValue(q, "district_id", v))}
            placeholder={t("jobs.filters.allIn", { name: nameOf(region?.name, locale) })}
            options={districts.map((d) => ({ value: String(d.id), label: nameOf(d.name, locale) }))}
          />
        )}
      </FilterGroup>

      <FilterGroup label={t("jobs.filters.salaryFrom")}>
        <SalaryInput value={q.salary_from ?? ""} onCommit={(v) => onChange(withValue(q, "salary_from", v))} />
        <div className="mt-3">
          <Checkbox
            checked={q.with_salary === "true"}
            onCheckedChange={(v) => onChange(withValue(q, "with_salary", v ? "true" : null))}
            label={t("jobs.filters.withSalary")}
          />
        </div>
      </FilterGroup>

      {(Object.keys(ENUMS) as (keyof typeof ENUMS)[]).map((key) => {
        const selected = multiValues(q, key);
        return (
          <FilterGroup key={key} label={t(LABEL[key])}>
            <div className="flex flex-wrap gap-2">
              {ENUMS[key].map((v) => (
                <Chip key={v} selected={selected.includes(v)} onClick={() => onChange(toggleMulti(q, key, v))}>
                  {t(`enums.${key}.${v}`)}
                </Chip>
              ))}
            </div>
          </FilterGroup>
        );
      })}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-semibold text-ink">{label}</legend>
      {children}
    </fieldset>
  );
}

/** Digits are grouped as you type ("5 000 000"); the filter applies on Enter or blur. */
function SalaryInput({ value, onCommit }: { value: string; onCommit: (v: string | null) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(value ? groupDigits(Number(value)) : "");
  useEffect(() => setText(value ? groupDigits(Number(value)) : ""), [value]);
  const commit = () => {
    const digits = text.replace(/\D/g, "");
    if (digits !== value) onCommit(digits || null);
  };
  return (
    <div className="relative flex items-center">
      <input
        inputMode="numeric"
        aria-label={t("jobs.filters.salaryFrom")}
        value={text}
        placeholder="3 000 000"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
          setText(digits ? groupDigits(Number(digits)) : "");
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="num h-11 w-full rounded-control border border-line-strong bg-surface pl-3.5 pr-14 text-[0.9375rem] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus:border-lapis focus:shadow-[0_0_0_4px_var(--lapis-soft)]"
      />
      <span className="pointer-events-none absolute right-3.5 text-sm text-ink-3">{t("salary.currency.UZS")}</span>
    </div>
  );
}
