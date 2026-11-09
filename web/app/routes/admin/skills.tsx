import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Combine, PencilLine, ShieldCheck, Tags, Trash2 } from "lucide-react";
import { useState } from "react";

import { AdminOnly, ConfirmDialog, SearchForm, useUrlFilters } from "./admin-ui";
import { adminKeys } from "./keys";
import { AdminList, useCursorList } from "./list";
import { useAdminMutation, useToggleResource, VerifyToggle } from "./toggle";
import { api, type Schemas } from "~/shared/api/client";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { relativeTime } from "~/shared/lib/format";
import { authed, authedPage } from "~/shared/query/query";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Chip } from "~/shared/ui/Chip";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { Field, Input } from "~/shared/ui/Field";
import { PageHeader } from "~/shared/ui/Section";
import { Spinner } from "~/shared/ui/Spinner";
import { Checkbox } from "~/shared/ui/Toggle";

type Skill = Schemas["AdminSkill"];
type Sort = "newest" | "popularity" | "in_use";

// "New" is the review queue: skills nobody has verified yet.
const VIEWS = { new: { verified: false }, verified: { verified: true }, all: {} } satisfies Record<string, { verified?: boolean }>;
type View = keyof typeof VIEWS;
const isView = (v: string): v is View => v in VIEWS;
const SORTS: Sort[] = ["newest", "in_use", "popularity"];
const isSort = (v: string): v is Sort => (SORTS as string[]).includes(v);

const KEYS = ["q", "show", "sort"] as const;
const skillPath = (id: number) => ({ params: { path: { skill: id } } });

export default function AdminSkills() {
  return <AdminOnly><Page /></AdminOnly>;
}

function Page() {
  const { t } = useTranslation();
  const { values, set } = useUrlFilters(KEYS);
  const view: View = isView(values.show) ? values.show : "new";
  const sort: Sort = isSort(values.sort) ? values.sort : "newest";
  const filters = { ...VIEWS[view], sort, q: values.q || undefined };
  const list = useCursorList<Skill>(adminKeys.skills(filters), (cursor) =>
    authedPage(() => api.GET("/admin/skills", { params: { query: { ...filters, cursor } } })));

  // Bulk verification of the review queue.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggle = (id: number, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const bulk = useAdminMutation({
    // One request, one transaction: all of them are verified or none.
    mutationFn: (ids: number[]) => authed<Skill[]>(() => api.POST("/admin/skills/verification", { body: { ids } })),
    done: (ids) => t("admin.skills.bulkVerified", { n: ids.length }),
    invalidate: [adminKeys.skills()],
  });
  const pickable = view !== "verified";

  return (
    <>
      <PageHeader title={t("admin.nav.skills")} description={t("admin.skills.hint")} />
      <SearchForm value={values.q} placeholder={t("admin.skills.search")} onSearch={(v) => set("q", v)} />
      <div className="-mx-4 mb-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Chip key={v} className="shrink-0" selected={view === v} onClick={() => { setSelected(new Set()); set("show", v === "new" ? "" : v); }}>
            {t(`admin.skills.view.${v}`)}
          </Chip>
        ))}
        <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden="true" />
        {SORTS.map((s) => (
          <Chip key={s} className="shrink-0" selected={sort === s} onClick={() => set("sort", s === "newest" ? "" : s)}>
            {t(`admin.skills.sort.${s}`)}
          </Chip>
        ))}
      </div>
      {pickable && selected.size > 0 && (
        <div className="glass-bar sticky top-16 z-10 mb-3 flex items-center justify-between gap-3 rounded-panel border border-line px-4 py-2.5">
          <span className="num text-sm text-ink-2">{t("admin.skills.selected", { n: selected.size })}</span>
          <Button size="sm" icon={<ShieldCheck className="size-4" />} loading={bulk.isPending}
            onClick={() => bulk.mutate([...selected], { onSuccess: () => setSelected(new Set()) })}>
            {t("admin.skills.verifySelected")}
          </Button>
        </div>
      )}
      <AdminList
        list={list}
        empty={{ icon: <Tags className="size-6" />, title: t("admin.skills.empty"), body: view === "new" && !values.q ? t("admin.skills.emptyNew") : undefined }}
        getKey={(s) => String(s.id)}
        renderRow={(s) => (
          <Row s={s} picked={selected.has(s.id)} onPick={pickable && !s.verified ? (on) => toggle(s.id, on) : undefined} />
        )}
      />
    </>
  );
}

