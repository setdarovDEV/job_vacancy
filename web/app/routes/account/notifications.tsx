import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import {
  BadgeCheck, Bell, BellRing, BriefcaseBusiness, CheckCheck, CircleX, Eye, Handshake, Inbox, PartyPopper, Settings, type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";

import { api } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation, type TFunction } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { clock, dayLabel } from "~/shared/lib/format";
import { ApiFailure, authed, authedPage, type Page } from "~/shared/query/query";
import { LoadMore } from "~/shared/query/LoadMore";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { absoluteDate, RelTime } from "~/shared/ui/RelTime";
import { PageHeader } from "~/shared/ui/Section";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";

export type Notification = {
  id: number;
  type: string;
  payload: Record<string, string | number | undefined>;
  read_at: string | null;
  created_at: string;
};

type Tone = "lapis" | "firuza" | "zafaron" | "anor" | "neutral";
const tiles: Record<Tone, string> = {
  lapis: "bg-lapis-soft text-lapis-ink",
  firuza: "bg-firuza-soft text-firuza-ink",
  zafaron: "bg-zafaron-soft text-zafaron-ink",
  anor: "bg-anor-soft text-anor-ink",
  neutral: "bg-sunken text-ink-2",
};

/** Title, target page, icon and tint of a notification, rendered in the UI language. */
export function describe(n: Notification, t: TFunction): { title: string; body?: string; to: string; Icon: LucideIcon; tone: Tone } {
  const p = n.payload;
  const v = { vacancy: String(p.vacancy_title ?? ""), company: String(p.company_name ?? ""), candidate: String(p.candidate_name ?? ""),
    status: p.status ? t(`enums.application_status.${p.status}`).toLowerCase() : "", reason: String(p.reason ?? ""),
    search: String(p.search_name ?? ""), count: Number(p.count ?? 0) };
  switch (n.type) {
    case "application.new": return { title: t("notif.applicationNew", v), to: `/employer/applications/${p.application_id}`, Icon: Inbox, tone: "lapis" };
    case "application.status": {
      const s = String(p.status ?? "");
      const [Icon, tone]: [LucideIcon, Tone] =
        s === "rejected" ? [CircleX, "anor"] : s === "hired" ? [PartyPopper, "firuza"] : s === "viewed" ? [Eye, "lapis"]
        : s === "invited" || s === "interview" ? [Handshake, "firuza"] : [BriefcaseBusiness, "lapis"];
      return { title: t("notif.applicationStatus", v), to: `/me/applications/${p.application_id}`, Icon, tone };
    }
    case "application.invited": return { title: t("notif.applicationInvited", v), to: `/me/applications/${p.application_id}`, Icon: Handshake, tone: "firuza" };
    case "vacancy.approved": return { title: t("notif.vacancyApproved", v), to: `/vacancies/${p.vacancy_id}`, Icon: BadgeCheck, tone: "firuza" };
    case "vacancy.rejected": return { title: t("notif.vacancyRejected", v), body: v.reason, to: `/employer/vacancies/${p.vacancy_id}/edit`, Icon: CircleX, tone: "anor" };
    case "search.alert": return { title: t("notif.searchAlert", v), body: String(p.preview ?? ""), to: `/me/searches`, Icon: BellRing, tone: "zafaron" };
    default: return { title: n.type, to: "/me/notifications", Icon: Bell, tone: "neutral" };
  }
}

type Data = InfiniteData<Page<Notification>, string | undefined>;
const KEY = ["notifications"];

