import { BadgeCheck, Building2, Check, CircleCheckBig, Eye, Keyboard, MoreHorizontal, RotateCw, ShieldCheck, ShieldOff, X } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { useModeration, useQueue, type Moderation, type QueueVacancy } from "./useModeration";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { groupDigits } from "~/shared/lib/format";
import { LoadMore } from "~/shared/query/LoadMore";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Button, IconButton } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { useConfirm } from "~/shared/ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "~/shared/ui/DataTable";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Kbd } from "~/shared/ui/Kbd";
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from "~/shared/ui/Menu";
import { popoverItem } from "~/shared/ui/Popover";
import { RelTime } from "~/shared/ui/RelTime";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";

// Overlays load on first use: most visits only scan the table.
const VacancyPreview = lazy(() => import("./VacancyPreview"));
const RejectDialog = lazy(() => import("./RejectDialog"));

type CompanyRef = QueueVacancy["company"];
type Overlay = { v: QueueVacancy; open: boolean } | null;

// Column ids (a constant, not literals: test/i18n-keys.mjs reads every `key: "…"` as a message key).
const COL = { vacancy: "vacancy", company: "company", created: "created", actions: "actions" } as const;
// Physical keys, so the shortcuts also work on a Cyrillic layout.
const KEYS = { next: "KeyJ", prev: "KeyK", approve: "KeyA", reject: "KeyR" } as const;

/**
 * The moderation queue: a dense table from md (cards on phones), a preview sheet, a reject dialog
 * and company verification from the row menu. Decisions remove the row at once; keyboard users
 * land on the next row, so a queue can be worked through with J/K, A and R alone.
 */
