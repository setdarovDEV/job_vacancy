import { BriefcaseBusiness, Building2, Clock, MapPin } from "lucide-react";
import { useMemo } from "react";

import type { Schemas } from "../api/client";
import { indexCatalog, nameOf, useCatalog } from "../catalog/catalog";
import { LocalizedLink, useLocale } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { salary } from "../lib/format";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { RelTime } from "../ui/RelTime";
import { Skeleton } from "../ui/Skeleton";
import { SaveButton } from "./SaveButton";

export type VacancyCard = Schemas["VacancyCard"];

/**
 * One vacancy in a list. The whole row is the link; the salary is set in the display face
 * because it's the first thing people compare.
 */
export function VacancyRow({ v, showStatus }: { v: VacancyCard; showStatus?: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const region = nameOf(idx.regions.get(v.district_id ?? v.region_id)?.name ?? idx.regions.get(v.region_id)?.name, locale);
  return (
    <article className="group relative flex gap-4 px-4 py-5 transition-colors hover:bg-sunken/60 sm:px-5">
      {v.is_featured && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-zafaron" aria-hidden="true" />}
      <Avatar name={v.company.name} src={v.company.logo_url} square size="md" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <h3 className="text-[1.0625rem] font-semibold leading-snug text-ink">
            <LocalizedLink to={`/vacancies/${v.slug}`} className="outline-none after:absolute after:inset-0 group-hover:text-lapis-ink focus-visible:underline">
              {v.title}
            </LocalizedLink>
          </h3>
          <p className="num shrink-0 font-display text-[1.0625rem] font-semibold tracking-[-0.02em] text-firuza-ink">
            {salary(v.salary, t, locale)}
          </p>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-ink-2">
          {v.company.name}
          {v.company.verified && <Badge tone="firuza" className="h-5 px-1.5">{t("common.verified")}</Badge>}
          {v.is_featured && <Badge tone="zafaron" className="h-5 px-1.5">{t("common.featured")}</Badge>}
          {showStatus && v.status !== "published" && <Badge tone="neutral" className="h-5 px-1.5">{t(`vacancyStatus.${v.status}`)}</Badge>}
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-3">
          {region && <li className="flex items-center gap-1.5"><MapPin className="size-4" />{region}</li>}
          <li className="flex items-center gap-1.5"><Building2 className="size-4" />{t(`enums.work_format.${v.work_format}`)}</li>
          <li className="flex items-center gap-1.5"><BriefcaseBusiness className="size-4" />{t(`enums.experience.${v.experience}`)}</li>
          {v.published_at && <li className="flex items-center gap-1.5"><Clock className="size-4" /><RelTime iso={v.published_at} /></li>}
        </ul>
        {v.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {v.skills.slice(0, 6).map((s) => <Badge key={s.id} tone="outline">{s.name}</Badge>)}
          </div>
        )}
      </div>
      <div className="relative z-10 -mr-2 -mt-1 self-start">
        <SaveButton id={v.id} />
      </div>
    </article>
  );
}

export function VacancyRowSkeleton() {
  return (
    <div className="flex gap-4 px-4 py-5 sm:px-5" aria-hidden="true">
      <Skeleton className="size-10 rounded-[28%]" />
      <div className="flex-1 space-y-2.5">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}
