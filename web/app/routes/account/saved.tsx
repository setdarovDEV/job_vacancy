import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { SeekerOnly } from "./layout";
import { api, type Schemas } from "~/shared/api/client";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { useSpotlight } from "~/shared/lib/spotlight";
import { authedPage, type Page } from "~/shared/query/query";
import { LoadMore } from "~/shared/query/LoadMore";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { PageHeader } from "~/shared/ui/Section";
import { SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";
import { useSaved } from "~/shared/vacancy/saved";
import { VacancyListSkeleton, VacancyRow } from "~/shared/vacancy/VacancyRow";

type Vacancy = Schemas["VacancyCard"];
type Data = InfiniteData<Page<Vacancy>, string | undefined>;
const KEY = ["saved-vacancies"];

export default function Saved() {
  return <SeekerOnly><List /></SeekerOnly>;
}

// Where an unsaved row sat, so it can return to the same place.
type Removed = { v: Vacancy; page: number; index: number };

function List() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: KEY,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => authedPage<Vacancy>(() => api.GET("/me/saved-vacancies", { params: { query: { cursor: pageParam } } })),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
  const loading = useSkeletonHold(q.isPending);
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];

  const entered = useRef(false);
  useEffect(() => {
    if (q.data) entered.current = true;
  }, [q.data]);
  const enter = !entered.current;

  const removed = useRef(new Map<string, Removed>());
  const [watching, setWatching] = useState<string[]>([]);
  const bump = useCallback(
    (d: number) => qc.setQueryData<{ saved: number | null }>(["account-summary"], (s) => (s && s.saved != null ? { ...s, saved: Math.max(0, s.saved + d) } : s)),
    [qc],
  );

  /*
   * Unsaving happens in the row's heart: the shared SaveButton updates the saved store at once
   * and offers Undo in its own toast. The list follows the store: a row whose heart empties
   * leaves the list; when the store says "saved" again (Undo, or the server refused and the
   * store rolled back) the row returns to its place.
   */
  const onUnsaved = useCallback(
    (v: Vacancy) => {
      const data = qc.getQueryData<Data>(KEY);
      if (!data) return;
      let page = 0;
      let index = -1;
      data.pages.forEach((p, pi) => {
        const i = p.data.findIndex((x) => x.id === v.id);
        if (i >= 0) [page, index] = [pi, i];
      });
      if (index < 0) return;
      qc.setQueryData<Data>(KEY, { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.filter((x) => x.id !== v.id) })) });
      bump(-1);
      removed.current.set(v.id, { v, page, index });
      setWatching((w) => [...w, v.id]);
    },
    [qc, bump],
  );

  const onSavedAgain = useCallback(
    (id: string) => {
      const r = removed.current.get(id);
      if (!r) return;
      removed.current.delete(id);
      setWatching((w) => w.filter((x) => x !== id));
      qc.setQueryData<Data>(KEY, (data) => {
        if (!data || data.pages.some((p) => p.data.some((x) => x.id === id))) return data;
        const pi = Math.min(r.page, data.pages.length - 1);
        return {
          ...data,
          pages: data.pages.map((p, i) => (i === pi ? { ...p, data: [...p.data.slice(0, r.index), r.v, ...p.data.slice(r.index)] } : p)),
        };
      });
      bump(1);
    },
    [qc, bump],
  );

  return (
    <>
      <PageHeader title={t("nav.saved")} description={t("savedPage.hint")} />
      {watching.map((id) => <SavedWatch key={id} id={id} onSaved={onSavedAgain} />)}
      {loading ? (
        <SkeletonDelay>
          <VacancyListSkeleton count={3} />
        </SkeletonDelay>
      ) : q.isError && !items.length ? (
        <Card padding="none">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Card>
      ) : items.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<Heart />}
            title={t("savedPage.emptyTitle")}
            body={t("savedPage.emptyBody")}
            action={<Button asChild><LocalizedLink to="/vacancies" prefetch="intent">{t("accountPage.findJobs")}</LocalizedLink></Button>}
          />
        </Card>
      ) : (
        <SavedList items={items} onUnsaved={onUnsaved} enter={enter} />
      )}
      <LoadMore hasNext={q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()} loadedCount={items.length} className="mt-4" />
    </>
  );
}

// Own component so the spotlight listener binds when the list itself mounts (after loading).
function SavedList({ items, onUnsaved, enter }: { items: Vacancy[]; onUnsaved: (v: Vacancy) => void; enter: boolean }) {
  const { t } = useTranslation();
  const list = useSpotlight<HTMLUListElement>();
  return (
    <ul ref={list} aria-label={t("nav.saved")} className="flex flex-col gap-3">
      {items.map((v, i) => (
        <SavedRow key={v.id} v={v} onUnsaved={onUnsaved} index={enter ? i : undefined} priority={i < 3} />
      ))}
    </ul>
  );
}

function SavedRow({ v, onUnsaved, index, priority }: { v: Vacancy; onUnsaved: (v: Vacancy) => void; index?: number; priority?: boolean }) {
  const saved = useSaved(v.id);
  // The saved-ids store may still be loading on mount (false): only a true → false change counts.
  const was = useRef(false);
  useEffect(() => {
    if (saved) was.current = true;
    else if (was.current) {
      was.current = false;
      onUnsaved(v);
    }
  }, [saved, v, onUnsaved]);
  return (
    <li className="min-w-0">
      <VacancyRow v={v} showStatus index={index} priority={priority} headingAs="h2" />
    </li>
  );
}

/** Invisible: reports when a removed vacancy is saved again (Undo, or a failed removal rolled back). */
function SavedWatch({ id, onSaved }: { id: string; onSaved: (id: string) => void }) {
  const saved = useSaved(id);
  useEffect(() => {
    if (saved) onSaved(id);
  }, [saved, id, onSaved]);
  return null;
}