export function ModerationQueue() {
  const { t } = useTranslation();
  const q = useQueue();
  const mod = useModeration();
  const { confirm, dialog } = useConfirm();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const locale = useLocale();

  const rows = useMemo(() => q.data?.pages.flatMap((p) => p.data) ?? [], [q.data]);
  const hasNext = !!q.hasNextPage;
  const loading = useSkeletonHold(q.isPending);
  // Every loaded row was decided but older pages remain: the refetch after the last decision
  // brings them in; until then this is a wait, not an empty queue.
  // (Not after a failed refetch: that shows the error, instead of retrying in a loop.)
  const draining = rows.length === 0 && hasNext && !q.isError;

  const [preview, setPreview] = useState<Overlay>(null);
  const [rejecting, setRejecting] = useState<Overlay>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [announce, setAnnounce] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  /* -- focus after a decision ------------------------------------------------------------- */

  // Where focus goes once the decided row has left: the next row (or the previous one at the
  // end), or the section heading when the queue is empty. Without it focus falls to <body>.
  const refocus = useRef<{ from: string; to: string } | null>(null);
  const visibleTitles = () =>
    [...(tableRef.current?.querySelectorAll<HTMLElement>("[data-title]") ?? [])].filter((el) => el.offsetParent !== null);
  const moveFocusAfter = (id: string) => {
    const i = rows.findIndex((r) => r.id === id);
    refocus.current = { from: id, to: rows[i + 1]?.id ?? rows[i - 1]?.id ?? "" };
  };
  useEffect(() => {
    const r = refocus.current;
    if (!r || rows.some((x) => x.id === r.from)) return;
    refocus.current = null;
    const target = r.to ? visibleTitles().find((el) => el.dataset.title === r.to) : null;
    (target ?? headingRef.current)?.focus({ preventScroll: false });
  }, [rows]);

  /* -- actions ---------------------------------------------------------------------------- */

  const approve = (v: QueueVacancy, keyboard: boolean) => {
    if (keyboard) moveFocusAfter(v.id);
    mod.approve(v);
  };
  const openReject = (v: QueueVacancy) => setRejecting({ v, open: true });
  const submitReject = (reason: string) => {
    if (!rejecting) return;
    // Both overlays close; the row leaves; focus goes to the next row (the opener is gone).
    moveFocusAfter(rejecting.v.id);
    setRejecting({ ...rejecting, open: false });
    setPreview((p) => p && { ...p, open: false });
    mod.reject({ v: rejecting.v, reason });
  };
  const approveFromPreview = () => {
    if (!preview) return;
    moveFocusAfter(preview.v.id);
    setPreview({ ...preview, open: false });
    mod.approve(preview.v);
  };
  const toggleVerified = async (c: CompanyRef) => {
    const ok = await confirm(
      c.verified
        ? { title: t("adminPage.unverifyTitle", { name: c.name }), body: t("adminPage.unverifyBody"), confirmLabel: t("adminPage.unverifyCompany"), tone: "danger" }
        : { title: t("adminPage.verifyTitle", { name: c.name }), body: t("adminPage.verifyBody"), confirmLabel: t("adminPage.verifyCompany") },
    );
    if (ok) mod.verify({ company: c, verified: !c.verified });
  };

  const refresh = async () => {
    setRefreshing(true);
    const r = await q.refetch();
    setRefreshing(false);
    if (!r.isSuccess) return;
    const n = r.data.pages.reduce((a, p) => a + p.data.length, 0);
    setAnnounce(
      n === 0 ? t("adminPage.refreshedEmpty")
        : r.data.pages.at(-1)?.meta.next_cursor ? t("adminPage.refreshedMore", { n: groupDigits(n) })
        : t("adminPage.refreshed", { count: n, n: groupDigits(n) }),
    );
  };

  const { refetch, isFetching } = q;
  useEffect(() => {
    if (draining && !isFetching) void refetch();
  }, [draining, isFetching, refetch]);

  // J/K move between rows, A approves, R rejects: only while focus is on a row (WCAG 2.1.4),
  // never in a text field or with a modifier held.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const el = e.target as HTMLElement;
    if (el.closest("input, textarea, select, [contenteditable]")) return;
    const title = el.closest("tr, li")?.querySelector<HTMLElement>("[data-title]");
    const v = title && rows.find((r) => r.id === title.dataset.title);
    if (!title || !v) return;
    if (e.code === KEYS.next || e.code === KEYS.prev) {
      const all = visibleTitles();
      all[all.indexOf(title) + (e.code === KEYS.next ? 1 : -1)]?.focus();
    } else if (e.code === KEYS.approve) {
      approve(v, true);
    } else if (e.code === KEYS.reject) {
      openReject(v);
    } else {
      return;
    }
    e.preventDefault();
  };

  /* -- rendering -------------------------------------------------------------------------- */

  const place = (v: QueueVacancy) =>
    [idx.categories.get(v.category_id), idx.regions.get(v.region_id)]
      .filter(Boolean)
      .map((x) => nameOf(x!.name, locale))
      // The dot sticks to the word before it, so a wrapped line never starts with "·".
      .join("\u00a0· ");

  const row: RowProps = {
    place,
    onPreview: (v) => setPreview({ v, open: true }),
    onApprove: approve,
    onReject: openReject,
    onVerify: (c) => void toggleVerified(c),
    verifying: mod.verifying,
  };

  const columns: DataTableColumn<QueueVacancy>[] = [
    { key: COL.vacancy, header: t("adminPage.colVacancy"), cell: (v) => <VacancyCell v={v} row={row} /> },
    // Below xl the company and the time move under the title: the title column stays readable and
    // the actions keep their labels on tablets.
    { key: COL.company, header: t("adminPage.colCompany"), className: "w-60 max-xl:hidden", cell: (v) => <Company c={v.company} avatar /> },
    {
      key: COL.created,
      header: t("adminPage.colCreated"),
      className: "w-36 whitespace-nowrap max-xl:hidden",
      cell: (v) => <RelTime iso={v.created_at} className="text-sm text-ink-2" />,
    },
    {
      key: COL.actions,
      header: <span className="sr-only">{t("adminPage.colActions")}</span>,
      align: "end",
      className: "w-px whitespace-nowrap",
      cell: (v) => <Actions v={v} row={row} />,
    },
  ];

  const count = rows.length;
  const showTools = !loading && count > 0;
  return (
    <section aria-labelledby="queue-title">
      {/* min-h (44px on touch, like the refresh button): the row keeps its height with or without the tools. */}
      <div className="mb-4 flex min-h-9 items-center gap-3 pointer-coarse:min-h-11">
        <h2 id="queue-title" ref={headingRef} tabIndex={-1} className="min-w-0 flex-1 break-words font-display text-lg font-semibold tracking-heading text-ink md:text-xl">
          {t("adminPage.queueTitle")}
          {/* Inline, so on a wrapped title the count follows the last word instead of floating. */}
          {showTools && (
            <Badge tone="lapis" className="ml-2.5 align-middle font-sans">
              <span aria-hidden="true" className="num">{groupDigits(count)}{hasNext && "+"}</span>
              <span className="sr-only">
                {hasNext ? t("adminPage.queueCountMore", { n: groupDigits(count) }) : t("adminPage.queueCount", { count, n: groupDigits(count) })}
              </span>
            </Badge>
          )}
        </h2>
        {/* Empty and error states carry their own refresh / retry button: no second one up here. */}
        {showTools && (
          <div className="ml-auto flex shrink-0 items-center gap-4">
            <ShortcutLegend />
            <IconButton label={t("adminPage.refresh")} variant="secondary" size="sm" loading={refreshing} onClick={() => void refresh()}>
              <RotateCw className="size-4" />
            </IconButton>
          </div>
        )}
      </div>
      <p aria-live="polite" className="sr-only">{announce}</p>

      {/* A failed background refresh keeps the rows on screen with an inline retry. */}
      {q.isError && count > 0 && <ErrorState compact error={q.error} onRetry={() => q.refetch()} className="mb-4" />}

      {loading || draining ? (
        <SkeletonDelay>
          <QueueSkeleton columns={columns} />
        </SkeletonDelay>
      ) : q.isError && count === 0 ? (
        <Card padding="none">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Card>
      ) : (
        <div ref={tableRef} onKeyDown={onKeyDown}>
          <DataTable
            rows={rows}
            rowKey={(v) => v.id}
            columns={columns}
            caption={t("adminPage.queueCaption")}
            loading={refreshing}
            mobileCard={(v) => <MobileCard v={v} row={row} />}
            empty={
              <EmptyState
                icon={<CircleCheckBig />}
                title={t("adminPage.emptyTitle")}
                body={t("adminPage.emptyBody")}
                action={
                  <Button variant="secondary" icon={<RotateCw className="size-4" />} loading={refreshing} onClick={() => void refresh()}>
                    {t("adminPage.refresh")}
                  </Button>
                }
              />
            }
          />
        </div>
      )}
      {!loading && !draining && (
        <LoadMore hasNext={hasNext} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} loadedCount={count} className="mt-4" />
      )}

      {preview && (
        <Suspense>
          <VacancyPreview
            vacancy={preview.v}
            open={preview.open}
            onOpenChange={(open) => setPreview({ ...preview, open })}
            onApprove={approveFromPreview}
            onReject={() => openReject(preview.v)}
          />
        </Suspense>
      )}
      {rejecting && (
        <Suspense>
          {/* Keyed: every vacancy starts with an empty reason. */}
          <RejectDialog
            key={rejecting.v.id}
            vacancy={rejecting.v}
            open={rejecting.open}
            onOpenChange={(open) => setRejecting({ ...rejecting, open })}
            onSubmit={submitReject}
          />
        </Suspense>
      )}
      {dialog}
    </section>
  );
}

