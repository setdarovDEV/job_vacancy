import { Briefcase, Download, Layers, Lock, Mail, MapPin, PencilLine, Phone, Plane, Send, type LucideIcon } from "lucide-react";
import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";

import type { Schemas } from "../api/client";
import { useSession } from "../auth/session";
import type { Locale } from "../i18n/config";
import { indexCatalog, nameOf, useCatalog } from "../catalog/catalog";
import { LocalizedLink, useLocale } from "../i18n/hooks";
import { useTranslation, type TFunction } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { downloadAuthed } from "../lib/download";
import { experienceText, monthLabel, money } from "../lib/format";
import { RichText } from "../lib/markdown";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { RelTime } from "../ui/RelTime";
import { Skeleton, SkeletonText } from "../ui/Skeleton";
import { Timeline } from "../ui/Timeline";
import { toast } from "../ui/toast-store";

const InviteDialog = lazy(() => import("../../routes/employer/InviteDialog"));

type Detail = Schemas["ResumeDetail"];
type Exp = Schemas["ResumeExperience"];
type Edu = Schemas["ResumeEducation"];
type Lang = Schemas["ResumeLanguage"];

/** What the editor edits (the API's ResumeInput: PUT replaces the whole resume). */
export type ResumeDraft = Schemas["ResumeInput"];
export type ResumeVisibility = Schemas["ResumeVisibility"];

// ---- helpers shared by the list, the editor and the viewer -----------------------------

export const VISIBILITIES = ["public", "applied_only", "hidden"] as const;

// Visibility is always spelled out next to the dot; the colour only helps scanning a list.
const visibilityTones: Record<ResumeVisibility, string> = { public: "bg-firuza", applied_only: "bg-lapis", hidden: "bg-ink-3" };

export function VisibilityDot({ value, className }: { value: ResumeVisibility; className?: string }) {
  return <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", visibilityTones[value], className)} />;
}

export function detailToDraft(d: Detail): ResumeDraft {
  return {
    title: d.title, about: d.about ?? "", category_id: d.category_id ?? undefined, region_id: d.region_id ?? undefined,
    relocate: d.relocate, desired_salary: d.desired_salary?.amount, currency: d.desired_salary?.currency === "USD" ? "USD" : "UZS",
    employment_types: (d.employment_types ?? []) as ResumeDraft["employment_types"],
    work_formats: (d.work_formats ?? []) as ResumeDraft["work_formats"],
    visibility: d.visibility ?? "public",
    experiences: (d.experiences ?? []).map((x) => ({ ...x, end: x.end ?? null, description: x.description ?? "" })),
    educations: d.educations ?? [],
    skills: d.skills.map((s) => s.name), languages: d.languages ?? [],
  };
}

const MONTH = /^\d{4}-\d{2}$/;
const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

/** Months covered by the jobs, overlaps counted once (same rule as the API's experience_months). */
export function experienceMonths(exps: { start: string; end?: string | null }[], now = new Date()): number {
  const current = now.getFullYear() * 12 + now.getMonth();
  const spans = exps
    .filter((e) => MONTH.test(e.start))
    .map((e) => [monthIndex(e.start), e.end && MONTH.test(e.end) ? monthIndex(e.end) : current] as const)
    .filter(([a, b]) => b >= a)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let lo = -1;
  let hi = -2;
  for (const [a, b] of spans) {
    if (a > hi + 1) {
      if (lo >= 0) total += hi - lo + 1;
      lo = a;
      hi = b;
    } else if (b > hi) hi = b;
  }
  return lo >= 0 ? total + hi - lo + 1 : total;
}

export type EditorStep = "basics" | "experience" | "education" | "skills" | "visibility" | "preview";
export type CheckId = "title" | "category" | "region" | "salary" | "about" | "experience" | "education" | "skills" | "languages";

const CHECKS: [CheckId, EditorStep, (d: ResumeDraft) => boolean][] = [
  ["title", "basics", (d) => d.title.trim().length >= 2],
  ["category", "basics", (d) => d.category_id != null],
  ["region", "basics", (d) => d.region_id != null],
  ["salary", "basics", (d) => Boolean(d.desired_salary)],
  ["about", "basics", (d) => Boolean(d.about?.trim())],
  ["experience", "experience", (d) => (d.experiences?.length ?? 0) > 0],
  ["education", "education", (d) => (d.educations?.length ?? 0) > 0],
  ["skills", "skills", (d) => (d.skills?.length ?? 0) >= 3],
  ["languages", "skills", (d) => (d.languages?.length ?? 0) > 0],
];

