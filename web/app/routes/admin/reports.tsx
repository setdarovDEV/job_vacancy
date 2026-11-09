import { BriefcaseBusiness, Check, Flag, ShieldX, Trash2 } from "lucide-react";
import { useState } from "react";

import { AdminOnly, MIN_REASON_LENGTH, NoteDialog, useUrlFilters } from "./admin-ui";
import { adminKeys } from "./keys";
import { AdminList, useCursorList } from "./list";
import { BlockToggle, useAdminMutation, useToggleResource } from "./toggle";
import { api, type Schemas } from "~/shared/api/client";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { relativeTime } from "~/shared/lib/format";
import { authed, authedPage } from "~/shared/query/query";
import { REASONS } from "~/shared/report/reasons";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Chip } from "~/shared/ui/Chip";
import { PageHeader } from "~/shared/ui/Section";
import { Checkbox } from "~/shared/ui/Toggle";

type Target = Schemas["ReportedTarget"];
type Status = Target["status"];
type TargetType = Target["target_type"];

const STATUSES: Status[] = ["open", "resolved", "dismissed"];
const TYPES: (TargetType | "")[] = ["", "vacancy", "company"];
const isStatus = (v: string): v is Status => (STATUSES as string[]).includes(v);
const isType = (v: string): v is TargetType => v === "vacancy" || v === "company";

const KEYS = ["status", "type"] as const;

export default function AdminReports() {
  return <AdminOnly><Page /></AdminOnly>;
}

function Page() {
  const { t } = useTranslation();
  const { values, set } = useUrlFilters(KEYS);
  const status: Status = isStatus(values.status) ? values.status : "open";
  const type = isType(values.type) ? values.type : undefined;
  const filters = { status, target_type: type };
  const list = useCursorList<Target>(adminKeys.reports(filters), (cursor) =>
    authedPage(() => api.GET("/admin/reports", { params: { query: { ...filters, cursor } } })));
  return (
    <>
      <PageHeader title={t("admin.nav.reports")} description={t("admin.reports.hint")} />
      <div className="-mx-4 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 md:mx-0 md:px-0">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUSES.map((s) => (
            <Chip key={s} className="shrink-0" selected={status === s} onClick={() => set("status", s === "open" ? "" : s)}>
              {t(`admin.reports.status.${s}`)}
            </Chip>
          ))}
        </div>
        <span className="hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TYPES.map((k) => (
            <Chip key={k || "all"} className="shrink-0" selected={(type ?? "") === k} onClick={() => set("type", k)}>
              {t(`admin.reports.type.${k || "all"}`)}
            </Chip>
          ))}
        </div>
      </div>
      <AdminList
        list={list}
        empty={{ icon: <Flag className="size-6" />, title: t("admin.reports.empty"), body: status === "open" ? t("admin.reports.emptyBody") : undefined }}
        getKey={(r) => `${r.target_type}:${r.target_id}`}
        renderRow={(r) => <Row r={r} />}
      />
    </>
  );
}