/* ---- rows ---------------------------------------------------------------------------------- */

type RowProps = {
  place: (v: QueueVacancy) => string;
  onPreview: (v: QueueVacancy) => void;
  onApprove: (v: QueueVacancy, keyboard: boolean) => void;
  onReject: (v: QueueVacancy) => void;
  onVerify: (c: CompanyRef) => void;
  verifying: Moderation["verifying"];
};

/** The row's one focus target: opens the preview (the public page 404s until it's approved). */
function Title({ v, row, stretched }: { v: QueueVacancy; row: RowProps; stretched?: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      data-title={v.id}
      onClick={() => row.onPreview(v)}
      aria-label={t("adminPage.previewFor", { title: v.title })}
      className={cn(
        "line-clamp-2 break-words rounded-control text-start text-md font-semibold text-ink transition-colors duration-150 hover:text-lapis-ink",
        // Phones: the whole card opens the preview; the action row sits above it (z-10).
        stretched && "after:absolute after:-inset-4",
      )}
    >
      {v.title}
    </button>
  );
}

/** Company name with the verified badge glued to its last word (never wraps alone). */
function Company({ c, avatar }: { c: CompanyRef; avatar?: boolean }) {
  const { t } = useTranslation();
  const cut = c.name.lastIndexOf(" ");
  const name = c.verified ? (
    <>
      {cut > 0 && c.name.slice(0, cut + 1)}
      <span className="whitespace-nowrap">
        {c.name.slice(cut + 1)}
        <BadgeCheck role="img" aria-label={t("common.verified")} className="ml-1 inline-block size-4 align-middle text-firuza" />
      </span>
    </>
  ) : (
    c.name
  );
  if (!avatar) return name;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={c.name} src={c.logo_url} square size="sm" />
      <span className="min-w-0 break-words text-md text-ink">{name}</span>
    </span>
  );
}

