import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CircleCheck, LogOut } from "lucide-react";
import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";

import { api, type Schemas } from "~/shared/api/client";
import type { AppStatus } from "~/shared/application/status";
import { useSession, type User } from "~/shared/auth/session";
import { stripLocale } from "~/shared/i18n/config";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { accountLinks, useSignOut, useUnread, type AccountLink } from "~/shared/layout/UserArea";
import { cn } from "~/shared/lib/cn";
import { groupDigits } from "~/shared/lib/format";
import { authed, authedPage } from "~/shared/query/query";
import { Avatar } from "~/shared/ui/Avatar";
import { Card } from "~/shared/ui/Card";
import { EmptyState } from "~/shared/ui/EmptyState";
import { Progress } from "~/shared/ui/Progress";
import { Skeleton } from "~/shared/ui/Skeleton";

/* ---- account data shared by the layout and its pages ------------------------------------ */

type Summary = { resumes: number | null; saved: number | null; searches: number | null };

/**
 * Sizes of the seeker's lists for the section nav and the profile meter. Each call is allowed to
 * fail on its own (the count just disappears); the nav never waits for it.
 */
export function useAccountSummary(enabled: boolean) {
  return useQuery({
    queryKey: ["account-summary"],
    enabled,
    staleTime: 10_000,
    queryFn: async (): Promise<Summary> => {
      const [resumes, saved, searches] = await Promise.allSettled([
        authed<unknown[]>(() => api.GET("/me/resumes")),
        authed<string[]>(() => api.GET("/me/saved-vacancies/ids")),
        authed<unknown[]>(() => api.GET("/me/saved-searches")),
      ]);
      const size = (r: PromiseSettledResult<unknown>) => (r.status === "fulfilled" && Array.isArray(r.value) ? r.value.length : null);
      return { resumes: size(resumes), saved: size(saved), searches: size(searches) };
    },
  });
}

export type AppCounts = { total: number; by: Partial<Record<AppStatus, number>>; complete: boolean };

// The API has no per-status totals: count the seeker's applications from the list itself, at most
// 4 pages of 50. Beyond that the numbers would be partial, so `complete` is false and callers
// show "200+" or no number at all rather than a wrong one.
const COUNT_PAGES = 4;

/** Applications per status. Shares the ["my-applications"] prefix, so any change there refreshes it. */
export function useApplicationCounts(enabled = true) {
  return useQuery({
    queryKey: ["my-applications", "counts"],
    enabled,
    staleTime: 10_000,
    queryFn: async (): Promise<AppCounts> => {
      const by: Partial<Record<AppStatus, number>> = {};
      let total = 0;
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await authedPage<Schemas["Application"]>(() =>
          api.GET("/me/applications", { params: { query: { limit: 50, cursor } } }),
        );
        for (const a of page.data) {
          const s = (a.status ?? "sent") as AppStatus;
          by[s] = (by[s] ?? 0) + 1;
          total++;
        }
        cursor = page.meta.next_cursor ?? undefined;
      } while (cursor && ++pages < COUNT_PAGES);
      return { total, by, complete: !cursor };
    },
  });
}

export type ProfileStep = { id: "photo" | "email" | "phone" | "resume"; done: boolean; to: string };

/**
 * What a complete seeker profile has: a photo, confirmed contacts and at least one resume.
 * Email counts only when the account has one (phone sign-ups can't add an email yet).
 */
export function profileSteps(user: User, resumes: number): ProfileStep[] {
  const steps: ProfileStep[] = [{ id: "photo", done: !!user.avatar_url, to: "/me#profile" }];
  if (user.email) {
    steps.push({
      id: "email",
      done: user.email_verified,
      to: user.email_verified ? "/me#contacts" : `/verify-email?email=${encodeURIComponent(user.email)}&next=/me`,
    });
  }
  steps.push({ id: "phone", done: user.phone_verified, to: "/me#contacts" });
  steps.push({ id: "resume", done: resumes > 0, to: resumes > 0 ? "/me/resumes" : "/me/resumes/new" });
  return steps;
}

