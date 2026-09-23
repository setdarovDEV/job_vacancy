import { useInfiniteQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";

import { SeekerOnly } from "./layout";
import { api, type Schemas } from "~/shared/api/client";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { authedPage } from "~/shared/query/query";
import { LoadMore } from "~/shared/query/LoadMore";
import { VacancyRow, VacancyRowSkeleton } from "~/shared/vacancy/VacancyRow";
import { Button } from "~/shared/ui/Button";
import { EmptyState } from "~/shared/ui/EmptyState";
import { PageHeader } from "~/shared/ui/Section";

export default function Saved() {
  return <SeekerOnly><List /></SeekerOnly>;
}

function List() {
  const { t } = useTranslation();
  const q = useInfiniteQuery({
    queryKey: ["saved-vacancies"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => authedPage<Schemas["VacancyCard"]>(() => api.GET("/me/saved-vacancies", { params: { query: { cursor: pageParam } } })),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <>
      <PageHeader title={t("nav.saved")} description={t("savedPage.hint")} />
      {q.isPending ? (
        <div className="divide-y divide-line rounded-panel border border-line bg-surface"><VacancyRowSkeleton /><VacancyRowSkeleton /></div>
      ) : items.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface">
          <EmptyState icon={<Heart className="size-6" />} title={t("savedPage.emptyTitle")} body={t("savedPage.emptyBody")}
            action={<Button asChild><LocalizedLink to="/vacancies">{t("nav.vacancies")}</LocalizedLink></Button>} />
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
          {items.map((v) => <VacancyRow key={v.id} v={v} showStatus />)}
        </div>
      )}
      <LoadMore hasNext={q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />
    </>
  );
}
