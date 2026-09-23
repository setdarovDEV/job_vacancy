import { useInfiniteQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { useState } from "react";

import { SeekerOnly } from "./layout";
import { api, type Schemas } from "~/shared/api/client";
import { STATUSES, StatusBadge } from "~/shared/application/status";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { relativeTime } from "~/shared/lib/format";
import { authedPage } from "~/shared/query/query";
import { LoadMore } from "~/shared/query/LoadMore";
import { Avatar } from "~/shared/ui/Avatar";
import { Button } from "~/shared/ui/Button";
import { Chip } from "~/shared/ui/Chip";
import { EmptyState } from "~/shared/ui/EmptyState";
import { PageHeader } from "~/shared/ui/Section";
import { Skeleton } from "~/shared/ui/Skeleton";

type App = Schemas["Application"];

export default function Applications() {
  return <SeekerOnly><List /></SeekerOnly>;
}

function List() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | null>(null);
  const q = useInfiniteQuery({
    queryKey: ["my-applications", status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      authedPage<App>(() => api.GET("/me/applications", { params: { query: { status: (status ?? undefined) as never, cursor: pageParam } } })),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <>
      <PageHeader title={t("nav.applications")} description={t("applications.hint")} />
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <Chip selected={status === null} onClick={() => setStatus(null)}>{t("applications.all")}</Chip>
        {STATUSES.map((s) => (
          <Chip key={s} className="shrink-0" selected={status === s} onClick={() => setStatus(s)}>{t(`enums.application_status.${s}`)}</Chip>
        ))}
      </div>
      {q.isPending ? (
        <div className="flex flex-col gap-2"><Skeleton className="h-24 rounded-panel" /><Skeleton className="h-24 rounded-panel" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface">
          <EmptyState
            icon={<Inbox className="size-6" />}
            title={status ? t("applications.emptyFiltered") : t("applications.emptyTitle")}
            body={status ? undefined : t("applications.emptyBody")}
            action={!status && <Button asChild><LocalizedLink to="/vacancies">{t("nav.vacancies")}</LocalizedLink></Button>}
          />
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
          {items.map((a) => (
            <li key={a.id}>
              <LocalizedLink to={`/me/applications/${a.id}`} className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-sunken/60 sm:px-5">
                <Avatar name={a.vacancy?.company.name ?? "?"} src={a.vacancy?.company.logo_url} square />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{a.vacancy?.title}</p>
                  <p className="truncate text-sm text-ink-2">{a.vacancy?.company.name}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusBadge status={a.status ?? "sent"} />
                  <span className="text-xs text-ink-3">{relativeTime(a.status_changed_at ?? a.created_at ?? "", t)}</span>
                </div>
              </LocalizedLink>
            </li>
          ))}
        </ul>
      )}
      <LoadMore hasNext={q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />
    </>
  );
}