/**
 * How complete a resume is, from the same rules everywhere (list card, editor sidebar,
 * preview step). Every item is something employers filter or read first.
 */
export function resumeChecklist(d: ResumeDraft) {
  const items = CHECKS.map(([id, step, test]) => ({ id, step, done: test(d) }));
  const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return { items, percent, missing: items.filter((i) => !i.done) };
}

/** "soha, shahar, ta'lim": item names stand capitalised on their own, lower-cased inside a sentence. */
export function missingList(items: { id: CheckId }[], t: TFunction, locale: Locale, max = 3) {
  return items.slice(0, max).map((m) => t(`resumePage.check.${m.id}`).toLocaleLowerCase(locale)).join(", ");
}

/** The editor's live preview: the draft shaped like a saved resume. */
export function draftToDetail(d: ResumeDraft, base: Pick<Detail, "id" | "person" | "updated_at"> & { contacts?: Detail["contacts"] }): Detail {
  const exps = (d.experiences ?? []).filter((x) => x.company.trim() || x.position.trim());
  const first = exps[0];
  return {
    id: base.id, title: d.title.trim(), person: base.person,
    category_id: d.category_id ?? null, region_id: d.region_id ?? null, relocate: Boolean(d.relocate),
    experience_months: experienceMonths(exps),
    desired_salary: d.desired_salary ? { amount: d.desired_salary, currency: d.currency ?? "UZS" } : null,
    last_job: first ? { position: first.position, company: first.company, current: first.end == null } : null,
    skills: (d.skills ?? []).map((name, i) => ({ id: i, name })),
    visibility: d.visibility, updated_at: base.updated_at,
    about: d.about, employment_types: d.employment_types, work_formats: d.work_formats,
    experiences: exps, educations: (d.educations ?? []).filter((x) => x.institution.trim()), languages: d.languages,
    contacts: base.contacts ?? null, is_owner: false,
  };
}

/** Authenticated PDF download with a busy flag (the API renders it in the UI language). */
export function useResumePdf(id: string, fallbackName: string) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      await downloadAuthed(`/resumes/${id}/pdf?lang=${locale}`, `${fallbackName || "resume"}.pdf`);
    } catch {
      toast({ tone: "error", title: t("errors.internal_error") });
    } finally {
      setBusy(false);
    }
  };
  return { busy, download };
}

const LEVEL_STEPS: Record<Lang["level"], number> = { a1: 1, a2: 2, b1: 3, b2: 4, c1: 5, c2: 6, native: 6 };

function span(x: Exp, t: TFunction, locale: Locale) {
  if (!MONTH.test(x.start)) return "";
  const end = x.end && MONTH.test(x.end) ? x.end : null;
  const months = experienceMonths([{ start: x.start, end }]);
  const range = `${monthLabel(x.start, locale)} – ${end ? monthLabel(end, locale) : t("resume.present")}`;
  return months > 0 ? `${range} · ${experienceText(months, t)}` : range;
}

// ---- the document ----------------------------------------------------------------------

type ViewProps = {
  r: Detail;
  /** Inside another page (employer application): no outer margin, no invite action. */
  embedded?: boolean;
  /** Editor draft: no actions, and empty sections show where they will go. */
  preview?: boolean;
  /** Edit / Invite / PDF in the header. Pages that place their own actions pass false. */
  actions?: boolean;
  /** "h2" when the page already has its own H1 (section titles then become h3). */
  headingAs?: "h1" | "h2";
  className?: string;
};

/**
 * A resume laid out as a document: header (photo, position, facts, desired pay, contacts), the
 * story in the main column (about, experience and education as timelines), the scannable facts
 * in a side column. Layout follows the container, not the viewport, so the same component reads
 * well full-width, beside an aside (employer application) and inside the editor's live preview.
 */