function Row({ r }: { r: Target }) {
  const { t } = useTranslation();
  const open = r.status === "open";
  return (
    <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:gap-6 lg:px-5">
      <div className="min-w-0 flex-1">
        <TargetHeading r={r} />
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={open ? "zafaron" : "neutral"} className="num">{t("admin.reports.count", { n: r.status_report_count })}</Badge>
          {REASONS.filter((k) => r.reasons[k] > 0).map((k) => (
            <Badge key={k} tone="outline" className="num">{t(`report.reasons.${k}`)} · {r.reasons[k]}</Badge>
          ))}
          <span className="text-xs text-ink-3">
            {open ? t("admin.reports.lastAt", { when: relativeTime(r.last_reported_at, t) }) : t("admin.reports.closedAt", { when: relativeTime(r.last_activity_at, t) })}
            {r.total_report_count > r.status_report_count && ` · ${t("admin.reports.allTime", { n: r.total_report_count })}`}
          </span>
        </div>
        {r.latest.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {r.latest.map((l) => (
              <li key={l.id} className="rounded-control bg-sunken px-3 py-2 text-sm">
                <p className="text-xs text-ink-3">
                  <span className="font-medium text-ink-2">{l.reporter_name}</span> · {t(`report.reasons.${l.reason}`)} · {relativeTime(l.created_at, t)}
                </p>
                {l.comment && <p className="mt-0.5 text-ink">{l.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {open && <Actions r={r} />}
    </div>
  );
}

function TargetHeading({ r }: { r: Target }) {
  const { t } = useTranslation();
  if (r.vacancy) {
    const v = r.vacancy;
    return (
      <div className="flex items-start gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lapis-soft text-lapis-ink" aria-hidden="true"><BriefcaseBusiness className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-xs text-ink-3">{t("admin.reports.vacancy")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <LocalizedLink to={`/admin/moderation/${v.id}`} className="font-semibold text-ink hover:text-lapis-ink">{v.title}</LocalizedLink>
            {!v.public && <Badge tone="anor">{t(`vacancyStatus.${v.status}`)}</Badge>}
          </div>
          <p className="text-sm text-ink-2">
            {v.company.status === "active"
              ? <LocalizedLink to={`/companies/${v.company.slug}`} className="hover:text-lapis-ink">{v.company.name}</LocalizedLink>
              : <>{v.company.name} · <span className="text-anor-ink">{t("admin.filter.blocked")}</span></>}
          </p>
        </div>
      </div>
    );
  }
  const c = r.company!;
  return (
    <div className="flex items-start gap-3.5">
      <Avatar name={c.name} src={c.logo_url} square size="md" />
      <div className="min-w-0">
        <p className="text-xs text-ink-3">{t("admin.reports.company")}</p>
        <div className="flex flex-wrap items-center gap-2">
          {c.public
            ? <LocalizedLink to={`/companies/${c.slug}`} className="font-semibold text-ink hover:text-lapis-ink">{c.name}</LocalizedLink>
            : <span className="font-semibold text-ink">{c.name}</span>}
          {!c.public && <Badge tone="anor">{t("admin.filter.blocked")}</Badge>}
        </div>
      </div>
    </div>
  );
}

/** Close the target's reports, and act on the target itself (take down / block). */
function Actions({ r }: { r: Target }) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState<"resolve" | "dismiss" | null>(null);
  const [takingDown, setTakingDown] = useState(false);
  const [alsoResolve, setAlsoResolve] = useState(true);
  const path = { params: { path: { target_type: r.target_type, target_id: r.target_id } } };
  const close = useAdminMutation({
    mutationFn: ({ outcome, note }: { outcome: "resolve" | "dismiss"; note: string }) => authed<Target>(() =>
      outcome === "resolve"
        ? api.POST("/admin/reports/{target_type}/{target_id}/resolve", { ...path, body: { note: note || undefined } })
        : api.POST("/admin/reports/{target_type}/{target_id}/dismiss", { ...path, body: { note: note || undefined } })),
    done: ({ outcome }) => (outcome === "resolve" ? t("admin.reports.resolved") : t("admin.reports.dismissed")),
    invalidate: [adminKeys.reports()],
  });
  // One call: the server also closes the reports when asked (resolve_reports).
  const takeDown = useAdminMutation({
    mutationFn: (reason: string) => authed(() => api.POST("/admin/vacancies/{vacancy}/takedown", {
      params: { path: { vacancy: r.target_id } }, body: { reason, resolve_reports: alsoResolve },
    })),
    done: t("admin.reports.takenDown"),
    invalidate: [adminKeys.reports(), adminKeys.moderation()],
  });
  const companyPath = { params: { path: { company: r.target_id } } };
  const block = useToggleResource({
    set: () => authed(() => api.PUT("/admin/companies/{company}/block", companyPath)),
    clear: () => authed(() => api.DELETE("/admin/companies/{company}/block", companyPath)),
    done: { set: t("admin.companyBlocked"), clear: t("admin.companyUnblocked") },
    invalidate: [adminKeys.reports(), adminKeys.companies()],
  });

  return (
    <div className="flex flex-wrap items-start gap-1.5 lg:w-56 lg:flex-col lg:items-stretch">
      <Button size="sm" icon={<Check className="size-4" />} onClick={() => setClosing("resolve")}>{t("admin.reports.resolve")}</Button>
      <Button size="sm" variant="secondary" icon={<ShieldX className="size-4" />} onClick={() => setClosing("dismiss")}>{t("admin.reports.dismiss")}</Button>
      {r.vacancy?.public && (
        <Button size="sm" variant="ghost" className="text-anor-ink" icon={<Trash2 className="size-4" />} onClick={() => setTakingDown(true)}>
          {t("admin.reports.takedown")}
        </Button>
      )}
      {r.company && (
        <BlockToggle
          blocked={r.company.status === "blocked"}
          pending={block.isPending}
          onToggle={(on) => block.mutateAsync(on)}
          confirmTitle={t("admin.blockCompanyTitle")}
          confirmBody={t("admin.blockCompanyBody")}
        />
      )}

      <NoteDialog
        open={closing !== null}
        title={closing === "resolve" ? t("admin.reports.resolveTitle") : t("admin.reports.dismissTitle")}
        body={closing === "resolve" ? t("admin.reports.resolveBody") : t("admin.reports.dismissBody")}
        label={t("admin.reports.note")}
        placeholder={t("admin.reports.notePlaceholder")}
        confirmLabel={closing === "resolve" ? t("admin.reports.resolve") : t("admin.reports.dismiss")}
        pending={close.isPending}
        onConfirm={(note) => closing && close.mutate({ outcome: closing, note }, { onSuccess: () => setClosing(null) })}
        onClose={() => setClosing(null)}
      />
      <NoteDialog
        open={takingDown}
        title={t("admin.reports.takedownTitle")}
        body={t("admin.reports.takedownBody")}
        label={t("admin.reports.takedownReason")}
        placeholder={t("admin.rejectPlaceholder")}
        minLength={MIN_REASON_LENGTH}
        confirmLabel={t("admin.reports.takedown")}
        danger
        pending={takeDown.isPending}
        extra={<Checkbox checked={alsoResolve} onCheckedChange={setAlsoResolve} label={t("admin.reports.alsoResolve")} />}
        onConfirm={(reason) => takeDown.mutate(reason, { onSuccess: () => setTakingDown(false) })}
        onClose={() => setTakingDown(false)}
      />
    </div>
  );
}