function VacancyCell({ v, row }: { v: QueueVacancy; row: RowProps }) {
  const { t } = useTranslation();
  const place = row.place(v);
  return (
    <div className="min-w-0">
      <Title v={v} row={row} />
      <p className="mt-0.5 break-words text-sm text-ink-2 xl:hidden"><Company c={v.company} /></p>
      <p className="mt-0.5 break-words text-sm text-ink-2">
        {place}
        <span className="xl:hidden">
          {place && "\u00a0· "}
          <RelTime iso={v.created_at} template={(when) => t("adminPage.createdAgo", { when })} className="whitespace-nowrap" />
        </span>
      </p>
    </div>
  );
}

function Actions({ v, row }: { v: QueueVacancy; row: RowProps }) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <DecisionButtons v={v} row={row} />
      <RowMenu v={v} row={row} />
    </div>
  );
}

function DecisionButtons({ v, row, className }: { v: QueueVacancy; row: RowProps; className?: string }) {
  const { t } = useTranslation();
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="soft"
        icon={<Check className="size-4" />}
        aria-label={t("adminPage.approveFor", { title: v.title })}
        aria-keyshortcuts="A"
        // detail 0 = activated from the keyboard: then focus follows to the next row.
        onClick={(e) => row.onApprove(v, e.detail === 0)}
        className={className}
      >
        {t("adminPage.approve")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        icon={<X className="size-4" />}
        aria-label={t("adminPage.rejectFor", { title: v.title })}
        aria-keyshortcuts="R"
        onClick={() => row.onReject(v)}
        className={className}
      >
        {t("adminPage.reject")}
      </Button>
    </>
  );
}

function RowMenu({ v, row }: { v: QueueVacancy; row: RowProps }) {
  const { t } = useTranslation();
  const c = v.company;
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton size="sm" label={t("adminPage.actionsFor", { title: v.title })} loading={row.verifying === c.id}>
          <MoreHorizontal className="size-5" />
        </IconButton>
      </MenuTrigger>
      <MenuContent className="w-64">
        <MenuItem icon={<Eye className="size-4" />} onSelect={() => row.onPreview(v)}>{t("adminPage.preview")}</MenuItem>
        <MenuItem asChild>
          <LocalizedLink to={`/companies/${c.slug}`} prefetch="intent" className={popoverItem}>
            <Building2 aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
            {t("adminPage.companyPage")}
          </LocalizedLink>
        </MenuItem>
        <MenuSeparator />
        {c.verified ? (
          <MenuItem tone="danger" icon={<ShieldOff className="size-4" />} onSelect={() => row.onVerify(c)}>{t("adminPage.unverifyCompany")}</MenuItem>
        ) : (
          <MenuItem icon={<ShieldCheck className="size-4" />} onSelect={() => row.onVerify(c)}>{t("adminPage.verifyCompany")}</MenuItem>
        )}
      </MenuContent>
    </MenuRoot>
  );
}

