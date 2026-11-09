import { UsersRound } from "lucide-react";

import { AdminOnly, SearchForm, useUrlFilters } from "./admin-ui";
import { adminKeys } from "./keys";
import { AdminList, useCursorList } from "./list";
import { BlockToggle, useAdminMutation, useToggleResource } from "./toggle";
import { api, type Schemas } from "~/shared/api/client";
import { useSession } from "~/shared/auth/session";
import { useTranslation } from "~/shared/i18n/i18n";
import { relativeTime } from "~/shared/lib/format";
import { authed, authedPage } from "~/shared/query/query";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { PageHeader } from "~/shared/ui/Section";
import { Select } from "~/shared/ui/Select";

type User = Schemas["AdminUser"];
type Role = User["role"];
const ROLES: Role[] = ["seeker", "employer", "admin"];
const STATUSES = ["active", "blocked"] as const;
const KEYS = ["q", "role", "status"] as const;

export default function AdminUsers() {
  return <AdminOnly><Page /></AdminOnly>;
}

function Page() {
  const { t } = useTranslation();
  const { values, set } = useUrlFilters(KEYS);
  const filters = {
    q: values.q || undefined,
    role: ROLES.find((r) => r === values.role),
    status: STATUSES.find((s) => s === values.status),
  };
  const list = useCursorList<User>(adminKeys.users(filters), (cursor) =>
    authedPage(() => api.GET("/admin/users", { params: { query: { ...filters, cursor } } })));
  return (
    <>
      <PageHeader title={t("admin.nav.users")} description={t("admin.usersHint")} />
      <SearchForm value={values.q} placeholder={t("admin.searchUsers")} onSearch={(v) => set("q", v)} />
      <div className="mb-4 mt-3 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <Select aria-label={t("admin.anyRole")} value={filters.role ?? ""} placeholder={t("admin.anyRole")} onValueChange={(v) => set("role", v)}
          options={ROLES.map((r) => ({ value: r, label: t(`admin.roles.${r}`) }))} />
        <Select aria-label={t("admin.anyStatus")} value={filters.status ?? ""} placeholder={t("admin.anyStatus")} onValueChange={(v) => set("status", v)}
          options={STATUSES.map((s) => ({ value: s, label: t(`admin.status.${s}`) }))} />
      </div>
      <AdminList
        list={list}
        empty={{ icon: <UsersRound className="size-6" />, title: t("admin.noUsers") }}
        getKey={(u) => u.id}
        renderRow={(u) => <Row u={u} />}
      />
    </>
  );
}

function Row({ u }: { u: User }) {
  const { t } = useTranslation();
  const { user: me } = useSession();
  const self = me?.id === u.id;
  const path = { params: { path: { user: u.id } } };
  const setRole = useAdminMutation({
    mutationFn: (role: Role) => authed<User>(() => api.PUT("/admin/users/{user}/role", { ...path, body: { role } })),
    done: t("admin.roleChanged"),
    invalidate: [adminKeys.users()],
  });
  const block = useToggleResource({
    set: () => authed<User>(() => api.PUT("/admin/users/{user}/block", path)),
    clear: () => authed<User>(() => api.DELETE("/admin/users/{user}/block", path)),
    done: { set: t("admin.userBlocked"), clear: t("admin.userUnblocked") },
    invalidate: [adminKeys.users()],
  });

  return (
    <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:gap-5 lg:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <Avatar name={u.full_name} src={u.avatar_url} size="md" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{u.full_name}</span>
            {self && <Badge tone="lapis">{t("admin.you")}</Badge>}
            {u.status === "blocked" && <Badge tone="anor">{t("admin.status.blocked")}</Badge>}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-3">
            {u.email && <span className="text-ink-2">{u.email}</span>}
            {u.phone && <span className="num text-ink-2">{u.phone}</span>}
            <span>{t("admin.joined", { when: relativeTime(u.created_at, t) })}</span>
            {u.last_seen_at && <span>{t("admin.lastSeen", { when: relativeTime(u.last_seen_at, t) })}</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Select size="sm" className="w-44" aria-label={t("admin.changeRole")} value={u.role} required disabled={self || setRole.isPending}
          onValueChange={(v) => setRole.mutate(v as Role)}
          options={ROLES.map((r) => ({ value: r, label: t(`admin.roles.${r}`) }))} />
        <BlockToggle
          blocked={u.status === "blocked"}
          disabled={self}
          pending={block.isPending}
          onToggle={(on) => block.mutateAsync(on)}
          confirmTitle={t("admin.blockUserTitle")}
          confirmBody={t("admin.blockUserBody", { name: u.full_name })}
        />
      </div>
    </div>
  );
}
