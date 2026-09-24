import { infiniteQueryOptions, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { ArrowUpRight, Briefcase, ChevronLeft, ChevronRight, ExternalLink, Hand, Inbox, MoreHorizontal, Send, UserSearch } from "lucide-react";
import {
  memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useParams } from "react-router";

import { EmployerOnly } from "./EmployerOnly";
import type { EmployerApplication } from "./company-hook";
import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import {
  isEmployerTarget, STATUSES, StageMenuItems, StatusIcon, type AppStatus, type EmployerTarget,
} from "~/shared/application/status";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { experienceText, groupDigits, money } from "~/shared/lib/format";
import { useSpotlight } from "~/shared/lib/spotlight";
import { LoadMore } from "~/shared/query/LoadMore";
import { ApiFailure, authed, authedPage, type Page } from "~/shared/query/query";
import { Avatar } from "~/shared/ui/Avatar";
import { BackLink } from "~/shared/ui/BackLink";
import { Badge } from "~/shared/ui/Badge";
import { Button, IconButton } from "~/shared/ui/Button";
import { Card, CardLink } from "~/shared/ui/Card";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Popover, popoverItem } from "~/shared/ui/Popover";
import { RelTime } from "~/shared/ui/RelTime";
import { PageHeader } from "~/shared/ui/Section";
import { SegmentedControl, segmentedPanelProps } from "~/shared/ui/SegmentedControl";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";
import { toast } from "~/shared/ui/toast-store";

type App = EmployerApplication;
type Col = AppStatus;
type Pages = InfiniteData<Page<App>>;
type Counts = Record<Col, number>;
type Via = "drag" | "dock" | "menu";

const COLUMNS = STATUSES;
const PANELS = "kanban"; // SegmentedControl tabs id prefix (phones)
const statsKey = (vacancy: string) => ["application-stats", vacancy];
const colKey = (vacancy: string, status: Col) => ["applications", vacancy, status];
const colQuery = (vacancy: string, status: Col) =>
  infiniteQueryOptions({
    queryKey: colKey(vacancy, status),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      authedPage<App>(() =>
        api.GET("/vacancies/{vacancy}/applications", { params: { path: { vacancy }, query: { status, cursor: pageParam, limit: 20 } } })),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });

// ---- small browser helpers ------------------------------------------------------------------

// Private pages render in the browser only, so the first client render already knows the width.
function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let springCache: string | null = null;
const spring = () =>
  (springCache ??= getComputedStyle(document.documentElement).getPropertyValue("--ease-spring").trim() || "cubic-bezier(0.22, 1, 0.36, 1)");
/** WAAPI with the app's spring; engines without linear() easing fall back to out-quint. */
function play(el: Element, frames: Keyframe[], duration = 320, fill: FillMode = "none") {
  try {
    return el.animate(frames, { duration, easing: spring(), fill });
  } catch {
    return el.animate(frames, { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill });
  }
}

/** Polite live region; a repeated sentence gets a trailing no-break space so it is read again. */
function useAnnouncer() {
  const [message, setMessage] = useState("");
  const announce = useCallback((m: string) => setMessage((prev) => (prev === m ? `${m} ` : m)), []);
  return [message, announce] as const;
}

// ---- page -----------------------------------------------------------------------------------

export default function Kanban() {
  return <EmployerOnly><KanbanPage /></EmployerOnly>;
}

function KanbanPage() {
  const { id } = useParams();
  const vacancyId = id!;
  const { t } = useTranslation();
  const qc = useQueryClient();
  const vacancy = useQuery({
    queryKey: ["vacancy", vacancyId],
    queryFn: () => authed<Schemas["VacancyDetail"]>(() => api.GET("/vacancies/{vacancy}", { params: { path: { vacancy: vacancyId } } })),
  });
  const stats = useQuery({
    queryKey: statsKey(vacancyId),
    queryFn: () => authed<Counts>(() => api.GET("/vacancies/{vacancy}/applications/stats", { params: { path: { vacancy: vacancyId } } })),
  });
  // The seven columns load together with the counts instead of waiting for them.
  useEffect(() => {
    for (const c of COLUMNS) void qc.prefetchInfiniteQuery(colQuery(vacancyId, c));
  }, [qc, vacancyId]);
  const loading = useSkeletonHold(stats.isPending);

  const back = <BackLink to="/employer" viewTransition>{t("account.dashboard")}</BackLink>;
  if (vacancy.isError) {
    return (
      <>
        <div className="mb-3">{back}</div>
        <Card padding="none"><ErrorState error={vacancy.error} onRetry={() => vacancy.refetch()} headingAs="h1" /></Card>
      </>
    );
  }

  const v = vacancy.data;
  const total = stats.data ? Object.values(stats.data).reduce((a, b) => a + b, 0) : undefined;

  return (
    <>
      <PageHeader
        breadcrumbs={back}
        title={v ? v.title : <><span aria-hidden="true" className="skeleton block h-8 w-2/3 max-w-sm md:h-10" /><span className="sr-only">{t("common.loading")}</span></>}
        description={
          total !== undefined ? (
            <span className="num">{t("vacancyPage.applicants", { count: total, n: groupDigits(total) })}</span>
          ) : stats.isPending ? <span aria-hidden="true" className="skeleton inline-block h-4 w-24 align-middle" /> : null
        }
        actions={v?.status === "published" && v.slug ? (
          <Button asChild variant="secondary" icon={<ExternalLink className="size-4" />}>
            <LocalizedLink to={`/vacancies/${v.slug}`} prefetch="intent">{t("employer.viewPublic")}</LocalizedLink>
          </Button>
        ) : undefined}
      />

      {loading ? (
        <SkeletonDelay><BoardSkeleton /></SkeletonDelay>
      ) : total === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<Inbox />}
            title={t("kanbanPage.emptyTitle")}
            body={t("kanbanPage.emptyBody")}
            action={(
              <Button asChild icon={<UserSearch className="size-4.5" />}>
                <LocalizedLink to="/employer/candidates" prefetch="intent">{t("kanbanPage.findCandidates")}</LocalizedLink>
              </Button>
            )}
          />
        </Card>
      ) : (
        <>
          {stats.isError && (
            <Card padding="none" className="mb-4">
              <ErrorState compact error={stats.error} title={t("kanbanPage.countsError")} onRetry={() => stats.refetch()} />
            </Card>
          )}
          <Board vacancyId={vacancyId} counts={stats.data} />
        </>
      )}
    </>
  );
}

