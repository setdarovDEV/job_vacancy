import { useQuery } from "@tanstack/react-query";
import { Ban, Building2, ClipboardCheck, FileText, Flag, ShieldQuestion, Tags, UserX, Users, Send } from "lucide-react";
import type { ReactNode } from "react";

import { AdminOnly } from "./admin-ui";
import { adminKeys } from "./keys";
import { StatsSection } from "./stats-section";
import { api, type Schemas } from "~/shared/api/client";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { groupDigits } from "~/shared/lib/format";
import { authed } from "~/shared/query/query";
import { PageHeader } from "~/shared/ui/Section";
import { Skeleton } from "~/shared/ui/Skeleton";

type AdminStats = Schemas["AdminStats"];

function useAdminStats() {
  return useQuery({ queryKey: adminKeys.stats(), queryFn: () => authed<AdminStats>(() => api.GET("/admin/stats")) });
}

export default function AdminOverview() {
  return <AdminOnly><Page /></AdminOnly>;
}

function Page() {
  const { t } = useTranslation();
  const q = useAdminStats();
  const s = q.data;
  return (
    <>
      <PageHeader title={t("admin.nav.overview")} description={t("admin.overviewHint")} />
      {!s ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-32 rounded-panel" />)}
        </div>
      ) : (
        <>
          <h2 className="mb-3 text-sm font-semibold text-ink-3">{t("admin.attention")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard to="/admin/moderation" icon={<ClipboardCheck />} label={t("admin.stats.moderation")} value={s.vacancies.pending_moderation} urgent />
            <StatCard to="/admin/reports" icon={<Flag />} label={t("admin.stats.reports")} value={s.reports.open_targets} urgent />
            <StatCard to="/admin/companies?show=unverified" icon={<ShieldQuestion />} label={t("admin.stats.unverified")} value={s.companies.active_unverified} urgent />
            <StatCard to="/admin/skills" icon={<Tags />} label={t("admin.stats.skills")} value={s.skills.unverified} urgent />
            <StatCard to="/admin/companies?show=blocked" icon={<Ban />} label={t("admin.stats.blockedCompanies")} value={s.companies.blocked} />
            <StatCard to="/admin/users?status=blocked" icon={<UserX />} label={t("admin.stats.blockedUsers")} value={s.users.blocked} />
          </div>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-ink-3">{t("admin.platform")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard to="/admin/users" icon={<Users />} label={t("admin.stats.users")} value={s.users.total}
              note={t("admin.stats.newWeek", { n: s.users.signed_up_last_7d })} />
            <StatCard to="/admin/companies" icon={<Building2 />} label={t("admin.stats.companies")} value={s.companies.total} />
            <StatCard to="/vacancies" icon={<FileText />} label={t("admin.stats.live")} value={s.vacancies.live} />
            <StatCard icon={<Send />} label={t("admin.stats.applicationsWeek")} value={s.applications.sent_last_7d} />
          </div>
        </>
      )}
      <StatsSection />
    </>
  );
}

/** A counter; "urgent" ones turn saffron while there's something waiting. */
function StatCard({ to, icon, label, value, note, urgent }: {
  to?: string; icon: ReactNode; label: string; value: number; note?: string; urgent?: boolean;
}) {
  const hot = urgent && value > 0;
  const body = (
    <>
      <span className={cn("grid size-10 place-items-center rounded-xl [&>svg]:size-5", hot ? "bg-zafaron-soft text-zafaron-ink" : "bg-lapis-soft text-lapis-ink")} aria-hidden="true">
        {icon}
      </span>
      <p className="num mt-4 font-display text-3xl font-semibold tracking-[-0.03em] text-ink">{groupDigits(value)}</p>
      <p className="mt-1 text-sm text-ink-2">{label}</p>
      {note && <p className="num mt-1 text-xs text-ink-3">{note}</p>}
    </>
  );
  const box = cn("block rounded-panel border bg-surface p-5", hot ? "border-zafaron/50" : "border-line");
  if (!to) return <div className={box}>{body}</div>;
  return (
    <LocalizedLink to={to} className={cn(box, "transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong")}>
      {body}
    </LocalizedLink>
  );
}
