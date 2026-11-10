import { Bug, Check, Lightbulb, MessageCircle, MessageSquareText, Undo2 } from "lucide-react";

import { AdminOnly, useUrlFilters } from "./admin-ui";
import { adminKeys } from "./keys";
import { AdminList, useCursorList } from "./list";
import { useToggleResource } from "./toggle";
import { api, type Schemas } from "~/shared/api/client";
import { useTranslation } from "~/shared/i18n/i18n";
import { relativeTime } from "~/shared/lib/format";
import { authed, authedPage } from "~/shared/query/query";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Chip } from "~/shared/ui/Chip";
import { PageHeader } from "~/shared/ui/Section";

type Feedback = Schemas["Feedback"];
type Status = "open" | "handled";
const STATUSES: Status[] = ["open", "handled"];
const isStatus = (v: string): v is Status => (STATUSES as string[]).includes(v);
const KEYS = ["status"] as const;

const categoryIcon = { bug: Bug, idea: Lightbulb, other: MessageCircle } as const;
const categoryTone = { bug: "anor", idea: "zafaron", other: "neutral" } as const;

export default function AdminFeedback() {
  return <AdminOnly><Page /></AdminOnly>;
}

function Page() {
  const { t } = useTranslation();
  const { values, set } = useUrlFilters(KEYS);
  const status: Status = isStatus(values.status) ? values.status : "open";
  const list = useCursorList<Feedback>(adminKeys.feedback({ status }), (cursor) =>
    authedPage(() => api.GET("/admin/feedback", { params: { query: { status, cursor } } })));
  return (
    <>
      <PageHeader title={t("admin.nav.feedback")} description={t("admin.feedback.hint")} />
      <div className="mb-4 flex gap-2">
        {STATUSES.map((s) => (
          <Chip key={s} selected={status === s} onClick={() => set("status", s === "open" ? "" : s)}>{t(`admin.feedback.view.${s}`)}</Chip>
        ))}
      </div>
      <AdminList
        list={list}
        empty={{ icon: <MessageSquareText className="size-6" />, title: t("admin.feedback.empty") }}
        getKey={(f) => f.id}
        renderRow={(f) => <Row f={f} />}
      />
    </>
  );
}

function Row({ f }: { f: Feedback }) {
  const { t } = useTranslation();
  const path = { params: { path: { feedback: f.id } } };
  const handled = useToggleResource({
    set: () => authed<Feedback>(() => api.PUT("/admin/feedback/{feedback}/handled", path)),
    clear: () => authed<Feedback>(() => api.DELETE("/admin/feedback/{feedback}/handled", path)),
    done: { set: t("admin.feedback.handledToast"), clear: t("admin.feedback.reopenedToast") },
    invalidate: [adminKeys.feedback()],
  });
  const Icon = categoryIcon[f.category];
  return (
    <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:gap-5 lg:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
          <Badge tone={categoryTone[f.category]}><Icon className="size-3.5" />{t(`feedback.categories.${f.category}`)}</Badge>
          <span>{relativeTime(f.created_at, t)}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{f.user ? (f.user.name ?? f.user.email ?? "—") : t("admin.feedback.anonymous")}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-ink">{f.message}</p>
        <dl className="mt-2 flex flex-col gap-1 text-sm text-ink-2">
          {f.contact && <div className="flex gap-2"><dt className="text-ink-3">{t("feedback.contact")}:</dt><dd className="min-w-0 break-all">{f.contact}</dd></div>}
          {f.page_url && <div className="flex gap-2"><dt className="text-ink-3">{t("admin.feedback.page")}:</dt><dd className="min-w-0 break-all"><PageLink url={f.page_url} /></dd></div>}
        </dl>
      </div>
      <div className="shrink-0">
        {f.handled_at ? (
          <Button size="sm" variant="ghost" icon={<Undo2 className="size-4" />} loading={handled.isPending} onClick={() => handled.mutate(false)}>{t("admin.feedback.reopen")}</Button>
        ) : (
          <Button size="sm" variant="secondary" icon={<Check className="size-4" />} loading={handled.isPending} onClick={() => handled.mutate(true)}>{t("admin.feedback.markHandled")}</Button>
        )}
      </div>
    </div>
  );
}

/** A link only to pages of this site; anything else is shown as text. */
function PageLink({ url }: { url: string }) {
  let sameOrigin = false;
  try {
    sameOrigin = typeof location !== "undefined" && new URL(url).origin === location.origin;
  } catch {
    // not a URL
  }
  if (!sameOrigin) return <span>{url}</span>;
  return <a href={url} className="text-lapis-ink hover:underline" target="_blank" rel="noreferrer noopener">{url}</a>;
}
