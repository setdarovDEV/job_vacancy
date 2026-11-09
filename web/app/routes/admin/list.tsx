import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { Page } from "~/shared/query/query";
import { LoadMore } from "~/shared/query/LoadMore";
import { EmptyState } from "~/shared/ui/EmptyState";
import { Skeleton } from "~/shared/ui/Skeleton";

export type CursorList<T> = {
  items: T[];
  isPending: boolean;
  hasNext: boolean;
  loadingMore: boolean;
  loadMore: () => void;
};

/** A cursor-paginated list: fetchPage gets the cursor of the page to load (undefined first). */
export function useCursorList<T>(key: QueryKey, fetchPage: (cursor: string | undefined) => Promise<Page<T>>): CursorList<T> {
  const q = useInfiniteQuery({
    queryKey: key,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
  return {
    items: q.data?.pages.flatMap((p) => p.data) ?? [],
    isPending: q.isPending,
    hasNext: q.hasNextPage,
    loadingMore: q.isFetchingNextPage,
    loadMore: () => void q.fetchNextPage(),
  };
}

/** Loading skeleton, empty state, or the rows in one glass panel, plus "load more". */
export function AdminList<T>({ list, empty, getKey, renderRow }: {
  list: CursorList<T>;
  empty: { icon: ReactNode; title: string; body?: string };
  getKey: (item: T) => string;
  renderRow: (item: T) => ReactNode;
}) {
  return (
    <>
      {list.isPending ? (
        <div className="flex flex-col gap-2"><Skeleton className="h-20 rounded-panel" /><Skeleton className="h-20 rounded-panel" /></div>
      ) : list.items.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface">
          <EmptyState icon={empty.icon} title={empty.title} body={empty.body} />
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
          {list.items.map((item) => <li key={getKey(item)}>{renderRow(item)}</li>)}
        </ul>
      )}
      <LoadMore hasNext={list.hasNext} loading={list.loadingMore} onClick={list.loadMore} />
    </>
  );
}
