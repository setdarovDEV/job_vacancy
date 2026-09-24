import { Download, Mail, MapPin, PencilLine, Phone, Send } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";

import type { Schemas } from "../api/client";
import { useSession } from "../auth/session";
import { indexCatalog, nameOf, useCatalog } from "../catalog/catalog";
import { LocalizedLink, useLocale } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { downloadAuthed } from "../lib/download";
import { experienceText, monthLabel, money, relativeTime } from "../lib/format";
import { RichText } from "../lib/markdown";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { toast } from "../ui/toast-store";

const InviteDialog = lazy(() => import("../../routes/employer/InviteDialog"));

type Detail = Schemas["ResumeDetail"];
type Exp = Schemas["ResumeExperience"];
type Edu = Schemas["ResumeEducation"];
type Lang = Schemas["ResumeLanguage"];

/** A resume laid out as a document; `embedded` drops the outer margin and the invite action. */
export function ResumeView({ r, embedded }: { r: Detail; embedded?: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { user } = useSession();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const [pdf, setPdf] = useState(false);
  const [invite, setInvite] = useState(false);
  const region = nameOf(idx.regions.get(r.region_id ?? -1)?.name, locale);
  const category = nameOf(idx.categories.get(r.category_id ?? -1)?.name, locale);
  const exps: Exp[] = r.experiences ?? [];
  const edus: Edu[] = r.educations ?? [];
  const langs: Lang[] = r.languages ?? [];

  const download = async () => {
    setPdf(true);
    try {
      await downloadAuthed(`/resumes/${r.id}/pdf?lang=${locale}`, `${r.person.full_name ?? "resume"}.pdf`);
    } catch {
      toast({ tone: "error", title: t("errors.internal_error") });
    } finally {
      setPdf(false);
    }
  };

  return (
    <article className={`${embedded ? "" : "mt-5 "}overflow-hidden rounded-sheet border border-line bg-surface`}>
      <header className="flex flex-col gap-5 border-b border-line p-6 md:flex-row md:items-start md:p-8">
        <Avatar name={r.person.full_name ?? ""} src={r.person.avatar_url} size="xl" />
        <div className="min-w-0 flex-1">
          <p className="text-ink-2">{r.person.full_name}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-heading text-ink md:text-3xl">{r.title}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-2">
            {region && <span className="flex items-center gap-1.5"><MapPin className="size-4 text-ink-3" />{region}{r.relocate && `, ${t("resume.relocateShort")}`}</span>}
            <span>{t("resume.experienceTotal", { value: experienceText(r.experience_months, t) })}</span>
            {r.desired_salary && <span className="num font-medium text-firuza-ink">{money(r.desired_salary.amount ?? 0, r.desired_salary.currency === "USD" ? "USD" : "UZS", t, locale)}</span>}
          </div>
          {r.contacts && (r.contacts.email || r.contacts.phone) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {r.contacts.phone && <Button asChild variant="secondary" size="sm" icon={<Phone className="size-4" />}><a href={`tel:${r.contacts.phone}`} className="num">{r.contacts.phone}</a></Button>}
              {r.contacts.email && <Button asChild variant="secondary" size="sm" icon={<Mail className="size-4" />}><a href={`mailto:${r.contacts.email}`}>{r.contacts.email}</a></Button>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch">
          {r.is_owner && (
            <Button asChild variant="secondary" icon={<PencilLine className="size-4" />}><LocalizedLink to={`/me/resumes/${r.id}/edit`}>{t("common.edit")}</LocalizedLink></Button>
          )}
          {user?.role === "employer" && !embedded && <Button icon={<Send className="size-4" />} onClick={() => setInvite(true)}>{t("candidates.invite")}</Button>}
          <Button variant="ghost" icon={<Download className="size-4" />} loading={pdf} onClick={download}>PDF</Button>
        </div>
      </header>

      <div className="grid gap-10 p-6 md:grid-cols-[minmax(0,1fr)_14rem] md:p-8">
        <div className="flex min-w-0 flex-col gap-10">
          {r.about && (
            <Block title={t("resume.about")}><RichText text={r.about} className="space-y-3 leading-relaxed text-ink-2" /></Block>
          )}
          {exps.length > 0 && (
            <Block title={t("resume.experience")}>
              <ol className="relative flex flex-col gap-7 border-l border-line pl-6">
                {exps.map((x, i) => (
                  <li key={i} className="relative">
                    <span className={`absolute -left-[1.84rem] top-1.5 size-2.5 rounded-full ring-4 ring-surface ${x.end ? "bg-line-strong" : "bg-firuza"}`} aria-hidden="true" />
                    <p className="font-semibold text-ink">{x.position}</p>
                    <p className="text-sm text-ink-2">{x.company}</p>
                    <p className="num mt-0.5 text-xs text-ink-3">{monthLabel(x.start, locale)} – {x.end ? monthLabel(x.end, locale) : t("resume.present")}</p>
                    {x.description && <RichText text={x.description} className="mt-2 space-y-2 text-sm leading-relaxed text-ink-2" />}
                  </li>
                ))}
              </ol>
            </Block>
          )}
          {edus.length > 0 && (
            <Block title={t("resume.education")}>
              <ul className="flex flex-col gap-4">
                {edus.map((x, i) => (
                  <li key={i}>
                    <p className="font-semibold text-ink">{x.institution}</p>
                    <p className="text-sm text-ink-2">{[t(`resume.levels.${x.level}`), x.field].filter(Boolean).join(", ")}</p>
                    {(x.start_year || x.end_year) && <p className="num text-xs text-ink-3">{[x.start_year, x.end_year].filter(Boolean).join(" – ")}</p>}
                  </li>
                ))}
              </ul>
            </Block>
          )}
        </div>
        <aside className="flex flex-col gap-8">
          {category && <Block title={t("jobs.filters.category")} small><p className="text-sm text-ink-2">{category}</p></Block>}
          {r.skills.length > 0 && (
            <Block title={t("jobs.skills")} small>
              <div className="flex flex-wrap gap-1.5">{r.skills.map((s) => <Badge key={s.id} tone="outline">{s.name}</Badge>)}</div>
            </Block>
          )}
          {langs.length > 0 && (
            <Block title={t("resume.languages")} small>
              <ul className="flex flex-col gap-1.5 text-sm">
                {langs.map((l) => (
                  <li key={l.language} className="flex justify-between gap-2"><span className="text-ink">{t(`langs.${l.language}`)}</span><span className="text-ink-3">{t(`resume.langLevels.${l.level}`)}</span></li>
                ))}
              </ul>
            </Block>
          )}
          {(r.work_formats?.length ?? 0) > 0 && (
            <Block title={t("jobs.filters.format")} small>
              <p className="text-sm text-ink-2">{r.work_formats!.map((w) => t(`enums.work_format.${w}`)).join(", ")}</p>
            </Block>
          )}
          <p className="text-xs text-ink-3">{t("resume.updated", { when: relativeTime(r.updated_at, t) })}</p>
        </aside>
      </div>
      {invite && (
        <Suspense>
          <InviteDialog open={invite} onOpenChange={setInvite} resumeId={r.id} name={r.person.full_name ?? ""} />
        </Suspense>
      )}
    </article>
  );
}

function Block({ title, children, small }: { title: string; children: React.ReactNode; small?: boolean }) {
  return (
    <section>
      <h2 className={small ? "mb-2.5 text-sm font-semibold text-ink" : "mb-4 font-display text-lg font-semibold tracking-snug text-ink"}>{title}</h2>
      {children}
    </section>
  );
}