/** Profile meter: percentage of finished steps and a link to the next one. */
export function ProfileMeter({ user, resumes, className }: { user: User; resumes: number; className?: string }) {
  const { t } = useTranslation();
  const steps = profileSteps(user, resumes);
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  const next = steps.find((s) => !s.done);
  return (
    <div className={className}>
      <Progress value={pct} label={t("accountPage.completeness")} showValue size="sm" tone={next ? "lapis" : "firuza"} />
      {next ? (
        <LocalizedLink
          to={next.to}
          className="group mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-lapis-ink hover:underline"
        >
          <span className="text-ink-2">{t("accountPage.nextStep")}:</span>
          {t(`accountPage.steps.${next.id}`)}
          <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 transition-transform duration-200 ease-spring group-hover:translate-x-0.5" />
        </LocalizedLink>
      ) : (
        <p className="mt-2 flex min-h-11 items-center gap-1.5 text-sm text-firuza-ink">
          <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
          {t("accountPage.completeDone")}
        </p>
      )}
    </div>
  );
}

/** Same height as ProfileMeter (label row + bar + 44px link), so nothing moves when it arrives. */
export function MeterSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex h-21 flex-col gap-2.5 pt-0.5", className)}>
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="h-1.5" />
      <Skeleton className="mt-2.5 h-3.5 w-1/2" />
    </div>
  );
}

/* ---- layout ------------------------------------------------------------------------------ */

type NavItem = AccountLink & { count?: number | null; more?: boolean; unread?: number };

// The deepest link whose path is a prefix of the current one: /me/resumes/new → "Rezyumelarim",
// /employer/vacancies/:id/applications → "Kabinet", /me → "Sozlamalar".
function activeOf(links: AccountLink[], path: string) {
  let best: string | null = null;
  for (const l of links) {
    if ((path === l.to || path.startsWith(`${l.to}/`)) && (!best || l.to.length > best.length)) best = l.to;
  }
  return best;
}

function useNavItems(user: User): NavItem[] {
  const seeker = user.role !== "employer";
  const unread = useUnread(true);
  const summary = useAccountSummary(seeker).data;
  const apps = useApplicationCounts(seeker).data;
  return accountLinks(user).map((l) => {
    switch (l.to) {
      case "/me/resumes": return { ...l, count: summary?.resumes };
      case "/me/applications": return { ...l, count: apps?.total, more: apps ? !apps.complete : false };
      case "/me/saved": return { ...l, count: summary?.saved };
      case "/me/searches": return { ...l, count: summary?.searches };
      case "/chat": return { ...l, unread: unread.chats };
      case "/me/notifications": return { ...l, unread: unread.notifications };
      default: return l;
    }
  });
}

/** Totals are quiet numbers; unread counts are a tinted pill with a spoken "N new". */
function NavCount({ item, active, onGlass }: { item: NavItem; active: boolean; onGlass?: boolean }) {
  const { t } = useTranslation();
  if (item.unread) {
    return (
      <>
        <span aria-hidden="true" className="num grid h-5 min-w-5 place-items-center rounded-pill bg-anor-soft px-1.5 text-xs font-semibold text-anor-ink">
          {item.unread > 99 ? "99+" : item.unread}
        </span>
        <span className="sr-only">, {t("shell.newCount", { count: item.unread })}</span>
      </>
    );
  }
  if (!item.count) return null;
  return (
    <span className={cn("num text-sm", active ? "text-lapis-ink" : onGlass ? "text-ink-2" : "text-ink-3")}>
      <span className="sr-only">, </span>
      {groupDigits(item.count)}
      {item.more && "+"}
    </span>
  );
}

const pressable = "transition-[background-color,color,scale] duration-150 ease-spring active:scale-[0.97]";

/**
 * Cabinet frame for seekers and employers. From lg a sticky sidebar card (who you are, how
 * complete the profile is, sections with counts); below lg a strip of section pills that docks
 * under the header and turns to glass together with it once the page scrolls. The geometry
 * matches the signed-out placeholder in private.tsx, so restoring the session doesn't shift.
 */
