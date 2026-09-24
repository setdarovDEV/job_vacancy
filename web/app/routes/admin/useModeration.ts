import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";

import { api, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { useTranslation } from "~/shared/i18n/i18n";
import { ApiFailure, authed, authedPage, type Page } from "~/shared/query/query";
import { toast } from "~/shared/ui/toast-store";

export type QueueVacancy = Schemas["VacancyCard"];
type CompanyRef = QueueVacancy["company"];
type Data = InfiniteData<Page<QueueVacancy>, string | undefined>;

export const QUEUE_KEY = ["admin-moderation"] as const;
const PAGE_SIZE = 20;

/** The moderation queue, oldest submission first (the API's order), cursor-paginated. */
export function useQueue() {
  return useInfiniteQuery({
    queryKey: QUEUE_KEY,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => authedPage<QueueVacancy>(() =>
      api.GET("/admin/vacancies/moderation", { params: { query: { cursor: pageParam, limit: PAGE_SIZE } } })),
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
  });
}

/* ---- cache edits ------------------------------------------------------------------------ */

/** Where a removed row sat, so a failed decision can put exactly that row back. */
type Removed = { row: QueueVacancy; page: number; index: number } | null;

function removeRow(qc: QueryClient, id: string): Removed {
  const data = qc.getQueryData<Data>(QUEUE_KEY);
  if (!data) return null;
  let removed: Removed = null;
  const pages = data.pages.map((p, page) => {
    const index = p.data.findIndex((v) => v.id === id);
    if (index < 0) return p;
    removed = { row: p.data[index]!, page, index };
    return { ...p, data: p.data.filter((v) => v.id !== id) };
  });
  qc.setQueryData<Data>(QUEUE_KEY, { ...data, pages });
  return removed;
}

// Re-inserts one row instead of restoring a whole snapshot: other decisions made meanwhile
// (a fast moderator clears several rows in a second) must not come back with it.
function restoreRow(qc: QueryClient, r: Removed) {
  const data = qc.getQueryData<Data>(QUEUE_KEY);
  if (!r || !data || data.pages.some((p) => p.data.some((v) => v.id === r.row.id))) return;
  const pages = data.pages.map((p, i) => {
    if (i !== Math.min(r.page, data.pages.length - 1)) return p;
    const next = [...p.data];
    next.splice(Math.min(r.index, next.length), 0, r.row);
    return { ...p, data: next };
  });
  qc.setQueryData<Data>(QUEUE_KEY, { ...data, pages });
}

/** A company's badge shows on every queued vacancy of that company. */
function patchCompany(qc: QueryClient, companyId: string, verified: boolean) {
  const data = qc.getQueryData<Data>(QUEUE_KEY);
  if (!data) return;
  qc.setQueryData<Data>(QUEUE_KEY, {
    ...data,
    pages: data.pages.map((p) => ({
      ...p,
      data: p.data.map((v) => (v.company.id === companyId ? { ...v, company: { ...v.company, verified } } : v)),
    })),
  });
}

/* ---- decisions -------------------------------------------------------------------------- */

type RejectVars = { v: QueueVacancy; reason: string };
type VerifyVars = { company: CompanyRef; verified: boolean };

/**
 * Approve / reject / (un)verify with an instant UI: the row leaves the queue (or the badge flips)
 * before the server answers; a failure puts it back and offers a retry. A vacancy another
 * moderator already handled (404/409) stays gone.
 */
export function useModeration() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // One refetch after the last in-flight decision, not one per click: refetching mid-burst would
  // briefly bring back rows whose decisions are still on the way.
  const settle = (id?: string) => {
    if (id) void qc.invalidateQueries({ queryKey: ["vacancy", id] });
    if (qc.isMutating({ mutationKey: QUEUE_KEY }) <= 1) void qc.invalidateQueries({ queryKey: QUEUE_KEY });
  };
  const begin = async (id: string) => {
    await qc.cancelQueries({ queryKey: QUEUE_KEY });
    return removeRow(qc, id);
  };
  const failed = (e: Error, removed: Removed | undefined, retry: () => void) => {
    if (e instanceof ApiFailure && (e.status === 404 || e.status === 409)) {
      toast({ tone: "info", title: t("adminPage.handled") });
      return;
    }
    restoreRow(qc, removed ?? null);
    toast({
      tone: "error",
      title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network"),
      action: { label: t("common.retry"), onClick: retry },
    });
  };

  const approve = useMutation<unknown, Error, QueueVacancy, Removed>({
    mutationKey: QUEUE_KEY,
    mutationFn: (v) => authed(() => api.POST("/admin/vacancies/{vacancy}/approve", { params: { path: { vacancy: v.id } } })),
    onMutate: (v) => begin(v.id),
    onSuccess: (_d, v) => toast({ tone: "success", title: t("adminPage.approved", { title: v.title }), body: t("adminPage.approvedBody") }),
    onError: (e, v, removed) => failed(e, removed, () => approveNow(v)),
    onSettled: (_d, _e, v) => settle(v.id),
  });

  const reject = useMutation<unknown, Error, RejectVars, Removed>({
    mutationKey: QUEUE_KEY,
    mutationFn: ({ v, reason }) => authed(() =>
      api.POST("/admin/vacancies/{vacancy}/reject", { params: { path: { vacancy: v.id } }, body: { reason } })),
    onMutate: ({ v }) => begin(v.id),
    onSuccess: (_d, { v }) => toast({ tone: "success", title: t("adminPage.rejected", { title: v.title }), body: t("adminPage.rejectedBody") }),
    // The typed reason survives a failure: Retry sends the same text again.
    onError: (e, vars, removed) => failed(e, removed, () => rejectNow(vars)),
    onSettled: (_d, _e, { v }) => settle(v.id),
  });

  const verify = useMutation<Schemas["Company"], Error, VerifyVars, boolean>({
    mutationKey: QUEUE_KEY,
    mutationFn: ({ company, verified }) => authed(() => {
      const path = { params: { path: { company: company.id } } };
      return verified ? api.PUT("/admin/companies/{company}/verification", path) : api.DELETE("/admin/companies/{company}/verification", path);
    }),
    onMutate: async ({ company, verified }) => {
      await qc.cancelQueries({ queryKey: QUEUE_KEY });
      patchCompany(qc, company.id, verified);
      return company.verified;
    },
    onSuccess: (c, { company }) => {
      patchCompany(qc, company.id, c.verified);
      toast({ tone: "success", title: t(c.verified ? "adminPage.verified" : "adminPage.unverified", { name: company.name }) });
    },
    onError: (e, vars, before) => {
      patchCompany(qc, vars.company.id, before ?? vars.company.verified);
      toast({
        tone: "error",
        title: e instanceof ApiFailure ? errorText(t, e.error) : t("errors.network"),
        action: { label: t("common.retry"), onClick: () => verifyNow(vars) },
      });
    },
    onSettled: () => settle(),
  });

  function approveNow(v: QueueVacancy): void {
    approve.mutate(v);
  }
  function rejectNow(vars: RejectVars): void {
    reject.mutate(vars);
  }
  function verifyNow(vars: VerifyVars): void {
    verify.mutate(vars);
  }

  return {
    approve: approveNow,
    reject: rejectNow,
    verify: verifyNow,
    /** The company whose badge is being changed right now (its menu shows a spinner). */
    verifying: verify.isPending ? verify.variables?.company.id : undefined,
  };
}
export type Moderation = ReturnType<typeof useModeration>;
