import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, BriefcaseBusiness, CheckCheck, CircleX, Inbox, Send, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";

import { api } from "~/shared/api/client";
import { localizedPath } from "~/shared/i18n/config";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation, type TFunction } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { relativeTime } from "~/shared/lib/format";
import { authed, authedPage } from "~/shared/query/query";
import { LoadMore } from "~/shared/query/LoadMore";
import { Button } from "~/shared/ui/Button";
import { EmptyState } from "~/shared/ui/EmptyState";
import { PageHeader } from "~/shared/ui/Section";
import { Skeleton } from "~/shared/ui/Skeleton";

export type Notification = {
  id: number;
  type: string;
  payload: Record<string, string | number | undefined>;
  read_at: string | null;
  created_at: string;
};

/** Title, target page and icon of a notification, rendered in the UI language. */
export function describe(n: Notification, t: TFunction) {
  const p = n.payload;
  const v = { vacancy: String(p.vacancy_title ?? ""), company: String(p.company_name ?? ""), candidate: String(p.candidate_name ?? ""),
    status: p.status ? t(`enums.application_status.${p.status}`).toLowerCase() : "", reason: String(p.reason ?? ""),
    search: String(p.search_name ?? ""), count: Number(p.count ?? 0) };
  switch (n.type) {
    case "application.new": return { title: t("notif.applicationNew", v), to: `/employer/applications/${p.application_id}`, Icon: Inbox };
    case "application.status": return { title: t("notif.applicationStatus", v), to: `/me/applications/${p.application_id}`, Icon: BriefcaseBusiness };
    case "application.invited": return { title: t("notif.applicationInvited", v), to: `/me/applications/${p.application_id}`, Icon: Send };
    case "vacancy.approved": return { title: t("notif.vacancyApproved", v), to: `/vacancies/${p.vacancy_id}`, Icon: Sparkles };
    case "vacancy.rejected": return { title: t("notif.vacancyRejected", v), body: v.reason, to: `/employer/vacancies/${p.vacancy_id}/edit`, Icon: CircleX };
    case "search.alert": return { title: t("notif.searchAlert", v), body: String(p.preview ?? ""), to: `/me/searches`, Icon: BellRing };
    default: return { title: n.type, to: "/me/notifications", Icon: Bell };
  }
}

export default function Notifications() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ["notifications"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => authedPage<Notification>(() => api.GET("/me/notifications", { params: { query: { cursor: pageParam } } })),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
  const read = useMutation({
    mutationFn: (ids: number[]) => authed(() => api.POST("/me/notifications/read", { body: { ids } })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      window.dispatchEvent(new Event("jv:unread"));
    },
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  const unread = items.some((n) => !n.read_at);

  return (
    <>
      <PageHeader
        title={t("account.notifications")}
        actions={unread && <Button variant="ghost" size="sm" icon={<CheckCheck className="size-4" />} onClick={() => read.mutate([])}>{t("notif.markAll")}</Button>}
      />
      {q.isPending ? (
        <div className="flex flex-col gap-2"><Skeleton className="h-20 rounded-panel" /><Skeleton className="h-20 rounded-panel" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface"><EmptyState icon={<Bell className="size-6" />} title={t("notif.emptyTitle")} body={t("notif.emptyBody")} /></div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
          {items.map((n) => {
            const d = describe(n, t);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read_at) read.mutate([n.id]);
                    navigate(localizedPath(locale, d.to));
                  }}
                  className={cn("flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-sunken/60 sm:px-5", !n.read_at && "bg-lapis-soft/35")}
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", n.read_at ? "bg-sunken text-ink-3" : "bg-lapis-soft text-lapis-ink")}>
                    <d.Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[0.9375rem]", n.read_at ? "text-ink-2" : "font-medium text-ink")}>{d.title}</span>
                    {d.body && <span className="mt-1 line-clamp-2 block whitespace-pre-line text-sm text-ink-3">{d.body}</span>}
                    <span className="mt-1 block text-xs text-ink-3">{relativeTime(n.created_at, t)}</span>
                  </span>
                  {!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-lapis" aria-label={t("notif.unread")} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <LoadMore hasNext={q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} />
    </>
  );
}