function Row({ s, picked, onPick }: { s: Skill; picked: boolean; onPick?: (on: boolean) => void }) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<"rename" | "merge" | "delete" | null>(null);
  const close = () => setDialog(null);
  const verify = useToggleResource({
    set: () => authed<Skill>(() => api.PUT("/admin/skills/{skill}/verification", skillPath(s.id))),
    clear: () => authed<Skill>(() => api.DELETE("/admin/skills/{skill}/verification", skillPath(s.id))),
    done: { set: t("admin.skills.verifiedToast"), clear: t("admin.skills.unverifiedToast") },
    invalidate: [adminKeys.skills()],
  });
  const remove = useAdminMutation({
    mutationFn: () => authed<unknown>(() => api.DELETE("/admin/skills/{skill}", skillPath(s.id))),
    done: t("admin.skills.deleted"),
    invalidate: [adminKeys.skills()],
  });

  return (
    <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:gap-5 lg:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {onPick && (
          <div className="pt-0.5">
            <Checkbox checked={picked} onCheckedChange={onPick} label={<span className="sr-only">{t("admin.skills.select", { name: s.name })}</span>} />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{s.name}</span>
            {s.verified && <Badge tone="firuza"><BadgeCheck className="size-3.5" />{t("admin.skills.verified")}</Badge>}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-3">
            <span className="num">{t("admin.skills.inUse", { v: s.vacancy_count, r: s.resume_count })}</span>
            <span>{t("admin.created", { when: relativeTime(s.created_at, t) })}</span>
          </p>
          {s.aliases.length > 0 && (
            <p className="mt-1 text-xs text-ink-3">{t("admin.skills.aliases", { list: s.aliases.join(", ") })}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <VerifyToggle verified={s.verified} pending={verify.isPending} onToggle={(on) => verify.mutate(on)}
          labels={{ verify: t("admin.skills.verify"), unverify: t("admin.skills.unverify") }} />
        <Button variant="ghost" size="sm" icon={<PencilLine className="size-4" />} onClick={() => setDialog("rename")}>{t("admin.skills.rename")}</Button>
        <Button variant="ghost" size="sm" icon={<Combine className="size-4" />} onClick={() => setDialog("merge")}>{t("admin.skills.merge")}</Button>
        <Button variant="ghost" size="sm" className="text-anor-ink" icon={<Trash2 className="size-4" />} onClick={() => setDialog("delete")}>{t("admin.skills.delete")}</Button>
      </div>
      {dialog === "rename" && <RenameDialog skill={s} onClose={close} />}
      {dialog === "merge" && <MergeDialog skill={s} onClose={close} />}
      <ConfirmDialog
        open={dialog === "delete"}
        title={t("admin.skills.deleteTitle", { name: s.name })}
        body={t("admin.skills.deleteBody", { v: s.vacancy_count, r: s.resume_count })}
        confirmLabel={t("admin.skills.delete")}
        pending={remove.isPending}
        onConfirm={() => remove.mutate(undefined, { onSuccess: close })}
        onClose={close}
      />
    </div>
  );
}

/** Rename keeps the old name as an alias (server side); the field starts with the current name. */
function RenameDialog({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(skill.name);
  const rename = useAdminMutation({
    mutationFn: (n: string) => authed<Skill>(() => api.PATCH("/admin/skills/{skill}", { ...skillPath(skill.id), body: { name: n } })),
    done: t("admin.skills.renamed"),
    invalidate: [adminKeys.skills()],
  });
  const clean = name.trim().replace(/\s+/g, " ");
  return (
    <DialogRoot open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t("admin.skills.renameTitle")} description={t("admin.skills.renameBody")} closeLabel={t("common.close")}>
        <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); rename.mutate(clean, { onSuccess: onClose }); }}>
          <Field label={t("admin.skills.newName")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required autoFocus />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={!clean || clean === skill.name} loading={rename.isPending}>{t("admin.skills.rename")}</Button>
          </div>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}

/** Pick the surviving skill; the source's vacancies, resumes and names move to it. */
function MergeDialog({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [into, setInto] = useState<Skill | null>(null);
  const term = q.trim();
  const found = useQuery({
    queryKey: adminKeys.skills({ pick: term }),
    queryFn: () => authedPage<Skill>(() => api.GET("/admin/skills", { params: { query: { q: term, sort: "in_use", limit: 8 } } })),
    enabled: term.length > 0,
  });
  const options = (found.data?.data ?? []).filter((o) => o.id !== skill.id);
  const merge = useAdminMutation({
    mutationFn: (target: Skill) => authed<Skill>(() => api.POST("/admin/skills/{skill}/merge", { ...skillPath(skill.id), body: { into: target.id } })),
    done: t("admin.skills.merged"),
    invalidate: [adminKeys.skills()],
  });
  return (
    <DialogRoot open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={t("admin.skills.mergeTitle", { name: skill.name })}
        description={t("admin.skills.mergeBody", { name: skill.name, v: skill.vacancy_count, r: skill.resume_count })}
        closeLabel={t("common.close")}
      >
        <div className="flex flex-col gap-4">
          <Field label={t("admin.skills.mergeInto")}>
            <Input type="search" value={q} onChange={(e) => { setQ(e.target.value); setInto(null); }} placeholder={t("admin.skills.mergeSearch")} autoFocus />
          </Field>
          {term && (
            <div role="radiogroup" aria-label={t("admin.skills.mergeInto")} className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {found.isPending ? (
                <div className="grid h-16 place-items-center text-ink-3"><Spinner /></div>
              ) : options.length === 0 ? (
                <p className="px-1 py-3 text-sm text-ink-3">{t("admin.skills.mergeNone")}</p>
              ) : options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={into?.id === o.id}
                  onClick={() => setInto(o)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-control border px-3.5 py-2.5 text-left transition-colors",
                    into?.id === o.id ? "border-lapis bg-lapis-soft/60" : "border-line-strong hover:border-ink-3",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium text-ink">{o.name}</span>
                    {o.verified && <BadgeCheck className="size-4 shrink-0 text-firuza" aria-label={t("admin.skills.verified")} />}
                  </span>
                  <span className="num shrink-0 text-xs text-ink-3">{t("admin.skills.inUse", { v: o.vacancy_count, r: o.resume_count })}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
            <Button variant="danger" icon={<Combine className="size-4" />} disabled={!into} loading={merge.isPending}
              onClick={() => into && merge.mutate(into, { onSuccess: onClose })}>
              {t("admin.skills.mergeConfirm")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
