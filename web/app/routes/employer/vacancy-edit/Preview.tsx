import {
  BadgeCheck, BriefcaseBusiness, Building2, CalendarDays, Check, CircleDashed, Clock3, House, Layers, MapPin,
} from "lucide-react";
import { useMemo, type ComponentType } from "react";

import type { EditorStep, Readiness as ReadinessData, VInput } from "./model";
import { GirihPattern } from "~/shared/brand/GirihPattern";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { salary } from "~/shared/lib/format";
import { RichText } from "~/shared/lib/markdown";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Card } from "~/shared/ui/Card";
import { Progress } from "~/shared/ui/Progress";

type PreviewCompany = { name: string; logo_url: string | null; verified: boolean };

const H = "font-display text-lg font-semibold tracking-heading text-ink md:text-xl";

/**
 * The vacancy as candidates will see it: the same header card (cover band, logo, title, salary,
 * facts grid) and description card as the public page, built from shared pieces only. It renders
 * the unsaved form, so nothing links anywhere yet.
 */
export function VacancyPreview({ f, company }: { f: VInput; company: PreviewCompany }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);

  const region = nameOf(idx.regions.get(f.region_id)?.name, locale);
  const district = f.district_id ? nameOf(idx.regions.get(f.district_id)?.name, locale) : "";
  const category = nameOf(idx.categories.get(f.category_id)?.name, locale);
  const place = [district, region].filter(Boolean).join(", ");
  const title = f.title.trim();
  const skills = f.skills ?? [];
  const address = f.address?.trim();
  const pay = { min: f.salary_min ?? null, max: f.salary_max ?? null, currency: f.currency };
  const hasPay = pay.min != null || pay.max != null;

  const WorkIcon = f.work_format === "remote" ? House : Building2;
  const facts: { id: string; Icon: ComponentType<{ className?: string }>; label: string; value: string }[] = [
    { id: "experience", Icon: BriefcaseBusiness, label: t("jobs.filters.experience"), value: t(`enums.experience.${f.experience}`) },
    { id: "employment", Icon: Clock3, label: t("jobs.filters.employment"), value: t(`enums.employment_type.${f.employment_type}`) },
    { id: "schedule", Icon: CalendarDays, label: t("jobs.filters.schedule"), value: t(`enums.schedule.${f.schedule}`) },
    { id: "format", Icon: WorkIcon, label: t("jobs.filters.format"), value: t(`enums.work_format.${f.work_format}`) },
    ...(place ? [{ id: "place", Icon: MapPin, label: t("jobs.filters.region"), value: place }] : []),
    ...(category ? [{ id: "category", Icon: Layers, label: t("jobs.filters.category"), value: category }] : []),
  ];
  // Hairline grid: the last cell stretches over what is left of its row (2 columns, 3 from md).
  const n = facts.length;
  const lastSpan = cn(n % 2 === 1 && "col-span-2", n % 3 === 1 ? "md:col-span-3" : n % 3 === 2 ? "md:col-span-2" : "md:col-span-1");

  return (
    <article aria-labelledby="preview-title" className="flex min-w-0 flex-col gap-6">
      <Card as="header" radius="sheet" padding="lg" className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40">
          <div className="aurora-hero aurora-fade absolute inset-0 opacity-70" />
          <GirihPattern reveal={false} focus="ellipse 55% 100% at 88% 0%" />
        </div>

        <div className="flex items-center gap-4">
          <Avatar name={company.name} src={company.logo_url} square size="lg" className="shadow-2" />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5 text-md font-medium text-ink">
              <span className="truncate">{company.name}</span>
              {company.verified && (
                <>
                  <BadgeCheck aria-hidden="true" className="size-4.5 shrink-0 fill-firuza text-surface" />
                  <span className="sr-only">{t("common.verified")}</span>
                </>
              )}
            </p>
            {place && <p className="mt-0.5 truncate text-sm text-ink-2">{place}</p>}
          </div>
        </div>

        <h3
          id="preview-title"
          className={cn(
            "mt-5 text-balance break-words font-display text-2xl font-semibold tracking-heading md:text-3xl",
            title ? "text-ink" : "text-ink-3",
          )}
        >
          {title || t("employer.vacancyTitle")}
        </h3>

        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span
            className={
              hasPay
                ? "num font-display text-2xl font-semibold tracking-heading text-firuza-ink md:text-3xl"
                : "text-lead font-medium text-ink-2"
            }
          >
            {salary(pay, t, locale)}
          </span>
          {hasPay && <span className="text-md text-ink-2">{t("vacancyPage.perMonth")}</span>}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-3">
          {facts.map((fact, i) => (
            <div
              key={fact.id}
              className={cn("flex min-w-0 flex-col gap-2 bg-surface p-3.5 sm:flex-row sm:gap-3 sm:p-4", i === n - 1 && lastSpan)}
            >
              <fact.Icon aria-hidden="true" className="size-5 shrink-0 text-lapis sm:mt-0.5" />
              <div className="min-w-0">
                <dt className="text-xs text-ink-2">{fact.label}</dt>
                <dd className="mt-0.5 break-words text-md font-medium text-ink">{fact.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Card>

      <Card as="section" radius="sheet" padding="lg" aria-labelledby="preview-about">
        <h3 id="preview-about" className={H}>{t("jobs.description")}</h3>
        {f.description.trim() ? (
          <RichText text={f.description} className="rich-text mt-4" />
        ) : (
          <p className="mt-4 text-md text-ink-2">{t("vacancyEditor.previewEmpty")}</p>
        )}

        {skills.length > 0 && (
          <section aria-labelledby="preview-skills" className="mt-8 border-t border-line pt-6">
            <h3 id="preview-skills" className={H}>{t("jobs.skills")}</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {skills.map((s) => (
                <li key={s} className="flex max-w-full">
                  <Badge tone="outline" className="h-9 bg-surface px-3.5 text-sm font-medium text-ink">{s}</Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

        {address && (
          <section aria-labelledby="preview-address" className="mt-8 border-t border-line pt-6">
            <h3 id="preview-address" className={H}>{t("jobs.address")}</h3>
            <div className="mt-4 flex items-start gap-3">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-control bg-lapis-soft text-lapis">
                <MapPin className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-md font-medium text-ink">{address}</p>
                {place && <p className="mt-0.5 break-words text-sm text-ink-2">{place}</p>}
              </div>
            </div>
          </section>
        )}
      </Card>
    </article>
  );
}

/** How complete the vacancy is, with a jump to every part that is still missing. */
export function Readiness({ data, onGo }: { data: ReadinessData; onGo: (s: EditorStep) => void }) {
  const { t } = useTranslation();
  const missing = data.items.filter((c) => !c.done);
  return (
    <Card>
      <Progress
        value={data.percent}
        label={t("vacancyEditor.readiness")}
        tone={data.percent === 100 ? "firuza" : "lapis"}
        showValue
      />
      {missing.length ? (
        <ul className={cn("-mx-2 mt-3 grid gap-x-4", missing.length > 2 && "sm:grid-cols-2")}>
          {missing.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onGo(c.step)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-control px-2 text-start text-md transition-[background-color,scale] duration-150 hover:bg-sunken active:scale-[0.98]"
              >
                <CircleDashed aria-hidden="true" className={cn("size-4.5 shrink-0", c.required ? "text-anor" : "text-ink-3")} />
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="break-words text-ink">{t(`vacancyEditor.check.${c.id}`)}</span>
                  <Badge tone={c.required ? "anor" : "neutral"}>
                    {c.required ? t("vacancyEditor.required") : t("vacancyEditor.recommended")}
                  </Badge>
                </span>
                <span className="shrink-0 text-sm font-medium text-lapis-ink">{t("vacancyEditor.fill")}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-md text-ink-2">
          <Check aria-hidden="true" className="size-4.5 shrink-0 text-firuza" />
          {t("vacancyEditor.readyAll")}
        </p>
      )}
    </Card>
  );
}