export function ResumeView({ r, embedded, preview, actions = true, headingAs = "h1", className }: ViewProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { user } = useSession();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const pdf = useResumePdf(r.id, r.person.full_name ?? r.title);
  const [invite, setInvite] = useState(false);
  const H = headingAs;
  const S = headingAs === "h1" ? "h2" : "h3";
  const region = nameOf(idx.regions.get(r.region_id ?? -1)?.name, locale);
  const category = nameOf(idx.categories.get(r.category_id ?? -1)?.name, locale);
  const exps: Exp[] = r.experiences ?? [];
  const edus: Edu[] = r.educations ?? [];
  const langs: Lang[] = r.languages ?? [];
  const contacts = r.contacts && (r.contacts.email || r.contacts.phone) ? r.contacts : null;
  const showActions = actions && !preview;
  const invitable = user?.role === "employer" && !embedded;
  const empty = preview ? <p className="text-md text-ink-3">{t("resumePage.notAdded")}</p> : null;

  return (
    <Card
      as="article"
      radius="sheet"
      padding="none"
      className={cn("@container flex flex-col", className)}
    >
      <header className="flex flex-col gap-5 p-6 @2xl:flex-row @2xl:items-start @2xl:p-10">
        <Avatar name={r.person.full_name || r.title || "?"} src={r.person.avatar_url} size="xl" priority={!preview} />
        <div className="min-w-0 flex-1">
          {r.person.full_name && <p className="break-words text-md font-medium text-ink-2">{r.person.full_name}</p>}
          <H
            className={cn("mt-1 break-words font-display text-2xl font-semibold tracking-heading @2xl:text-3xl", r.title ? "text-ink" : "text-ink-3")}
            style={!preview && !embedded ? { viewTransitionName: `resume-title-${r.id}` } : undefined}
          >
            {r.title || t("resumePage.untitled")}
          </H>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
            {region && <Fact icon={MapPin}>{region}</Fact>}
            {r.relocate && <Fact icon={Plane}>{t("resumePage.relocate")}</Fact>}
            <Fact icon={Briefcase}>{t("resume.experienceTotal", { value: experienceText(r.experience_months, t) })}</Fact>
            {category && <Fact icon={Layers}>{category}</Fact>}
          </ul>
          {r.desired_salary?.amount ? (
            <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
              <span className="num font-display text-xl font-semibold tracking-heading text-firuza-ink">
                {money(r.desired_salary.amount, r.desired_salary.currency === "USD" ? "USD" : "UZS", t, locale)}
              </span>
              <span className="text-sm text-ink-2">{t("resumePage.perMonth")}</span>
            </p>
          ) : null}
          {contacts ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {contacts.phone && (
                <Button asChild variant="secondary" size="sm" icon={<Phone className="size-4" />}>
                  <a href={`tel:${contacts.phone}`} className="num">{contacts.phone}</a>
                </Button>
              )}
              {contacts.email && (
                <Button asChild variant="secondary" size="sm" icon={<Mail className="size-4" />} className="max-w-full">
                  <a href={`mailto:${contacts.email}`}><span className="truncate">{contacts.email}</span></a>
                </Button>
              )}
            </div>
          ) : !preview && !r.is_owner ? (
            <p className="mt-5 flex max-w-md items-start gap-2 text-sm text-ink-2">
              <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-3" />
              {t("resumePage.contactsLocked")}
            </p>
          ) : null}
        </div>
        {showActions && (
          <div className="flex flex-wrap gap-2 @2xl:flex-col @2xl:items-stretch">
            {r.is_owner && (
              <Button asChild variant="secondary" icon={<PencilLine className="size-4" />}>
                <LocalizedLink to={`/me/resumes/${r.id}/edit`}>{t("common.edit")}</LocalizedLink>
              </Button>
            )}
            {invitable && <Button icon={<Send className="size-4" />} onClick={() => setInvite(true)}>{t("candidates.invite")}</Button>}
            <Button variant="ghost" icon={<Download className="size-4" />} loading={pdf.busy} onClick={pdf.download}>PDF</Button>
          </div>
        )}
      </header>

      <div className="grid flex-1 border-t border-line @2xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="flex min-w-0 flex-col gap-10 p-6 @2xl:p-10">
          {(r.about || preview) && (
            <Block title={t("resume.about")} as={S}>
              {r.about ? <RichText text={r.about} className="rich-text" /> : empty}
            </Block>
          )}
          {(exps.length > 0 || preview) && (
            <Block title={t("resume.experience")} as={S}>
              {exps.length ? (
                <Timeline
                  items={exps.map((x, i) => ({
                    id: i,
                    tone: x.end ? "neutral" : "firuza",
                    title: (
                      <>
                        {x.position || t("resumePage.newJob")}
                        {x.company && <span className="block font-normal text-ink-2">{x.company}</span>}
                      </>
                    ),
                    body: (
                      <>
                        <p className="num">{span(x, t, locale)}</p>
                        {x.description && <RichText text={x.description} className="rich-text mt-2 text-md" />}
                      </>
                    ),
                  }))}
                />
              ) : empty}
            </Block>
          )}
          {(edus.length > 0 || preview) && (
            <Block title={t("resume.education")} as={S}>
              {edus.length ? (
                <Timeline
                  items={edus.map((x, i) => ({
                    id: i,
                    tone: "lapis",
                    title: (
                      <>
                        {x.institution}
                        <span className="block font-normal text-ink-2">{[t(`resume.levels.${x.level}`), x.field].filter(Boolean).join(" · ")}</span>
                      </>
                    ),
                    body: x.start_year || x.end_year ? <p className="num">{[x.start_year, x.end_year].filter(Boolean).join(" – ")}</p> : undefined,
                  }))}
                />
              ) : empty}
            </Block>
          )}
        </div>

        <aside
          aria-label={t("resumePage.facts")}
          className="flex min-w-0 flex-col gap-8 border-t border-line p-6 @2xl:border-l @2xl:border-t-0 @2xl:p-8"
        >
          {(r.skills.length > 0 || preview) && (
            <Block title={t("jobs.skills")} as={S} small>
              {r.skills.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {r.skills.map((s) => <li key={s.id} className="min-w-0 max-w-full"><Badge tone="outline">{s.name}</Badge></li>)}
                </ul>
              ) : empty}
            </Block>
          )}
          {(langs.length > 0 || preview) && (
            <Block title={t("resume.languages")} as={S} small>
              {langs.length ? (
                <ul className="flex flex-col gap-4">
                  {langs.map((l) => (
                    <li key={l.language} className="text-sm">
                      <p className="font-medium text-ink">{t(`langs.${l.language}`)}</p>
                      <p className="text-ink-2">{t(`resume.langLevels.${l.level}`)}</p>
                      <span aria-hidden="true" className="mt-2 flex gap-1">
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <span key={n} className={cn("h-1 flex-1 rounded-pill", n <= LEVEL_STEPS[l.level] ? "bg-lapis" : "bg-line")} />
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : empty}
            </Block>
          )}
          {(r.employment_types?.length ?? 0) > 0 && (
            <Block title={t("jobs.filters.employment")} as={S} small>
              <p className="text-md text-ink">{r.employment_types!.map((w) => t(`enums.employment_type.${w}`)).join(", ")}</p>
            </Block>
          )}
          {(r.work_formats?.length ?? 0) > 0 && (
            <Block title={t("jobs.filters.format")} as={S} small>
              <p className="text-md text-ink">{r.work_formats!.map((w) => t(`enums.work_format.${w}`)).join(", ")}</p>
            </Block>
          )}
          {!preview && (
            <RelTime iso={r.updated_at} template={(when) => t("resume.updated", { when })} className="mt-auto text-sm text-ink-2" />
          )}
        </aside>
      </div>
      {invite && (
        <Suspense>
          <InviteDialog open={invite} onOpenChange={setInvite} resumeId={r.id} name={r.person.full_name ?? ""} />
        </Suspense>
      )}
    </Card>
  );
}

function Fact({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-1.5">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

function Block({ title, as: Heading, small, children }: { title: string; as: "h2" | "h3"; small?: boolean; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <Heading
        className={
          small
            ? "mb-3 text-xs font-semibold uppercase tracking-caps text-ink-2"
            : "mb-5 font-display text-lg font-semibold tracking-heading text-ink"
        }
      >
        {title}
      </Heading>
      {children}
    </section>
  );
}

/** Loading shape of ResumeView (same card, header, columns and container breakpoints). */
export function ResumeViewSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("@container surface-card flex flex-col rounded-sheet", className)}>
      <div className="flex flex-col gap-5 p-6 @2xl:flex-row @2xl:p-10">
        <Skeleton className="size-20 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-3/4" />
          <div className="mt-1 flex flex-wrap gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="mt-2 h-6 w-36" />
        </div>
      </div>
      <div className="grid flex-1 border-t border-line @2xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="flex flex-col gap-10 p-6 @2xl:p-10">
          {[4, 5, 2].map((lines, i) => (
            <div key={i}>
              <Skeleton className="mb-5 h-5 w-40" />
              <SkeletonText lines={lines} />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-8 border-t border-line p-6 @2xl:border-l @2xl:border-t-0 @2xl:p-8">
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="mb-1.5 h-3 w-full max-w-24" />
            {[16, 12, 20, 14].map((w, i) => <Skeleton key={i} className="h-6" style={{ width: `${w * 0.25}rem` }} />)}
          </div>
          <SkeletonText lines={3} />
        </div>
      </div>
    </div>
  );
}