// ---- board: columns, pointer drag & drop, phone pager ---------------------------------------

type Drag = {
  app: App;
  from: Col;
  /** Card box at pick-up (the ghost starts there, a cancel flies back to it). */
  x: number;
  y: number;
  w: number;
  h: number;
  over: Col | null;
  /** Hovering a chip of the phone drop dock rather than a column. */
  dock: boolean;
  touch: boolean;
  /** Phones: the card floats above the finger and targets sit in a dock (top when lifted low). */
  phone: boolean;
  dockTop: boolean;
};
type Press = {
  pointerId: number;
  touch: boolean;
  app: App | null;
  card: HTMLElement | null;
  x0: number;
  y0: number;
  x: number;
  y: number;
  t: number;
  vx: number;
  offX: number;
  offY: number;
  lifted: boolean;
  liftAt: number;
  /** Travelled after the lift: a press released in place is not a drop. */
  moved: boolean;
  swipe: boolean;
  timer: number;
};

const LONG_PRESS = 200; // ms before a finger lifts a card
const SLOP_TOUCH = 8; // px of finger travel that turns a press into a scroll or swipe
const SLOP_MOUSE = 4;
const EDGE = 64; // auto-scroll zone near the board / viewport edges
const EDGE_SPEED = 16; // px per frame at the very edge

const validTarget = (d: Drag | null, c: Col | null): c is EmployerTarget => !!d && !!c && c !== d.from && isEmployerTarget(c);

