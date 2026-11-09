import { BriefcaseBusiness, Building2, CalendarClock, MapPin, Tag } from "lucide-react";
import { useMemo } from "react";

import type { Schemas } from "~/shared/api/client";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { salary } from "~/shared/lib/format";
import { RichText } from "~/shared/lib/markdown";

/**
 * The parts of a vacancy that read the same wherever it's shown: the public page and the
 * admin moderation preview. Each caller adds its own header and actions around them.
 */
type Vacancy = Schemas["VacancyDetail"];
/** The catalog references every vacancy shape (card or detail) carries. */
type Located = Pick<Schemas["VacancyCard"], "category_id" | "region_id" | "district_id">;

function useCatalogNames(v: Located) {
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const region = nameOf(idx.regions.get(v.region_id)?.name, locale);
  const district = v.district_id ? nameOf(idx.regions.get(v.district_id)?.name, locale) : "";
  return {
    category: nameOf(idx.categories.get(v.category_id)?.name, locale),
    place: [district, region].filter(Boolean).join(", "),
  };
}

/** "District, Region" in the current language. */
export function useVacancyPlace(v: Located): string {
  return useCatalogNames(v).place;
}

/** Salary line and the key facts (category, place, format, experience, employment). */
export function VacancyFacts({ v }: { v: Vacancy }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { category, place } = useCatalogNames(v);
  return (
    <>
      <p className="num mt-6 font-display text-2xl font-semibold tracking-[-0.03em] text-firuza-ink md:text-3xl">{salary(v.salary, t, locale)}</p>

      <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {category && <Fact icon={<Tag />} label={t("jobs.filters.category")}>{category}</Fact>}
        {place && <Fact icon={<MapPin />} label={t("jobs.filters.region")}>{place}</Fact>}
        <Fact icon={<Building2 />} label={t("jobs.filters.format")}>{t(`enums.work_format.${v.work_format}`)}</Fact>
        <Fact icon={<BriefcaseBusiness />} label={t("jobs.filters.experience")}>{t(`enums.experience.${v.experience}`)}</Fact>
        <Fact icon={<CalendarClock />} label={t("jobs.filters.employment")}>
          {t(`enums.employment_type.${v.employment_type}`)}, {t(`enums.schedule.${v.schedule}`).toLowerCase()}
        </Fact>
      </dl>
    </>
  );
}

/** Description, skills and address. */
export function VacancyContent({ v }: { v: Vacancy }) {
  const { t } = useTranslation();
  const { place } = useCatalogNames(v);
  return (
    <>
      <section className="mt-8 px-1" aria-labelledby="about-job">
        <h2 id="about-job" className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">{t("jobs.description")}</h2>
        <RichText text={v.description} className="mt-4 max-w-[68ch] space-y-4 text-[1.0625rem] leading-relaxed text-ink-2" />
      </section>

      {v.skills.length > 0 && (
        <section className="mt-10 px-1" aria-labelledby="job-skills">
          <h2 id="job-skills" className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">{t("jobs.skills")}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {v.skills.map((s) => (
              <li key={s.id}>
                <LocalizedLink
                  to={`/vacancies?q=${encodeURIComponent(s.name)}`}
                  className="inline-flex h-9 items-center rounded-full border border-line-strong bg-surface px-3.5 text-sm text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
                >
                  {s.name}
                </LocalizedLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {v.address && (
        <section className="mt-10 px-1" aria-labelledby="job-address">
          <h2 id="job-address" className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">{t("jobs.address")}</h2>
          <p className="mt-3 flex items-start gap-2 text-ink-2">
            <MapPin className="mt-0.5 size-4.5 shrink-0 text-ink-3" />
            <a
              className="hover:text-lapis-ink hover:underline"
              href={`https://yandex.uz/maps/?text=${encodeURIComponent(`${v.address}, ${place}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {v.address}
            </a>
          </p>
        </section>
      )}
    </>
  );
}

function Fact({ icon, label, children }: { icon: React.ReactElement; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sunken text-ink-3 [&>svg]:size-4" aria-hidden="true">{icon}</span>
      <div>
        <dt className="sr-only">{label}</dt>
        <dd className="text-ink">{children}</dd>
      </div>
    </div>
  );
}
