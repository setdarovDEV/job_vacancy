import { BadgeCheck, Building2, ShieldCheck, ShieldOff } from "lucide-react";

import { AdminOnly, SearchForm, useUrlFilters } from "./admin-ui";
import { adminKeys } from "./keys";
import { AdminList, useCursorList } from "./list";
import { BlockToggle, useToggleResource } from "./toggle";
import { api, type Schemas } from "~/shared/api/client";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { relativeTime } from "~/shared/lib/format";
import { authed, authedPage } from "~/shared/query/query";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Chip } from "~/shared/ui/Chip";
import { PageHeader } from "~/shared/ui/Section";

type Company = Schemas["AdminCompany"];
type CompanyQuery = { status?: "active" | "blocked"; verified?: boolean };

// The chips are shortcuts for combinations of the API's two independent filters.
const VIEWS = {
  all: {},
  unverified: { status: "active", verified: false },
  verified: { status: "active", verified: true },
  blocked: { status: "blocked" },
} satisfies Record<string, CompanyQuery>;
type View = keyof typeof VIEWS;
const isView = (v: string): v is View => v in VIEWS;

const KEYS = ["q", "show"] as const;

export default function AdminCompanies() {
  return <AdminOnly><Page /></AdminOnly>;
}

function Page() {
  const { t } = useTranslation();
  const { values, set } = useUrlFilters(KEYS);
  const view: View = isView(values.show) ? values.show : "all";
  const filters: CompanyQuery & { q?: string } = { ...VIEWS[view], q: values.q || undefined };
  const list = useCursorList<Company>(adminKeys.companies(filters), (cursor) =>
    authedPage(() => api.GET("/admin/companies", { params: { query: { ...filters, cursor } } })));
  return (
    <>
      <PageHeader title={t("admin.nav.companies")} description={t("admin.companiesHint")} />
      <SearchForm value={values.q} placeholder={t("admin.searchCompanies")} onSearch={(v) => set("q", v)} />
      <div className="-mx-4 mb-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Chip key={v} className="shrink-0" selected={view === v} onClick={() => set("show", v === "all" ? "" : v)}>
            {t(`admin.filter.${v}`)}
          </Chip>
        ))}
      </div>
      <AdminList
        list={list}
        empty={{ icon: <Building2 className="size-6" />, title: t("admin.noCompanies") }}
        getKey={(c) => c.id}
        renderRow={(c) => <Row c={c} />}
      />
    </>
  );
}

function Row({ c }: { c: Company }) {
  const { t } = useTranslation();
  const path = { params: { path: { company: c.id } } };
  const blocked = c.status === "blocked";
  const verify = useToggleResource({
    set: () => authed<Company>(() => api.PUT("/admin/companies/{company}/verification", path)),
    clear: () => authed<Company>(() => api.DELETE("/admin/companies/{company}/verification", path)),
    done: { set: t("admin.verifiedToast"), clear: t("admin.unverifiedToast") },
    invalidate: [adminKeys.companies()],
  });
  const block = useToggleResource({
    set: () => authed<Company>(() => api.PUT("/admin/companies/{company}/block", path)),
    clear: () => authed<Company>(() => api.DELETE("/admin/companies/{company}/block", path)),
    done: { set: t("admin.companyBlocked"), clear: t("admin.companyUnblocked") },
    invalidate: [adminKeys.companies()],
  });

  return (
    <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:gap-5 lg:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <Avatar name={c.name} src={c.logo_url} square size="md" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {blocked
              ? <span className="font-semibold text-ink">{c.name}</span>
              : <LocalizedLink to={`/companies/${c.slug}`} className="font-semibold text-ink hover:text-lapis-ink">{c.name}</LocalizedLink>}
            {c.verified && <Badge tone="firuza"><BadgeCheck className="size-3.5" />{t("common.verified")}</Badge>}
            {blocked && <Badge tone="anor">{t("admin.filter.blocked")}</Badge>}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-3">
            <span>{t("admin.owner")}: <span className="text-ink-2">{c.owner_name}</span>{c.owner_email && ` · ${c.owner_email}`}</span>
            <span className="num">{t("admin.openVacancies", { n: c.open_vacancies })}</span>
            <span>{t("admin.created", { when: relativeTime(c.created_at, t) })}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {!blocked && (c.verified
          ? <Button variant="ghost" size="sm" icon={<ShieldOff className="size-4" />} loading={verify.isPending} onClick={() => verify.mutate(false)}>{t("admin.unverify")}</Button>
          : <Button variant="soft" size="sm" icon={<ShieldCheck className="size-4" />} loading={verify.isPending} onClick={() => verify.mutate(true)}>{t("admin.verify")}</Button>)}
        <BlockToggle
          blocked={blocked}
          pending={block.isPending}
          onToggle={(on) => block.mutateAsync(on)}
          confirmTitle={t("admin.blockCompanyTitle")}
          confirmBody={t("admin.blockCompanyBody")}
        />
      </div>
    </div>
  );
}