export default function AccountLayout() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const items = useNavItems(user!);
  const current = activeOf(items, stripLocale(pathname));
  const strip = useRef<HTMLUListElement>(null);
  const seen = useRef<string | null>(null);

  useEffect(() => {
    // Phones: centre the current section in the strip. scrollTo on the strip itself never
    // scrolls the page vertically (scrollIntoView might).
    const ul = strip.current;
    const a = ul?.querySelector<HTMLElement>("[aria-current=page]");
    if (ul && a && ul.scrollWidth > ul.clientWidth) {
      const smooth = seen.current !== null && !matchMedia("(prefers-reduced-motion: reduce)").matches;
      ul.scrollTo({ left: a.offsetLeft - (ul.clientWidth - a.offsetWidth) / 2, behavior: smooth ? "smooth" : "instant" });
    }
    // Counts go stale when other pages change things (a new resume, a save on a vacancy):
    // refresh the ones older than their staleTime on every section change, not on the first render.
    if (seen.current !== null && seen.current !== pathname) {
      void qc.refetchQueries({ queryKey: ["account-summary"], stale: true, type: "active" });
      void qc.refetchQueries({ queryKey: ["my-applications", "counts"], stale: true, type: "active" });
    }
    seen.current = pathname;
  }, [pathname, qc]);

  return (
    <div className="container-page pb-16 pt-4 md:pb-24 md:pt-8 lg:pt-10">
      {/* Phones and tablets: section strip. Clear at rest, glass once docked (header-glass
          materializes with the page scroll, in step with the site header above it). */}
      <nav aria-label={t("account.menu")} className="sticky top-(--header-h) z-30 isolate -mx-4 md:-mx-6 lg:hidden">
        <div aria-hidden="true" className="header-glass glass-bar" />
        <ul ref={strip} className="scrollbar-none edge-mask-x flex gap-1 overflow-x-auto overscroll-x-contain px-4 py-2 md:px-6">
          {items.map((l) => {
            const on = l.to === current;
            const Icon = l.icon;
            return (
              <li key={l.to} className="shrink-0">
                <LocalizedLink
                  to={l.to}
                  prefetch="intent"
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    // relative: the sr-only count text must stay inside the scroller (no page overflow).
                    "relative flex h-11 items-center gap-2 whitespace-nowrap rounded-pill px-4 text-md font-medium",
                    pressable,
                    on ? "bg-lapis-soft text-lapis-ink" : "text-ink-2 hover:bg-sunken hover:text-ink",
                  )}
                >
                  {Icon && <Icon aria-hidden="true" className="size-4.5 shrink-0" />}
                  {t(l.key)}
                  <NavCount item={l} active={on} onGlass />
                </LocalizedLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-4 grid gap-6 lg:mt-0 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden lg:block">
          <Sidebar user={user!} items={items} current={current} />
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function Sidebar({ user, items, current }: { user: User; items: NavItem[]; current: string | null }) {
  const { t } = useTranslation();
  const signOut = useSignOut();
  const seeker = user.role !== "employer";
  const summary = useAccountSummary(seeker);
  return (
    <Card padding="none" className="sticky top-24 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.full_name} src={user.avatar_url} size="lg" priority />
          <div className="min-w-0 flex-1">
            <p className="truncate text-md font-semibold text-ink" title={user.full_name}>{user.full_name}</p>
            <p className="truncate text-sm text-ink-2">{t(`accountPage.role.${user.role}`)}</p>
          </div>
        </div>
        {seeker &&
          // Same height while loading, so the nav below never jumps.
          (summary.data?.resumes != null ? (
            <ProfileMeter user={user} resumes={summary.data.resumes} className="mt-4" />
          ) : summary.isPending ? (
            <MeterSkeleton className="mt-4" />
          ) : null)}
      </div>
      <nav aria-label={t("account.menu")} className="border-t border-line p-2">
        <ul className="flex flex-col gap-0.5">
          {items.map((l) => {
            const on = l.to === current;
            const Icon = l.icon;
            return (
              <li key={l.to}>
                <LocalizedLink
                  to={l.to}
                  prefetch="intent"
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 items-center gap-3 rounded-control px-3 text-md font-medium",
                    pressable,
                    on ? "bg-lapis-soft text-lapis-ink" : "text-ink-2 hover:bg-sunken hover:text-ink",
                  )}
                >
                  {Icon && <Icon aria-hidden="true" className={cn("size-4.5 shrink-0", on ? "text-lapis-ink" : "text-ink-3")} />}
                  <span className="min-w-0 flex-1 truncate">{t(l.key)}</span>
                  <NavCount item={l} active={on} />
                </LocalizedLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-line p-2">
        <button
          type="button"
          onClick={signOut}
          className={cn("flex h-11 w-full items-center gap-3 rounded-control px-3 text-md font-medium text-ink-2 hover:bg-anor-soft hover:text-anor-ink", pressable)}
        >
          <LogOut aria-hidden="true" className="size-4.5 shrink-0" />
          {t("nav.signOut")}
        </button>
      </div>
    </Card>
  );
}

/** Wraps seeker-only pages: an employer who follows a link gets an explanation, not an error. */
export function SeekerOnly({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useSession();
  if (user?.role !== "employer") return <>{children}</>;
  return (
    <Card padding="none">
      <EmptyState title={t("apiErrors.seeker_only")} />
    </Card>
  );
}