function Board({ vacancyId, counts }: { vacancyId: string; counts?: Counts }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const narrow = useMedia("(max-width: 47.99rem)"); // below md
  const [picked, setPicked] = useState<Col | null>(null);
  // Phones open on the first stage that has someone in it.
  const current: Col = picked ?? COLUMNS.find((c) => (counts?.[c] ?? 0) > 0) ?? "sent";
  const [drag, setDrag] = useState<Drag | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [message, announce] = useAnnouncer();
  const [edges, setEdges] = useState({ start: true, end: true });

  const board = useRef<HTMLDivElement | null>(null);
  const spot = useSpotlight<HTMLDivElement>();
  const ghost = useRef<HTMLDivElement>(null);
  const ghostCard = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const overEl = useRef<HTMLElement | null>(null);
  const raf = useRef(0);
  const slideDir = useRef(0);
  const live = useRef({ narrow, current, t });
  live.current = { narrow, current, t };

  const label = useCallback((c: string) => t(`enums.application_status.${c}`), [t]);

  // ---- moving a card (drag, dock, menu): optimistic, rolled back on failure ----
  const move = useMutation({
    mutationKey: ["kanban-move", vacancyId],
    mutationFn: ({ app, to }: { app: App; to: EmployerTarget; via: Via }) =>
      authed<App>(() => api.PUT("/applications/{application}/status", { params: { path: { application: app.id! } }, body: { status: to } })),
    onMutate: async ({ app, to }) => {
      const from = (app.status ?? "sent") as Col;
      await Promise.all([
        qc.cancelQueries({ queryKey: ["applications", vacancyId] }),
        qc.cancelQueries({ queryKey: statsKey(vacancyId) }),
      ]);
      const snap = {
        from: qc.getQueryData<Pages>(colKey(vacancyId, from)),
        to: qc.getQueryData<Pages>(colKey(vacancyId, to)),
        stats: qc.getQueryData<Counts>(statsKey(vacancyId)),
      };
      // Out of its column, onto the top of the target one; the counts tick with it.
      qc.setQueryData<Pages>(colKey(vacancyId, from), (d) => d && { ...d, pages: d.pages.map((p) => ({ ...p, data: p.data.filter((a) => a.id !== app.id) })) });
      qc.setQueryData<Pages>(colKey(vacancyId, to), (d) => d && { ...d, pages: d.pages.map((p, i) => (i === 0 ? { ...p, data: [{ ...app, status: to }, ...p.data] } : p)) });
      qc.setQueryData<Counts>(statsKey(vacancyId), (s) => s && { ...s, [from]: Math.max(0, (s[from] ?? 0) - 1), [to]: (s[to] ?? 0) + 1 });
      return { snap, from };
    },
    onError: (e, vars, ctx) => {
      if (ctx) {
        qc.setQueryData(colKey(vacancyId, ctx.from), ctx.snap.from);
        qc.setQueryData(colKey(vacancyId, vars.to), ctx.snap.to);
        qc.setQueryData(statsKey(vacancyId), ctx.snap.stats);
      }
      toast({
        tone: "error",
        title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network"),
        body: t("kanbanPage.reverted", { name: vars.app.candidate.full_name, stage: label(ctx?.from ?? vars.app.status ?? "sent") }),
        action: { label: t("common.retry"), onClick: () => move.mutate(vars) },
      });
    },
    onSuccess: (_, { app, to, via }) => {
      const text = t("kanbanPage.moved", { name: app.candidate.full_name, stage: label(to) });
      // A card dropped on a visible column speaks for itself; menu and dock moves land out of sight.
      if (via === "drag") announce(text);
      else toast({ tone: "success", title: text });
      void qc.invalidateQueries({ queryKey: ["application", app.id] });
    },
    onSettled: () => {
      // Refetch once the last of several quick moves is done, so a refetch never undoes a pending one.
      if (qc.isMutating({ mutationKey: ["kanban-move", vacancyId] }) > 1) return;
      void qc.invalidateQueries({ queryKey: ["applications", vacancyId] });
      void qc.invalidateQueries({ queryKey: statsKey(vacancyId) });
    },
  });
  const moveTo = useCallback((app: App, to: EmployerTarget, via: Via) => {
    if (app.status !== to && app.status !== "withdrawn") move.mutate({ app, to, via });
  }, [move]);
  const moveRef = useRef(moveTo);
  moveRef.current = moveTo;
  // Stable, so the memoized cards don't re-render whenever the mutation's state changes.
  const onMenuMove = useCallback((app: App, to: EmployerTarget) => moveRef.current(app, to, "menu"), []);

  // ---- phone pager: tabs + swipe ----
  const pickTab = useCallback((c: Col) => {
    slideDir.current = Math.sign(COLUMNS.indexOf(c) - COLUMNS.indexOf(live.current.current));
    setPicked(c);
  }, []);
  // The newly shown column slides in from the side it came from.
  useLayoutEffect(() => {
    const dir = slideDir.current;
    slideDir.current = 0;
    if (!dir || !narrow || reducedMotion()) return;
    const panel = board.current?.querySelector(`[data-drop="${current}"]`);
    if (panel) play(panel, [{ transform: `translateX(${dir * 24}%)`, opacity: 0.4 }, { transform: "none", opacity: 1 }]);
  }, [current, narrow]);

  // ---- desktop: scroll buttons know when an end is reached ----
  useEffect(() => {
    const b = board.current;
    if (narrow || !b || typeof IntersectionObserver === "undefined") return;
    const cols = b.querySelectorAll("[data-drop]");
    const first = cols[0];
    const last = cols[cols.length - 1];
    if (!first || !last) return;
    const io = new IntersectionObserver((entries) => {
      setEdges((prev) => {
        const next = { ...prev };
        for (const e of entries) {
          if (e.target === first) next.start = e.intersectionRatio > 0.97;
          if (e.target === last) next.end = e.intersectionRatio > 0.97;
        }
        return next.start === prev.start && next.end === prev.end ? prev : next;
      });
    }, { root: b, threshold: [0.97] });
    io.observe(first);
    io.observe(last);
    return () => io.disconnect();
  }, [narrow]);
  const scrollPage = (dir: number) => {
    const b = board.current;
    if (b) b.scrollBy({ left: dir * Math.max(240, b.clientWidth - 96), behavior: reducedMotion() ? "auto" : "smooth" });
  };

  // ---- drag & drop (pointer events: mouse, touch after a long press, pen) ----
  const dnd = useMemo(() => {
    const findApp = (el: HTMLElement): App | null => {
      const id = el.dataset.card;
      const col = el.dataset.col as Col | undefined;
      if (!id || !col) return null;
      const pages = qc.getQueryData<Pages>(colKey(vacancyId, col));
      return pages?.pages.flatMap((p) => p.data).find((a) => a.id === id) ?? null;
    };
    const setDragState = (d: Drag | null) => {
      dragRef.current = d;
      setDrag(d);
    };

    const hitTest = (p: Press) => {
      const d = dragRef.current;
      if (!d) return;
      const el = document.elementFromPoint(p.x, p.y)?.closest<HTMLElement>("[data-drop]") ?? null;
      overEl.current = el;
      const over = (el?.dataset.drop as Col | undefined) ?? null;
      const dock = el?.dataset.dock != null;
      if (over === d.over && dock === d.dock) return;
      setDragState({ ...d, over, dock });
      if (over && over !== d.from) {
        const { t } = live.current;
        announce(validTarget(d, over) ? t("kanbanPage.over", { stage: label(over) }) : t("kanbanPage.overInvalid", { stage: label(over) }));
      }
    };

    const autoScroll = (p: Press) => {
      const b = board.current;
      if (!b || live.current.narrow) return; // phones drop on the dock instead
      const r = b.getBoundingClientRect();
      if (p.y >= r.top && p.y <= r.bottom) {
        const left = p.x - r.left;
        const right = r.right - p.x;
        if (left < EDGE) b.scrollLeft -= EDGE_SPEED * (1 - Math.max(0, left) / EDGE);
        else if (right < EDGE) b.scrollLeft += EDGE_SPEED * (1 - Math.max(0, right) / EDGE);
      }
      const top = p.y - 96; // below the sticky header
      const bottom = innerHeight - p.y;
      if (top < EDGE) scrollBy(0, -EDGE_SPEED * (1 - Math.max(0, top) / EDGE));
      else if (bottom < EDGE) scrollBy(0, EDGE_SPEED * (1 - Math.max(0, bottom) / EDGE));
    };

    // Where the ghost's top-left goes. Mouse: under the grab point. Phones: it eases away from the
    // finger, so the dock target under the finger stays visible.
    const ghostAt = (p: Press, d: Drag): [number, number] => {
      const gx = p.x - p.offX;
      const gy = p.y - p.offY;
      if (!d.phone) return [gx, gy];
      const k = Math.min(1, (performance.now() - p.liftAt) / 180);
      const e = 1 - (1 - k) ** 3;
      const tx = Math.min(Math.max(8, p.x - d.w / 2), innerWidth - d.w - 8);
      // Opposite the dock: above the finger when the dock is below, under it when the dock is on top.
      const ty = d.dockTop ? p.y + 24 : p.y - d.h - 24;
      return [gx + (tx - gx) * e, gy + (ty - gy) * e];
    };

    const frame = () => {
      const p = press.current;
      if (!p?.lifted || !dragRef.current) {
        raf.current = 0;
        return;
      }
      const [gx, gy] = ghostAt(p, dragRef.current);
      if (ghost.current) ghost.current.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
      if (!p.moved && Math.hypot(p.x - p.x0, p.y - p.y0) > 12) p.moved = true;
      autoScroll(p);
      hitTest(p);
      raf.current = requestAnimationFrame(frame);
    };

    const lift = () => {
      const p = press.current;
      if (!p?.app || !p.card || p.lifted) return;
      clearTimeout(p.timer);
      p.lifted = true;
      p.liftAt = performance.now();
      p.moved = !p.touch; // a mouse lift already is a movement
      const r = p.card.getBoundingClientRect();
      p.offX = p.x0 - r.left;
      p.offY = p.y0 - r.top;
      if (p.touch) navigator.vibrate?.(8);
      else {
        try {
          p.card.setPointerCapture(p.pointerId);
        } catch {
          // The pointer is already gone.
        }
      }
      getSelection()?.removeAllRanges();
      document.documentElement.style.cursor = "grabbing";
      setDragState({
        app: p.app, from: (p.app.status ?? "sent") as Col, x: r.left, y: r.top, w: r.width, h: r.height,
        over: null, dock: false, touch: p.touch,
        phone: live.current.narrow, dockTop: p.y0 > innerHeight * 0.5,
      });
      announce(live.current.t("kanbanPage.lifted", { name: p.app.candidate.full_name }));
      window.addEventListener("keydown", onKey);
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(frame);
    };

    const finish = () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.cursor = "";
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      overEl.current = null;
      setDragState(null);
      setSettling(null);
    };

    /** Fly the ghost to `rect` with the spring, then drop it; `absorb` shrinks it into a dock chip. */
    const settle = (rect: DOMRect | null, absorb = false) => {
      const g = ghost.current;
      const inner = ghostCard.current;
      const p = press.current;
      if (!g || !inner || !rect || !p || reducedMotion()) {
        finish();
        return;
      }
      const d = dragRef.current!;
      const [gx, gy] = ghostAt(p, d);
      const from = `translate3d(${gx}px, ${gy}px, 0)`;
      const x = absorb ? rect.left + rect.width / 2 - d.w / 2 : rect.left;
      const y = absorb ? rect.top + rect.height / 2 - d.h / 2 : rect.top;
      const lifted = { rotate: "1.5deg", scale: d.phone ? "0.94" : "1.03", opacity: 1 };
      play(inner, [lifted, absorb ? { rotate: "0deg", scale: "0.4", opacity: 0 } : { rotate: "0deg", scale: "1", opacity: 1 }], 320, "forwards");
      const anim = play(g, [{ transform: from }, { transform: `translate3d(${x}px, ${y}px, 0)` }], 320, "forwards");
      anim.finished.then(finish, finish);
    };

    const cancelDrag = () => {
      const p = press.current;
      announce(live.current.t("kanbanPage.cancelled"));
      settle(p?.card?.isConnected ? p.card.getBoundingClientRect() : null);
    };

    const drop = () => {
      const d = dragRef.current;
      if (!d) return;
      const to = d.over;
      if (!validTarget(d, to) || !press.current?.moved) {
        cancelDrag();
        return;
      }
      // Measure the landing spot before the data moves: the slot on top of the column, or the chip.
      const target = d.dock ? overEl.current : board.current?.querySelector<HTMLElement>(`[data-slot="${to}"]`) ?? overEl.current;
      const rect = target?.getBoundingClientRect() ?? null;
      if (!d.dock) setSettling(d.app.id ?? null); // the real card stays hidden until the ghost lands
      moveRef.current(d.app, to, d.dock ? "dock" : "drag");
      settle(rect, d.dock);
    };

    // After a drag the pointer's click must not open the application.
    const swallowClick = () => {
      const block = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };
      window.addEventListener("click", block, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", block, { capture: true }), 400);
    };

    const panelOf = () => board.current?.querySelector<HTMLElement>(`[data-drop="${live.current.current}"]`) ?? null;
    const swipeTo = (dx: number) => {
      const panel = panelOf();
      if (!panel) return;
      const i = COLUMNS.indexOf(live.current.current);
      // Rubber band past the first and last stage.
      const edge = (dx > 0 && i === 0) || (dx < 0 && i === COLUMNS.length - 1);
      panel.style.transform = `translateX(${edge ? dx * 0.3 : dx}px)`;
    };
    const swipeEnd = (p: Press, cancelled: boolean) => {
      const panel = panelOf();
      if (!panel) return;
      const dx = p.x - p.x0;
      const i = COLUMNS.indexOf(live.current.current);
      const dir = dx < 0 ? 1 : -1;
      const next = COLUMNS[i + dir];
      const far = Math.abs(dx) > panel.offsetWidth * 0.25 || (Math.abs(dx) > 40 && Math.abs(p.vx) > 0.4);
      const shown = panel.style.transform;
      panel.style.transform = "";
      if (!cancelled && far && next) {
        slideDir.current = dir;
        setPicked(next);
        return;
      }
      if (shown && !reducedMotion()) play(panel, [{ transform: shown }, { transform: "none" }]);
    };

    const end = () => {
      const p = press.current;
      if (p) clearTimeout(p.timer);
      press.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };

    function onMove(e: PointerEvent) {
      const p = press.current;
      if (!p || e.pointerId !== p.pointerId) return;
      const now = e.timeStamp;
      p.vx = (e.clientX - p.x) / Math.max(1, now - p.t);
      p.t = now;
      p.x = e.clientX;
      p.y = e.clientY;
      if (p.lifted) return; // the frame loop follows the pointer
      const dx = p.x - p.x0;
      const dy = p.y - p.y0;
      if (p.swipe) {
        swipeTo(dx);
        return;
      }
      if (!p.touch) {
        if (Math.hypot(dx, dy) > SLOP_MOUSE) {
          if (p.app) lift();
          else end();
        }
        return;
      }
      if (Math.hypot(dx, dy) <= SLOP_TOUCH) return;
      clearTimeout(p.timer);
      if (live.current.narrow && Math.abs(dx) > Math.abs(dy)) {
        p.swipe = true;
        swipeTo(dx);
      } else end(); // a vertical scroll: the browser takes it
    }
    function onUp(e: PointerEvent) {
      const p = press.current;
      if (!p || e.pointerId !== p.pointerId) return;
      if (p.lifted) {
        swallowClick();
        drop();
      } else if (p.swipe) {
        swallowClick();
        swipeEnd(p, false);
      }
      end();
    }
    function onCancel(e: PointerEvent) {
      const p = press.current;
      if (!p || e.pointerId !== p.pointerId) return;
      if (p.lifted) cancelDrag();
      else if (p.swipe) swipeEnd(p, true);
      end();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || !dragRef.current || !press.current?.lifted) return;
      e.preventDefault();
      if (!press.current.touch) swallowClick(); // the button is still down: its release is no click
      cancelDrag();
      end();
    }

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (press.current || dragRef.current || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-no-drag]")) return;
      const card = target.closest<HTMLElement>("[data-card]");
      const app = card ? findApp(card) : null;
      const touch = e.pointerType !== "mouse";
      // Mouse presses outside a card keep their native meaning (text selection, the scrollbar).
      if (!app && !(touch && live.current.narrow)) return;
      press.current = {
        pointerId: e.pointerId, touch, app: app && app.status !== "withdrawn" ? app : null, card,
        x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: e.timeStamp, vx: 0,
        offX: 0, offY: 0, lifted: false, liftAt: 0, moved: false, swipe: false, timer: 0,
      };
      if (touch && press.current.app) press.current.timer = window.setTimeout(lift, LONG_PRESS);
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    };

    return { onPointerDown, end, finish };
  }, [announce, label, qc, vacancyId]);

  // Once a finger has lifted a card (or is swiping the pager) the page must not scroll under it.
  // This listener has to exist before the touch starts to be allowed to cancel it.
  useEffect(() => {
    const b = board.current;
    if (!b) return;
    const block = (e: TouchEvent) => {
      if (press.current?.lifted || press.current?.swipe) e.preventDefault();
    };
    b.addEventListener("touchmove", block, { passive: false });
    return () => {
      b.removeEventListener("touchmove", block);
      dnd.end();
      dnd.finish();
    };
  }, [dnd]);

  // The ghost lifts off the board: a small tilt and scale with the spring.
  const dragId = drag?.app.id;
  const dragPhone = drag?.phone;
  useLayoutEffect(() => {
    if (!dragId || !ghostCard.current || reducedMotion()) return;
    play(ghostCard.current, [{ rotate: "0deg", scale: "1" }, { rotate: "1.5deg", scale: dragPhone ? "0.94" : "1.03" }], 200, "forwards");
  }, [dragId, dragPhone]);

  const hintPointer = t("kanbanPage.hintPointer");
  const hintTouch = t("kanbanPage.hintTouch");

  return (
    <div>
      {narrow && (
        <SegmentedControl
          label={t("kanbanPage.stages")}
          value={current}
          onChange={pickTab}
          tabs={{ idPrefix: PANELS }}
          className="w-full"
          options={COLUMNS.map((c) => ({ value: c, label: label(c), count: counts?.[c] }))}
        />
      )}
      <div className={cn("flex items-center gap-3", narrow && "mt-3")}>
        <p className="flex min-w-0 flex-1 items-start gap-2 text-sm text-ink-2">
          <Hand aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-3" />
          <span className="pointer-coarse:hidden">{hintPointer}</span>
          <span className="hidden pointer-coarse:inline">{hintTouch}</span>
        </p>
        {!narrow && !(edges.start && edges.end) && (
          <div className="flex shrink-0 gap-1.5">
            <IconButton label={t("kanbanPage.scrollPrev")} variant="secondary" size="sm" shape="pill" disabled={edges.start} onClick={() => scrollPage(-1)}>
              <ChevronLeft className="size-4.5" />
            </IconButton>
            <IconButton label={t("kanbanPage.scrollNext")} variant="secondary" size="sm" shape="pill" disabled={edges.end} onClick={() => scrollPage(1)}>
              <ChevronRight className="size-4.5" />
            </IconButton>
          </div>
        )}
      </div>

      <div
        ref={(el) => {
          board.current = el;
          spot.current = el;
        }}
        onPointerDown={dnd.onPointerDown}
        // A long press on a link would open the browser's link menu instead of lifting the card.
        onContextMenu={(e) => {
          if (press.current?.touch) e.preventDefault();
        }}
        className={cn(
          "mt-4",
          narrow
            ? "touch-pan-y touch-pinch-zoom"
            // relative: absolutely positioned bits inside (sr-only live regions) stay inside the scroller.
            : "relative -mx-4 flex snap-x snap-proximity scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain pb-3 pl-4 pr-8 edge-mask-x",
          drag && "snap-none",
        )}
      >
        {COLUMNS.map((c) => (
          <Column
            key={c}
            vacancyId={vacancyId}
            status={c}
            count={counts?.[c]}
            narrow={narrow}
            active={c === current}
            drag={drag}
            settling={settling}
            onMove={onMenuMove}
          />
        ))}
      </div>

      <p role="status" aria-live="polite" className="sr-only">{message}</p>

      {drag && (
        <div
          ref={ghost}
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 z-50"
          style={{ width: drag.w, transform: `translate3d(${drag.x}px, ${drag.y}px, 0)`, willChange: "transform" }}
        >
          <div ref={ghostCard} className="glass-sheet rounded-control p-4">
            <CardFace a={drag.app} />
          </div>
        </div>
      )}

      {/* Phones show one stage at a time, so a lifted card is dropped on this dock of stages. */}
      {drag?.phone && (
        <div
          aria-hidden="true"
          className={cn("glass-chrome anim-enter fixed inset-x-3 z-40 rounded-sheet p-3", !drag.dockTop && "bottom-above-tabbar")}
          style={drag.dockTop ? { top: "calc(env(safe-area-inset-top) + 0.75rem)" } : undefined}
        >
          <p className="px-1 pb-2 text-sm font-medium text-ink">{t("kanbanPage.dropTo")}</p>
          <div className="grid grid-cols-2 gap-2">
            {COLUMNS.filter((c) => validTarget(drag, c)).map((c) => (
              <div
                key={c}
                data-drop={c}
                data-dock=""
                className={cn(
                  "flex h-12 min-w-0 items-center gap-2 rounded-control px-3 text-md font-medium transition duration-200 ease-spring",
                  drag.over === c && drag.dock ? "scale-[1.04] bg-lapis text-on-lapis" : "bg-surface text-ink",
                )}
              >
                <StatusIcon status={c} />
                <span className="min-w-0 truncate">{label(c)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- column -------------------------------------------------------------------------------

const Column = memo(function Column({ vacancyId, status, count, narrow, active, drag, settling, onMove }: {
  vacancyId: string;
  status: Col;
  count?: number;
  narrow: boolean;
  active: boolean;
  drag: Drag | null;
  settling: string | null;
  onMove: (a: App, to: EmployerTarget) => void;
}) {
  const { t } = useTranslation();
  const q = useInfiniteQuery(colQuery(vacancyId, status));
  const loading = useSkeletonHold(q.isPending);
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.data) ?? [], [q.data]);
  const list = useRef<HTMLUListElement>(null);

  const valid = validTarget(drag, status);
  const over = valid && drag?.over === status && !drag.dock;
  const slot = over && !items.some((a) => a.id === drag!.app.id);
  const muted = !!drag && !valid && status !== drag.from;

  // First paint only: the first 8 cards rise in, staggered; later arrivals don't.
  const enter = useRef<Set<string> | null>(null);
  if (enter.current === null && q.data) enter.current = new Set(items.slice(0, 8).flatMap((a) => (a.id ? [a.id] : [])));

  // Cards that shift (a card leaves, lands or a refetch reorders) glide to their new place.
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const ul = list.current;
    if (!ul) return;
    const next = new Map<string, number>();
    const moved: [HTMLElement, number][] = [];
    for (const li of Array.from(ul.children) as HTMLElement[]) {
      const id = li.dataset.id;
      if (!id) continue;
      next.set(id, li.offsetTop);
      const before = tops.current.get(id);
      if (before != null && before !== li.offsetTop) moved.push([li, before - li.offsetTop]);
    }
    tops.current = next;
    if (!moved.length || reducedMotion()) return;
    for (const [li, dy] of moved) play(li, [{ transform: `translateY(${dy}px)` }, { transform: "none" }]);
  }, [items, slot]);

  const name = t(`enums.application_status.${status}`);
  const headingId = `kanban-col-${status}`;
  const panel = narrow ? segmentedPanelProps(PANELS, status) : { "aria-labelledby": headingId };

  return (
    <section
      data-drop={status}
      {...panel}
      className={cn(
        // Only opacity eases: the phone pager moves this panel under the finger with transforms.
        "flex shrink-0 flex-col rounded-panel bg-sunken/70 p-2 transition-opacity duration-200",
        narrow ? "w-full" : "w-68 snap-start",
        narrow && !active && "hidden",
        over && "bg-lapis-soft/60 shadow-ring",
        muted && "opacity-50",
      )}
    >
      {/* On phones the tab above names the stage; the heading stays for the page outline. */}
      <header className={cn("flex items-center gap-2 px-2 pb-2.5 pt-1", narrow && "sr-only")}>
        <StatusIcon status={status} />
        <h2 id={headingId} className="min-w-0 flex-1 truncate text-md font-semibold text-ink">{name}</h2>
        {count != null && (
          <span className="num min-w-7 rounded-pill bg-surface px-2 text-center text-sm font-semibold text-ink-2 shadow-1">{groupDigits(count)}</span>
        )}
      </header>

      {loading ? (
        <SkeletonDelay><ColumnCardsSkeleton count={2} /></SkeletonDelay>
      ) : q.isError ? (
        <div className="rounded-control bg-surface">
          <ErrorState compact error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : (
        <>
          <ul ref={list} aria-busy={q.isFetching && !q.isFetchingNextPage} className="relative flex flex-col gap-2">
            {slot && (
              <li
                data-slot={status}
                aria-hidden="true"
                className="anim-fade rounded-control border-2 border-dashed border-lapis bg-lapis-soft/50"
                style={{ height: drag!.h }}
              />
            )}
            {items.map((a, i) => {
              const first = a.id != null && enter.current?.has(a.id);
              return (
                <li
                  key={a.id}
                  data-id={a.id}
                  className={first ? "anim-enter" : undefined}
                  style={first ? ({ "--i": i } as React.CSSProperties) : undefined}
                  onAnimationEnd={first ? () => enter.current?.delete(a.id!) : undefined}
                >
                  <KanbanCard a={a} state={a.id === settling ? "settling" : a.id === drag?.app.id ? "dragging" : "idle"} onMove={onMove} />
                </li>
              );
            })}
          </ul>
          {items.length === 0 && !slot && (
            <p className={cn(
              "grid min-h-28 place-items-center rounded-control border border-dashed px-4 py-6 text-center text-sm",
              valid ? "border-lapis text-lapis-ink" : "border-line-strong text-ink-2",
            )}>
              {valid ? t("kanbanPage.dropHere") : t("kanbanPage.columnEmpty")}
            </p>
          )}
          <LoadMore hasNext={!!q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} loadedCount={items.length} />
        </>
      )}
    </section>
  );
});

// ---- card ---------------------------------------------------------------------------------

/** What a card shows; the drag ghost renders the same face without the link. */
function CardFace({ a, link }: { a: App; link?: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const c = a.candidate;
  return (
    <>
      <div className="flex items-start gap-3 pr-8">
        <Avatar name={c.full_name} src={c.avatar_url} size="md" />
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-md font-semibold text-ink"
            style={link ? { viewTransitionName: `application-name-${a.id}` } : undefined}
          >
            {link ? (
              <CardLink to={`/employer/applications/${a.id}`} prefetch="intent" viewTransition draggable={false}>{c.full_name}</CardLink>
            ) : c.full_name}
          </h3>
          <p className="truncate text-sm text-ink-2">{c.resume_title}</p>
        </div>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
        <span className="num inline-flex items-center gap-1.5">
          <Briefcase aria-hidden="true" className="size-3.5 shrink-0 text-ink-3" />
          {experienceText(c.experience_months, t)}
        </span>
        {c.desired_salary && (
          <span className="num font-semibold text-firuza-ink">
            {money(c.desired_salary.amount, c.desired_salary.currency === "USD" ? "USD" : "UZS", t, locale)}
          </span>
        )}
      </p>
      <div className="mt-2 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
        {a.created_at && <RelTime iso={a.created_at} />}
        {a.source === "invite" && <Badge tone="lapis" icon={<Send />}>{t("employer.invitedByYou")}</Badge>}
      </div>
    </>
  );
}

const KanbanCard = memo(function KanbanCard({ a, state, onMove }: {
  a: App;
  state: "idle" | "dragging" | "settling";
  onMove: (a: App, to: EmployerTarget) => void;
}) {
  const { t } = useTranslation();
  const movable = a.status !== "withdrawn";
  return (
    <Card
      as="article"
      radius="control"
      padding="sm"
      interactive
      data-card={a.id}
      data-col={a.status}
      // The browser's own link drag would fight the pointer drag.
      onDragStart={(e: React.DragEvent) => e.preventDefault()}
      className={cn(
        // No text selection or iOS link callout on the long press that lifts the card.
        "spotlight group select-none [-webkit-touch-callout:none]",
        movable && "pointer-fine:cursor-grab",
        state === "dragging" && "opacity-40",
        state === "settling" && "opacity-0",
      )}
    >
      <CardFace a={a} link />
      {movable && (
        // Keyboard and touch path to the same move: always visible on touch, on hover or focus with a mouse.
        <div data-no-drag className={cn("absolute right-2 top-2 z-10", state !== "idle" && "invisible")}>
          <Popover
            label={t("kanbanPage.cardMenu", { name: a.candidate.full_name })}
            className="w-64"
            trigger={(p) => (
              <IconButton
                label={p["aria-label"]}
                popoverTarget={p.popoverTarget}
                size="sm"
                shape="pill"
                className="pointer-fine:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 group-has-[:popover-open]:opacity-100"
              >
                <MoreHorizontal className="size-4.5" />
              </IconButton>
            )}
          >
            <StageMenuItems current={a.status} onPick={(s) => onMove(a, s)} />
            <div aria-hidden="true" className="-mx-1.5 my-1.5 h-px bg-line" />
            <LocalizedLink to={`/employer/applications/${a.id}`} prefetch="intent" className={popoverItem}>
              {/* Same 24px icon column as the stage rows above, so the labels line up. */}
              <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center text-ink-3"><ArrowUpRight className="size-4" /></span>
              {t("kanbanPage.openApplication")}
            </LocalizedLink>
          </Popover>
        </div>
      )}
    </Card>
  );
});

// ---- loading shapes -----------------------------------------------------------------------

/** A text line of the given type size: a bar inside a real line box, so heights match the text. */
function Line({ size, className }: { size: string; className: string }) {
  return <div className={size}><Skeleton className={cn("inline-block h-3.5 align-middle", className)} /></div>;
}

/** Cards of a column while it loads (same card box, avatar and three text rows). */
function ColumnCardsSkeleton({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2">
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} radius="control" padding="sm" aria-hidden="true">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Line size="text-md" className="w-3/4" />
              <Line size="text-sm" className="w-1/2" />
            </div>
          </div>
          <Line size="mt-3 text-sm" className="w-2/3" />
          <div className="mt-2 flex h-6 items-center"><Skeleton className="h-3 w-20" /></div>
        </Card>
      ))}
    </div>
  );
}

/** Board-shaped placeholder while the stage counts load (one column on phones). */
function KanbanColumnSkeleton({ cards = 2, className }: { cards?: number; className?: string }) {
  return (
    <div className={cn("flex w-full shrink-0 flex-col rounded-panel bg-sunken/70 p-2 md:w-68", className)}>
      <div className="flex items-center gap-2 px-2 pb-2.5 pt-1 max-md:hidden">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto h-5 w-7" />
      </div>
      <ColumnCardsSkeleton count={cards} />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="mb-3 h-11 w-full md:hidden" />
      <div className="flex h-5 items-center"><Skeleton className="h-3.5 w-3/4 max-w-sm" /></div>
      <div className="mt-4 flex gap-3 overflow-hidden">
        {[3, 2, 1, 1].map((n, i) => <KanbanColumnSkeleton key={i} cards={n} className={i > 0 ? "max-md:hidden" : undefined} />)}
      </div>
    </div>
  );
}
