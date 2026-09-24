import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Check, X } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import type { QueueVacancy } from "./useModeration";
import { api, type Schemas } from "~/shared/api/client";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { salary } from "~/shared/lib/format";
import { RichText } from "~/shared/lib/markdown";
import { authed } from "~/shared/query/query";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Callout } from "~/shared/ui/Callout";
import { Card } from "~/shared/ui/Card";
import { DialogRoot, SheetContent } from "~/shared/ui/Dialog";
import { ErrorState } from "~/shared/ui/ErrorState";
import { RelTime } from "~/shared/ui/RelTime";
import { SkeletonDelay, SkeletonText, useSkeletonHold } from "~/shared/ui/Skeleton";

type Detail = Schemas["VacancyDetail"];

/**
 * The vacancy as the moderator needs it: the queue row's facts at once, the description (and
 * submission time) from the full record. The public page can't show it: an unpublished vacancy
 * is rendered on the server without the admin's token and would be a 404 there.
 */
export default function VacancyPreview({ vacancy: v, open, onOpenChange, onApprove, onReject }: {
  vacancy: QueueVacancy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  // Same key as the employer pages' vacancy cache, so a decision here refreshes those too.
  const q = useQuery({
    queryKey: ["vacancy", v.id],
    queryFn: () => authed<Detail>(() => api.GET("/vacancies/{vacancy}", { params: { path: { vacancy: v.id } } })),
    staleTime: 30_000,
    enabled: open,
  });
  const loading = useSkeletonHold(q.isPending);
  // Another moderator may have decided while this was open.
  const handled = q.data && q.data.status !== "moderation" ? q.data.status : null;

  const region = [idx.regions.get(v.region_id), v.district_id != null ? idx.regions.get(v.district_id) : undefined]
    .filter(Boolean)
    .map((r) => nameOf(r!.name, locale))
    .join(", ");
  const hasPay = v.salary != null && (v.salary.min != null || v.salary.max != null);

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={v.title}
        description={
          <>
            {v.company.name}
            {v.company.verified ? (
              <BadgeCheck role="img" aria-label={t("common.verified")} className="ml-1 inline-block size-4 align-middle text-firuza" />
            ) : (
              <span className="text-ink-3"> · {t("adminPage.unverifiedCompany")}</span>
            )}
          </>
        }
        closeLabel={t("common.close")}
        footer={
          <>
            <Button type="button" variant="secondary" icon={<X className="size-4.5" />} className="flex-1" disabled={!!handled} onClick={onReject}>
              {t("adminPage.reject")}
            </Button>
            <Button type="button" icon={<Check className="size-4.5" />} className="flex-1" disabled={!!handled} onClick={onApprove}>
              {t("adminPage.approve")}
            </Button>
          </>
        }
      >
        {handled && (
          <Callout tone="warning" role="status" className="mb-5" title={t("adminPage.handled")}>
            {t(`vacancyStatus.${handled}`)}
          </Callout>
        )}

        <p className="text-sm text-ink-2">{t("adminPage.facts.salary")}</p>
        <p className={cn("mt-0.5", hasPay ? "num font-display text-xl font-semibold tracking-heading text-firuza-ink" : "text-lead text-ink")}>
          {salary(v.salary, t, locale)}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
          <Fact label={t("adminPage.facts.category")}>{nameOf(idx.categories.get(v.category_id)?.name, locale) || "—"}</Fact>
          <Fact label={t("adminPage.facts.region")}>{region || "—"}</Fact>
          <Fact label={t("adminPage.facts.employment")}>{t(`enums.employment_type.${v.employment_type}`)}</Fact>
          <Fact label={t("adminPage.facts.format")}>{t(`enums.work_format.${v.work_format}`)}</Fact>
          <Fact label={t("adminPage.facts.experience")}>{t(`enums.experience.${v.experience}`)}</Fact>
          <Fact label={t("adminPage.facts.schedule")}>{t(`enums.schedule.${v.schedule}`)}</Fact>
          <Fact label={t("adminPage.facts.created")}><RelTime iso={v.created_at} /></Fact>
          <Fact label={t("adminPage.facts.submitted")}>
            {q.data?.submitted_at ? <RelTime iso={q.data.submitted_at} /> : <span className="text-ink-3">—</span>}
          </Fact>
        </dl>

        {v.skills.length > 0 && (
          <section aria-labelledby="preview-skills" className="mt-6">
            <h3 id="preview-skills" className="text-sm font-medium text-ink-2">{t("adminPage.facts.skills")}</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {v.skills.map((s) => <li key={s.id} className="min-w-0 max-w-full"><Badge>{s.name}</Badge></li>)}
            </ul>
          </section>
        )}

        <section aria-labelledby="preview-description" className="mt-6">
          <h3 id="preview-description" className="text-sm font-medium text-ink-2">{t("adminPage.facts.description")}</h3>
          {/* Long text reads on a solid surface, not on the sheet's glass. */}
          <Card padding="sm" className="mt-2" aria-busy={loading || undefined}>
            {loading ? (
              <SkeletonDelay>
                <SkeletonText lines={5} />
              </SkeletonDelay>
            ) : q.isError ? (
              <ErrorState compact error={q.error} onRetry={() => q.refetch()} />
            ) : q.data ? (
              <>
                <RichText text={q.data.description} className="rich-text text-md" />
                {q.data.address && (
                  <p className="mt-4 border-t border-line pt-3 text-sm text-ink-2">
                    <span className="font-medium text-ink">{t("adminPage.facts.address")}:</span> {q.data.address}
                  </p>
                )}
              </>
            ) : null}
          </Card>
        </section>
      </SheetContent>
    </DialogRoot>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="mt-0.5 break-words text-md text-ink">{children}</dd>
    </div>
  );
}