// Local calendar day, so "Bugun" / "Kecha" match the viewer's clock.
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export default function Notifications() {
  const { t } = useTranslation();
  const locale = useLocale();
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: KEY,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => authedPage<Notification>(() => api.GET("/me/notifications", { params: { query: { cursor: pageParam } } })),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
  const loading = useSkeletonHold(q.isPending);

  // Optimistic: rows lose their tint at once (an empty list means "all"); a failure restores them.
  const read = useMutation({
    mutationFn: (ids: number[]) => authed(() => api.POST("/me/notifications/read", { body: { ids } })),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Data>(KEY);
      const at = new Date().toISOString();
      qc.setQueryData<Data>(KEY, (d) =>
        d && {
          ...d,
          pages: d.pages.map((p) => ({
            ...p,
            data: p.data.map((n) => (!n.read_at && (!ids.length || ids.includes(n.id)) ? { ...n, read_at: at } : n)),
          })),
        },
      );
      return { prev };
    },
    onError: (e, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
      toast({ tone: "error", title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network") });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      window.dispatchEvent(new Event("jv:unread"));
    },
  });

  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  const groups: { key: string; label: string; today: boolean; items: Notification[] }[] = [];
  for (const n of items) {
    const key = dayKey(n.created_at);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(n);
    else groups.push({ key, label: dayLabel(n.created_at, t, locale), today: key === dayKey(new Date().toISOString()), items: [n] });
  }

  const entered = useRef(false);
  useEffect(() => {
    if (q.data) entered.current = true;
  }, [q.data]);
  const enter = !entered.current;
  let row = 0;

  return (
    <>
      <PageHeader
        title={t("account.notifications")}
        description={unread > 0 ? t("accountPage.unreadCount", { count: unread }) : t("accountPage.notifHint")}
        actions={
          unread > 0 && (
            <Button variant="secondary" icon={<CheckCheck className="size-4.5" />} onClick={() => read.mutate([])}>
              {t("notif.markAll")}
            </Button>
          )
        }
      />
      {loading ? (
        <SkeletonDelay>
          <NotificationSkeleton />
        </SkeletonDelay>
      ) : q.isError && !items.length ? (
        <Card padding="none">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Card>
      ) : items.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<Bell />}
            title={t("notif.emptyTitle")}
            body={t("notif.emptyBody")}
            action={
              <Button asChild variant="secondary" icon={<Settings className="size-4.5" />}>
                <LocalizedLink to="/me#notifications">{t("accountPage.notifSettings")}</LocalizedLink>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`day-${g.key}`}>
              <h2 id={`day-${g.key}`} className="mb-2.5 px-1 text-xs font-semibold uppercase tracking-caps text-ink-2">{g.label}</h2>
              <Card as="ul" padding="none" className="divide-y divide-line overflow-hidden">
                {g.items.map((n) => {
                  const i = row++;
                  return (
                    <NotificationRow
                      key={n.id}
                      n={n}
                      today={g.today}
                      onOpen={() => !n.read_at && read.mutate([n.id])}
                      className={enter && i < 8 ? "anim-enter" : undefined}
                      style={enter ? ({ "--i": i } as CSSProperties) : undefined}
                    />
                  );
                })}
              </Card>
            </section>
          ))}
        </div>
      )}
      <LoadMore hasNext={q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} loadedCount={items.length} className="mt-4" />
    </>
  );
}

function NotificationRow({ n, today, onOpen, className, style }: {
  n: Notification; today: boolean; onOpen: () => void; className?: string; style?: CSSProperties;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const d = describe(n, t);
  const unread = !n.read_at;
  return (
    <li className={className} style={style}>
      <LocalizedLink
        to={d.to}
        prefetch="intent"
        onClick={onOpen}
        className={cn(
          "flex items-start gap-3.5 px-4 py-4 transition-colors duration-150 hover:bg-sunken/60 focus-visible:-outline-offset-2 sm:px-5",
          unread && "bg-lapis-soft/40",
        )}
      >
        <span aria-hidden="true" className={cn("grid size-10 shrink-0 place-items-center rounded-full", unread ? tiles[d.tone] : tiles.neutral)}>
          <d.Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className={cn("block break-words text-md", unread ? "font-semibold text-ink" : "text-ink-2")}>{d.title}</span>
          {d.body && <span className="mt-1 line-clamp-2 block whitespace-pre-line break-words text-sm text-ink-2">{d.body}</span>}
          {/* Today: "5 daqiqa oldin"; older days already have their date in the heading. */}
          {today ? (
            <RelTime iso={n.created_at} className="num mt-1 block text-sm text-ink-2" />
          ) : (
            <time dateTime={n.created_at} title={absoluteDate(n.created_at, locale)} className="num mt-1 block text-sm text-ink-2">{clock(n.created_at)}</time>
          )}
        </span>
        {unread && (
          <span className="mt-2 size-2.5 shrink-0 rounded-full bg-lapis">
            <span className="sr-only">{t("notif.unread")}</span>
          </span>
        )}
      </LocalizedLink>
    </li>
  );
}

function NotificationSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true">
        <Skeleton className="mb-3 ml-1 h-3.5 w-16" />
        <div className="surface-card divide-y divide-line overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3.5 px-4 py-4 sm:px-5">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                <Skeleton className="h-4" style={{ width: `${[78, 64, 86, 58][i]}%` }} />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