function MobileCard({ v, row }: { v: QueueVacancy; row: RowProps }) {
  const { t } = useTranslation();
  const place = row.place(v);
  return (
    <div className="relative">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Title v={v} row={row} stretched />
          <p className="mt-1 break-words text-sm text-ink-2"><Company c={v.company} /></p>
          {place && <p className="mt-0.5 break-words text-sm text-ink-2">{place}</p>}
          {/* Its own line: appended to the place it wrapped mid-phrase or left a lone "·". */}
          <p className="mt-0.5 text-sm text-ink-3">
            <RelTime iso={v.created_at} template={(when) => t("adminPage.createdAgo", { when })} />
          </p>
        </div>
        <div className="relative z-10 -mr-2 -mt-2 shrink-0">
          <RowMenu v={v} row={row} />
        </div>
      </div>
      <div className="relative z-10 mt-3 flex gap-2 border-t border-line pt-3">
        <DecisionButtons v={v} row={row} className="min-w-0 flex-1" />
      </div>
    </div>
  );
}

/* ---- loading -------------------------------------------------------------------------------- */

const SKELETON_ROWS = [0, 1, 2, 3, 4];

/** The table's own shape (row heights, action buttons), so nothing moves when the rows arrive. */
function QueueSkeleton({ columns }: { columns: DataTableColumn<QueueVacancy>[] }) {
  const { t } = useTranslation();
  const bones: Record<string, ReactNode> = {
    [COL.vacancy]: (
      <div className="flex flex-col gap-2.5 py-0.5">
        <Skeleton className="h-4.5 w-3/4" />
        <Skeleton className="h-3.5 w-1/3 xl:hidden" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
    ),
    [COL.company]: (
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-8 shrink-0 rounded-control" />
        <Skeleton className="h-4 w-28" />
      </div>
    ),
    [COL.created]: <Skeleton className="h-3.5 w-20" />,
    [COL.actions]: (
      <div className="flex items-center justify-end gap-1.5">
        <Skeleton className="h-9 w-28 rounded-control" />
        <Skeleton className="h-9 w-28 rounded-control" />
        <Skeleton className="size-9 rounded-control" />
      </div>
    ),
  };
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true">
        <DataTable
          rows={SKELETON_ROWS}
          rowKey={String}
          columns={columns.map((c) => ({ ...c, cell: () => bones[c.key] }))}
          mobileCard={() => (
            // Bars sit where the title, company, place and time lines' text sits.
            <div>
              <Skeleton className="mt-0.5 h-4.5 w-3/4" />
              <Skeleton className="mt-3 h-3.5 w-1/3" />
              <Skeleton className="mt-2 h-3.5 w-1/2" />
              <Skeleton className="mt-3 h-3.5 w-2/5" />
              <div className="mt-3 flex gap-2 border-t border-line pt-3">
                <Skeleton className="h-9 flex-1 rounded-control" />
                <Skeleton className="h-9 flex-1 rounded-control" />
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}

/** Desktop keyboard hints; meaningless on touch, so hidden there. */
function ShortcutLegend() {
  const { t } = useTranslation();
  const item = (keys: string[], label: string) => (
    <span className="inline-flex items-center gap-1">
      {keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
      <span className="ml-0.5">{label}</span>
    </span>
  );
  return (
    <p className="hidden items-center gap-3 text-xs text-ink-2 lg:flex pointer-coarse:hidden">
      <Keyboard aria-hidden="true" className="size-4 text-ink-3" />
      <span className="sr-only">{t("adminPage.keys.label")}:</span>
      {item(["J", "K"], t("adminPage.keys.move"))}
      {item(["A"], t("adminPage.keys.approve"))}
      {item(["R"], t("adminPage.keys.reject"))}
      {item(["Enter"], t("adminPage.keys.open"))}
    </p>
  );
}
