import { BadgeCheck, ClipboardCheck } from "lucide-react";

import { AdminOnly } from "./admin-ui";
import { adminKeys } from "./keys";
import { AdminList, useCursorList } from "./list";
import { api, type Schemas } from "~/shared/api/client";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { relativeTime } from "~/shared/lib/format";
import { authedPage } from "~/shared/query/query";
import { Avatar } from "~/shared/ui/Avatar";
import { Button } from "~/shared/ui/Button";
import { PageHeader } from "~/shared/ui/Section";
import { useVacancyPlace } from "~/shared/vacancy/VacancyDetails";

type Vacancy = Schemas["VacancyCard"];

export default function ModerationQueue() {
  return <AdminOnly><Page /></AdminOnly>;
}

function Page() {
  const { t } = useTranslation();
  const list = useCursorList<Vacancy>(adminKeys.moderation(), (cursor) =>
    authedPage(() => api.GET("/admin/vacancies/moderation", { params: { query: { cursor } } })));
  return (
    <>
      <PageHeader title={t("admin.nav.moderation")} description={t("admin.moderationHint")} />
      <AdminList
        list={list}
        empty={{ icon: <ClipboardCheck className="size-6" />, title: t("admin.queueEmpty"), body: t("admin.queueEmptyBody") }}
        getKey={(v) => v.id}
        renderRow={(v) => <Row v={v} />}
      />
    </>
  );
}

function Row({ v }: { v: Vacancy }) {
  const { t } = useTranslation();
  const place = useVacancyPlace(v);
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
      <Avatar name={v.company.name} src={v.company.logo_url} square size="md" className="max-sm:hidden" />
      <div className="min-w-0 flex-1">
        <LocalizedLink to={`/admin/moderation/${v.id}`} className="font-semibold text-ink hover:text-lapis-ink">{v.title}</LocalizedLink>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">
          <span className="flex items-center gap-1 text-ink-2">
            {v.company.name}
            {v.company.verified && <BadgeCheck className="size-4 text-firuza" aria-label={t("common.verified")} />}
          </span>
          {place && <span>{place}</span>}
          <span>{t("admin.created", { when: relativeTime(v.created_at, t) })}</span>
        </p>
      </div>
      <Button asChild variant="secondary" size="sm">
        <LocalizedLink to={`/admin/moderation/${v.id}`}>{t("admin.review")}</LocalizedLink>
      </Button>
    </div>
  );
}
