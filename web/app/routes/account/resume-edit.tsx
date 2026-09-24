import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, Briefcase, Building2, Check, CircleDashed, Eye, EyeOff, Globe, GraduationCap, Lock, Plus, Trash2,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";

import { SeekerOnly } from "./layout";
import type { ShellHandle } from "../site";
import { api, dataOf, type Schemas } from "~/shared/api/client";
import { useSession, withAuth } from "~/shared/auth/session";
import { nameOf, useCatalog } from "~/shared/catalog/catalog";
import { FormError } from "~/shared/forms/FormError";
import { TagInput } from "~/shared/forms/TagInput";
import { useSubmit } from "~/shared/forms/useSubmit";
import { useUnsavedChanges } from "~/shared/forms/useUnsavedChanges";
import { localizedPath } from "~/shared/i18n/config";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation, type TFunction } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { authed } from "~/shared/query/query";
import {
  detailToDraft, draftToDetail, missingList, resumeChecklist, ResumeView, VISIBILITIES,
  type EditorStep, type ResumeDraft,
} from "~/shared/resume/ResumeView";
import { BackLink } from "~/shared/ui/BackLink";
import { Button, IconButton } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { Chip } from "~/shared/ui/Chip";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Field, Input, Textarea } from "~/shared/ui/Field";
import { MoneyInput } from "~/shared/ui/MoneyInput";
import { MonthPicker } from "~/shared/ui/MonthPicker";
import { Progress } from "~/shared/ui/Progress";
import { PageHeader } from "~/shared/ui/Section";
import { Select } from "~/shared/ui/Select";
import { SelectableCard, SelectableCardGroup } from "~/shared/ui/SelectableCard";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";
import { Stepper } from "~/shared/ui/Stepper";
import { toast } from "~/shared/ui/toast-store";
import { Checkbox } from "~/shared/ui/Toggle";

type Detail = Schemas["ResumeDetail"];
type Edu = NonNullable<ResumeDraft["educations"]>[number];
type Lang = NonNullable<ResumeDraft["languages"]>[number];

// A focused editor: the floating save bar replaces the tab bar on phones (one blurred layer).
export const handle: ShellHandle = { tabBar: false };

const EMPTY: ResumeDraft = {
  title: "", about: "", relocate: false, currency: "UZS", employment_types: [], work_formats: [], visibility: "public",
  experiences: [], educations: [], skills: [], languages: [{ language: "uz", level: "native" }],
};
const STEPS: EditorStep[] = ["basics", "experience", "education", "skills", "visibility", "preview"];
const LEVELS = ["secondary", "vocational", "incomplete_higher", "bachelor", "master", "phd"] as const;
const LANG_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2", "native"] as const;
const LANGS = ["uz", "ru", "en", "tr", "ko", "de", "zh", "ar", "kk", "tg", "ky", "fr", "ja"];
const EMPLOYMENT = ["full_time", "part_time", "project", "internship", "volunteer"] as const;
const FORMATS = ["office", "remote", "hybrid"] as const;
const MAX = { exp: 20, edu: 10, lang: 10, skills: 30 } as const;
const VIS_ICONS = { public: Globe, applied_only: Building2, hidden: Lock } as const;
const LIVE_KEY = "jv_resume_live_preview";

const thisMonth = () => new Date().toISOString().slice(0, 7);
const isStep = (s: string | null): s is EditorStep => STEPS.includes(s as EditorStep);

// Which step owns a validation key: our own ("exp.2.start") or the API's ("experiences", "start").
function stepOfKey(k: string): EditorStep {
  if (/^(exp\.|experiences|company|position|start$|end$|description)/.test(k)) return "experience";
  if (/^(edu\.|educations|institution|level|field|start_year|end_year)/.test(k)) return "education";
  if (/^(lang\.|languages|language|skills)/.test(k)) return "skills";
  if (k === "visibility") return "visibility";
  return "basics";
}

/** The rules the API enforces, checked before sending so errors point at the exact field. */
function validate(f: ResumeDraft, t: TFunction): Record<string, string> {
  const e: Record<string, string> = {};
  const required = t("validation.required");
  const title = f.title.trim();
  if (title.length < 2) e.title = title ? t("validation.min", { n: 2 }) : required;
  const now = thisMonth();
  f.experiences?.forEach((x, i) => {
    if (!x.company.trim()) e[`exp.${i}.company`] = required;
    if (!x.position.trim()) e[`exp.${i}.position`] = required;
    if (!x.start) e[`exp.${i}.start`] = required;
    else if (x.start > now) e[`exp.${i}.start`] = t("resumePage.errors.future");
    if (x.end && x.start && x.end < x.start) e[`exp.${i}.end`] = t("resume.datesError");
  });
  f.educations?.forEach((x, i) => {
    if (!x.institution.trim()) e[`edu.${i}.institution`] = required;
    if (x.start_year && x.end_year && x.end_year < x.start_year) e[`edu.${i}.end_year`] = t("resumePage.errors.years");
  });
  const seen = new Set<string>();
  f.languages?.forEach((l, i) => {
    if (seen.has(l.language)) e[`lang.${i}`] = t("resume.langDup");
    seen.add(l.language);
  });
  return e;
}

export default function ResumeEdit() {
  return <SeekerOnly><Editor /></SeekerOnly>;
}

function Editor() {
  const { id } = useParams();
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["resume", id],
    enabled: Boolean(id),
    queryFn: () => authed<Detail>(() => api.GET("/resumes/{resume}", { params: { path: { resume: id! } } })),
  });
  const loading = useSkeletonHold(Boolean(id) && q.isPending);
  if (loading) return <SkeletonDelay><EditorSkeleton /></SkeletonDelay>;
  if (id && (q.isError || !q.data)) {
    return (
      <>
        <PageHeader title={t("resume.editTitle")} breadcrumbs={<BackLink to="/me/resumes">{t("account.myResumes")}</BackLink>} />
        <Card padding="none"><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card>
      </>
    );
  }
  return <ResumeForm key={id ?? "new"} id={id} detail={q.data} />;
}

function ResumeForm({ id, detail }: { id?: string; detail?: Detail }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const { user } = useSession();
  const { pending, error, fields, run, setError } = useSubmit();

  const initial = useMemo(() => (detail ? detailToDraft(detail) : EMPTY), [detail]);
  const [f, setF] = useState<ResumeDraft>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const dirty = useMemo(() => JSON.stringify(f) !== baseline, [f, baseline]);
  const [savedAt, setSavedAt] = useState<number | null>(() => ((location.state as { saved?: boolean } | null)?.saved ? Date.now() : null));
  const [step, setStep] = useState<EditorStep>(() => (isStep(params.get("step")) ? (params.get("step") as EditorStep) : "basics"));
  const [visited, setVisited] = useState<Set<EditorStep>>(() => new Set([step]));
  // Keys that failed the last save attempt. Only those show errors (live, so they clear as
  // they're fixed); an entry added afterwards isn't flagged red before it's even typed in.
  const [flagged, setFlagged] = useState<ReadonlySet<string>>(() => new Set());
  const [focusReq, setFocusReq] = useState<{ n: number; invalid: boolean }>({ n: 0, invalid: false });
  const stepRef = useRef<HTMLDivElement>(null);
  const guard = useUnsavedChanges(dirty);

  const errors = useMemo(() => {
    if (!flagged.size) return {};
    return Object.fromEntries(Object.entries(validate(f, t)).filter(([k]) => flagged.has(k)));
  }, [flagged, f, t]);
  const fixMessage = t("resumePage.errors.fix");
  // Everything flagged is fixed: drop the summary too.
  useEffect(() => {
    if (flagged.size && !Object.keys(errors).length) {
      setFlagged(new Set());
      if (error === fixMessage) setError(null);
    }
  }, [flagged, errors, error, fixMessage, setError]);
  const check = useMemo(() => resumeChecklist(f), [f]);
  const failing = useMemo(() => {
    const s = new Set<EditorStep>();
    Object.keys(errors).forEach((k) => s.add(stepOfKey(k)));
    Object.keys(fields).forEach((k) => s.add(stepOfKey(k)));
    return s;
  }, [errors, fields]);
  const err = (k: string) => errors[k] ?? fields[k];

  // Live preview beside the form: desktop-wide screens only, remembered per browser.
  const wide = useMedia("(min-width: 80rem)");
  const [liveOn, setLiveOn] = useState(false);
  useEffect(() => {
    try { setLiveOn(localStorage.getItem(LIVE_KEY) === "1"); } catch { /* storage blocked: default off */ }
  }, []);
  const toggleLive = () => {
    setLiveOn((v) => {
      try { localStorage.setItem(LIVE_KEY, v ? "0" : "1"); } catch { /* not persisted */ }
      return !v;
    });
  };
  const live = liveOn && wide && step !== "preview";
  // Typing stays instant; the preview catches up when the main thread is free.
  const deferred = useDeferredValue(f);
  const previewDetail = useMemo(
    () => draftToDetail(deferred, {
      id: id ?? "draft",
      person: detail?.person ?? { id: user?.id, full_name: user?.full_name, avatar_url: user?.avatar_url },
      contacts: detail?.contacts ?? { email: user?.email, phone: user?.phone },
      updated_at: detail?.updated_at ?? new Date().toISOString(),
    }),
    [deferred, id, detail, user],
  );

  // Floating save bar on phones: toasts rise above it while the editor is open.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--toast-lift", "4.5rem");
    return () => void root.style.removeProperty("--toast-lift");
  }, []);

  // After a step change: bring the step into view and move focus to its heading (or, after a
  // failed save, to the first invalid field in it).
  useEffect(() => {
    if (!focusReq.n) return;
    const frame = requestAnimationFrame(() => {
      const root = stepRef.current;
      if (!root) return;
      const smooth = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      const invalid = focusReq.invalid ? root.querySelector<HTMLElement>('[aria-invalid="true"]') : null;
      if (invalid) {
        invalid.focus({ preventScroll: true });
        invalid.scrollIntoView({ block: "center", behavior: smooth });
        return;
      }
      root.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
      if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: "start", behavior: smooth });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusReq]);

  // A server-side validation error in another step: open that step and point at the problem.
  useEffect(() => {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    const target = STEPS.find((s) => keys.some((k) => stepOfKey(k) === s));
    if (target && target !== step) goTo(target, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  function goTo(s: EditorStep, invalid = false) {
    setStep(s);
    setVisited((v) => (v.has(s) ? v : new Set(v).add(s)));
    setFocusReq((r) => ({ n: r.n + 1, invalid }));
  }
  const at = STEPS.indexOf(step);

  const set = <K extends keyof ResumeDraft>(k: K, v: ResumeDraft[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggle = (k: "employment_types" | "work_formats", v: string) =>
    setF((s) => {
      const cur = (s[k] ?? []) as string[];
      return { ...s, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });
  const patchAt = <K extends "experiences" | "educations" | "languages">(k: K, i: number, patch: Partial<NonNullable<ResumeDraft[K]>[number]>) =>
    setF((s) => ({ ...s, [k]: (s[k] ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  // Removing an entry is undoable for a few seconds instead of asking first.
  const removeAt = <K extends "experiences" | "educations" | "languages">(k: K, i: number, label: string) => {
    const item = (f[k] ?? [])[i];
    setF((s) => ({ ...s, [k]: (s[k] ?? []).filter((_, j) => j !== i) }));
    if (k === "languages") return;
    toast({
      tone: "info",
      title: t("resumePage.removed", { name: label }),
      action: {
        label: t("resumePage.undo"),
        onClick: () => setF((s) => {
          const list = [...((s[k] ?? []) as unknown[])];
          list.splice(Math.min(i, list.length), 0, item);
          return { ...s, [k]: list };
        }),
      },
    });
  };
  const focusSoon = (elId: string) => requestAnimationFrame(() => {
    const el = document.getElementById(elId);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problems = validate(f, t);
    setFlagged(new Set(Object.keys(problems)));
    if (Object.keys(problems).length) {
      const first = STEPS.find((s) => Object.keys(problems).some((k) => stepOfKey(k) === s)) ?? step;
      setError(fixMessage);
      goTo(first, true);
      return;
    }
    const snapshot = f;
    const body: ResumeDraft = {
      ...snapshot,
      title: snapshot.title.trim(),
      experiences: snapshot.experiences?.map((x) => ({ ...x, end: x.end || null })),
      desired_salary: snapshot.desired_salary || undefined,
    };
    void run(
      () => withAuth(() => (id
        ? api.PUT("/resumes/{resume}", { params: { path: { resume: id } }, body })
        : api.POST("/resumes", { body }))),
      (res) => {
        const saved = dataOf<Detail>(res);
        void qc.invalidateQueries({ queryKey: ["my-resumes"] });
        if (!saved) {
          void qc.invalidateQueries({ queryKey: ["resume", id] });
          setBaseline(JSON.stringify(snapshot));
          setSavedAt(Date.now());
          return;
        }
        qc.setQueryData(["resume", saved.id], saved);
        if (!id) {
          // Created: continue editing the saved resume at the same step.
          toast({ tone: "success", title: t("resumePage.created") });
          navigate(`${localizedPath(locale, `/me/resumes/${saved.id}/edit`)}?step=${step}`, {
            replace: true, state: { allowLeave: true, saved: true }, preventScrollReset: true,
          });
          return;
        }
        // Take the server's normalised copy unless the person kept typing while it saved.
        const next = detailToDraft(saved);
        const snap = JSON.stringify(snapshot);
        setF((cur) => (JSON.stringify(cur) === snap ? next : cur));
        setBaseline(JSON.stringify(next));
        setSavedAt(Date.now());
        toast({ tone: "success", title: t("common.saved") });
      },
    );
  };

  const { categories, regions } = useCatalog();
  const categoryGroups = useMemo(() => categories.map((c) => ({
    label: nameOf(c.name, locale),
    options: (c.children?.length ? c.children : [c]).map((ch) => ({ value: String(ch.id), label: nameOf(ch.name, locale) })),
  })), [categories, locale]);
  const regionOptions = useMemo(() => regions.map((r) => ({ value: String(r.id), label: nameOf(r.name, locale) })), [regions, locale]);

  const steps = STEPS.map((s) => ({
    id: s,
    label: t(`resumePage.steps.${s}`),
    error: failing.has(s),
    done: s === "preview" ? false
      : s === "visibility" ? Boolean(id) || visited.has(s) // a saved resume already has a choice
      : check.items.filter((c) => c.step === s).every((c) => c.done),
  }));
  const exps = f.experiences ?? [];
  const edus = f.educations ?? [];
  const langs = f.languages ?? [];

  const status = dirty ? (
    <><span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-zafaron" /><span className="truncate">{t("resumePage.unsaved")}</span></>
  ) : savedAt ? (
    <><Check aria-hidden="true" className="size-4 shrink-0 text-firuza" /><span className="truncate">{t("common.saved")}</span></>
  ) : (
    <span className="num truncate">{t("resumePage.stepOf", { n: at + 1, total: STEPS.length })}</span>
  );

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        breadcrumbs={<BackLink to="/me/resumes">{t("account.myResumes")}</BackLink>}
        // Long single words ("Редактирование") hyphenate instead of breaking mid-word on phones.
        title={<span className="hyphens-auto">{id ? t("resume.editTitle") : t("resume.newTitle")}</span>}
        description={t("resume.formHint")}
        actions={wide ? (
          <Button type="button" variant="secondary" size="sm" aria-pressed={liveOn} onClick={toggleLive}
            icon={liveOn ? <EyeOff className="size-4" /> : <Eye className="size-4" />}>
            {t("resumePage.livePreview")}
          </Button>
        ) : undefined}
      />
      <FormError className="mb-4">{error}</FormError>

      <div className={cn("grid gap-6", live ? "grid-cols-2" : "lg:grid-cols-[13rem_minmax(0,1fr)]")}>
        <nav aria-label={t("resumePage.sections")} className={cn("min-w-0", live ? "col-span-2" : "lg:sticky lg:top-24 lg:self-start")}>
          <Stepper steps={steps} current={step} onStepChange={(s) => goTo(s as EditorStep)} orientation={live ? "horizontal" : "responsive"} className="-mx-1" />
          {!live && (
            <div className="mt-6 hidden border-t border-line pt-5 lg:block">
              <Progress value={check.percent} label={t("resumePage.completeness")} tone={check.percent === 100 ? "firuza" : "lapis"} size="sm" showValue />
              <p className="mt-2 text-sm text-ink-2">
                {check.missing.length
                  ? t("resumePage.missing", { items: missingList(check.missing, t, locale) })
                  : t("resumePage.complete")}
              </p>
            </div>
          )}
        </nav>

        <div ref={stepRef} id="resume-step" className="min-w-0">
          {step === "preview" ? (
            <section aria-labelledby="step-title" key={step} className="anim-fade flex flex-col gap-6">
              <StepHeading step={step} at={at} />
              <Readiness check={check} onGo={(s) => goTo(s)} />
              <ResumeView r={previewDetail} preview headingAs="h2" />
            </section>
          ) : (
            <Card as="section" radius="sheet" padding="lg" aria-labelledby="step-title" key={step} className="@container anim-fade">
              <StepHeading step={step} at={at} />
              <div className="mt-6 flex flex-col gap-5">
                {step === "basics" && (
                  <>
                    <Field label={t("resume.position")} hint={t("resume.positionHint")} error={err("title")}>
                      <Input id="f-title" value={f.title} onChange={(e) => set("title", e.target.value)} required minLength={2} maxLength={150} autoComplete="off" enterKeyHint="next" />
                    </Field>
                    <div className="grid gap-5 @lg:grid-cols-2">
                      <Field label={t("jobs.filters.category")} error={err("category_id")}>
                        <Select value={String(f.category_id ?? "")} onValueChange={(v) => set("category_id", v ? Number(v) : undefined)} placeholder={t("resume.choose")} groups={categoryGroups} />
                      </Field>
                      <Field label={t("resume.city")} error={err("region_id")}>
                        <Select value={String(f.region_id ?? "")} onValueChange={(v) => set("region_id", v ? Number(v) : undefined)} placeholder={t("resume.choose")} options={regionOptions} />
                      </Field>
                    </div>
                    <Checkbox checked={Boolean(f.relocate)} onCheckedChange={(v) => set("relocate", v)} label={t("resume.relocate")} />
                    <Field label={t("resume.salary")} optional={t("common.optional")} hint={t("resumePage.salaryHint")} error={err("desired_salary")}>
                      <MoneyInput
                        value={f.desired_salary ?? null}
                        onChange={(v) => set("desired_salary", v ?? undefined)}
                        currency={f.currency ?? "UZS"}
                        onCurrencyChange={(c) => set("currency", c)}
                        placeholder="8 000 000"
                      />
                    </Field>
                    <ChipGroup id="employment" label={t("jobs.filters.employment")}>
                      {EMPLOYMENT.map((v) => (
                        <Chip key={v} selected={Boolean(f.employment_types?.includes(v))} onClick={() => toggle("employment_types", v)}>{t(`enums.employment_type.${v}`)}</Chip>
                      ))}
                    </ChipGroup>
                    <ChipGroup id="formats" label={t("jobs.filters.format")}>
                      {FORMATS.map((v) => (
                        <Chip key={v} selected={Boolean(f.work_formats?.includes(v))} onClick={() => toggle("work_formats", v)}>{t(`enums.work_format.${v}`)}</Chip>
                      ))}
                    </ChipGroup>
                    <Field label={t("resume.about")} optional={t("common.optional")} hint={t("resume.aboutHint")} error={err("about")}>
                      <Textarea rows={5} maxLength={5000} value={f.about ?? ""} onChange={(e) => set("about", e.target.value)} />
                    </Field>
                  </>
                )}

                {step === "experience" && (
                  <>
                    <StepCallout message={fields.experiences ?? (Object.keys(fields).some((k) => stepOfKey(k) === "experience") ? t("apiErrors.validation_failed") : undefined)} />
                    {exps.length === 0 && (
                      <NoEntries icon={<Briefcase />} title={t("resumePage.noExperience")} body={t("resumePage.noExperienceBody")} />
                    )}
                    {exps.map((x, i) => (
                      <Entry
                        key={i}
                        id={`exp-${i}`}
                        title={x.position.trim() || t("resumePage.newJob")}
                        subtitle={x.company.trim()}
                        removeLabel={t("resumePage.removeJob")}
                        onRemove={() => {
                          removeAt("experiences", i, x.position.trim() || t("resumePage.newJob"));
                          focusSoon("exp-add");
                        }}
                      >
                        <div className="grid gap-5 @lg:grid-cols-2">
                          <Field label={t("resume.role")} error={err(`exp.${i}.position`)}>
                            <Input id={`exp-${i}-position`} value={x.position} maxLength={150} onChange={(e) => patchAt("experiences", i, { position: e.target.value })} />
                          </Field>
                          <Field label={t("resume.company")} error={err(`exp.${i}.company`)}>
                            <Input id={`exp-${i}-company`} value={x.company} maxLength={150} onChange={(e) => patchAt("experiences", i, { company: e.target.value })} />
                          </Field>
                          <Field label={t("resume.start")} error={err(`exp.${i}.start`)}>
                            <MonthPicker
                              value={x.start}
                              max={thisMonth()}
                              placeholder={t("picker.chooseMonth")}
                              onChange={(v) => patchAt("experiences", i, { start: v, ...(x.end && v > x.end ? { end: v } : {}) })}
                            />
                          </Field>
                          <Field label={t("resume.end")} error={err(`exp.${i}.end`)}>
                            {x.end == null ? (
                              <MonthPicker value="" disabled placeholder={t("resume.present")} onChange={() => {}} />
                            ) : (
                              <MonthPicker value={x.end} min={x.start || undefined} max={thisMonth()} placeholder={t("picker.chooseMonth")} onChange={(v) => patchAt("experiences", i, { end: v })} />
                            )}
                          </Field>
                        </div>
                        <Checkbox
                          checked={x.end == null}
                          onCheckedChange={(v) => patchAt("experiences", i, { end: v ? null : x.start && x.start > thisMonth() ? x.start : thisMonth() })}
                          label={t("resume.current")}
                        />
                        <Field label={t("resume.duties")} optional={t("common.optional")} hint={t("resumePage.dutiesHint")}>
                          <Textarea rows={3} maxLength={3000} value={x.description ?? ""} onChange={(e) => patchAt("experiences", i, { description: e.target.value })} />
                        </Field>
                      </Entry>
                    ))}
                    <AddRow
                      id="exp-add"
                      count={exps.length}
                      max={MAX.exp}
                      onClick={() => {
                        set("experiences", [...exps, { company: "", position: "", start: "", end: null, description: "" }]);
                        focusSoon(`exp-${exps.length}-position`);
                      }}
                    >
                      {t("resume.addExperience")}
                    </AddRow>
                  </>
                )}

                {step === "education" && (
                  <>
                    <StepCallout message={fields.educations ?? (Object.keys(fields).some((k) => stepOfKey(k) === "education") ? t("apiErrors.validation_failed") : undefined)} />
                    {edus.length === 0 && (
                      <NoEntries icon={<GraduationCap />} title={t("resumePage.noEducation")} body={t("resumePage.noEducationBody")} />
                    )}
                    {edus.map((x, i) => (
                      <Entry
                        key={i}
                        id={`edu-${i}`}
                        title={x.institution.trim() || t("resumePage.newSchool")}
                        subtitle={t(`resume.levels.${x.level}`)}
                        removeLabel={t("resumePage.removeSchool")}
                        onRemove={() => {
                          removeAt("educations", i, x.institution.trim() || t("resumePage.newSchool"));
                          focusSoon("edu-add");
                        }}
                      >
                        <Field label={t("resume.institution")} error={err(`edu.${i}.institution`)}>
                          <Input id={`edu-${i}-institution`} value={x.institution} maxLength={200} onChange={(e) => patchAt("educations", i, { institution: e.target.value })} />
                        </Field>
                        <div className="grid gap-5 @lg:grid-cols-2">
                          <Field label={t("resume.level")}>
                            <Select value={x.level} required onValueChange={(v) => patchAt("educations", i, { level: v as Edu["level"] })} options={LEVELS.map((l) => ({ value: l, label: t(`resume.levels.${l}`) }))} />
                          </Field>
                          <Field label={t("resume.field")} optional={t("common.optional")}>
                            <Input value={x.field ?? ""} maxLength={150} onChange={(e) => patchAt("educations", i, { field: e.target.value })} />
                          </Field>
                          <Field label={t("resume.startYear")} optional={t("common.optional")}>
                            <MonthPicker
                              mode="year" min="1950" max={String(new Date().getFullYear())} placeholder={t("picker.chooseYear")}
                              value={x.start_year ? String(x.start_year) : ""}
                              onChange={(v) => patchAt("educations", i, { start_year: v ? Number(v) : undefined, ...(v && x.end_year && Number(v) > x.end_year ? { end_year: Number(v) } : {}) })}
                            />
                          </Field>
                          <Field label={t("resume.endYear")} optional={t("common.optional")} hint={t("resume.endYearHint")} error={err(`edu.${i}.end_year`)}>
                            <MonthPicker
                              mode="year" min={x.start_year ? String(x.start_year) : "1950"} max={String(new Date().getFullYear() + 8)} placeholder={t("picker.chooseYear")}
                              value={x.end_year ? String(x.end_year) : ""}
                              onChange={(v) => patchAt("educations", i, { end_year: v ? Number(v) : undefined })}
                            />
                          </Field>
                        </div>
                      </Entry>
                    ))}
                    <AddRow
                      id="edu-add"
                      count={edus.length}
                      max={MAX.edu}
                      onClick={() => {
                        set("educations", [...edus, { institution: "", level: "bachelor" }]);
                        focusSoon(`edu-${edus.length}-institution`);
                      }}
                    >
                      {t("resume.addEducation")}
                    </AddRow>
                  </>
                )}

                {step === "skills" && (
                  <>
                    <Field label={t("jobs.skills")} hint={t("resumePage.skillsHint", { n: (f.skills ?? []).length, max: MAX.skills })} error={err("skills")}>
                      <TagInput value={f.skills ?? []} onChange={(v) => set("skills", v)} max={MAX.skills} placeholder={t("resume.skillsPlaceholder")} />
                    </Field>
                    <section aria-labelledby="langs-title" className="flex flex-col gap-3 border-t border-line pt-5">
                      <h3 id="langs-title" className="text-md font-semibold text-ink">{t("resume.languages")}</h3>
                      {langs.map((x, i) => (
                        <div key={i} className="flex items-end gap-2">
                          <div className="grid min-w-0 flex-1 gap-2 @md:grid-cols-2">
                            <Field label={i === 0 ? t("resume.language") : undefined} error={err(`lang.${i}`)}>
                              <Select
                                aria-label={i === 0 ? undefined : t("resume.language")}
                                value={x.language}
                                required
                                onValueChange={(v) => patchAt("languages", i, { language: v })}
                                options={LANGS.map((l) => ({ value: l, label: t(`langs.${l}`) }))}
                              />
                            </Field>
                            <Field label={i === 0 ? t("resume.langLevel") : undefined}>
                              <Select
                                aria-label={i === 0 ? undefined : t("resume.langLevel")}
                                value={x.level}
                                required
                                onValueChange={(v) => patchAt("languages", i, { level: v as Lang["level"] })}
                                options={LANG_LEVELS.map((l) => ({ value: l, label: t(`resume.langLevels.${l}`) }))}
                              />
                            </Field>
                          </div>
                          <IconButton
                            label={t("resumePage.removeLanguage", { name: t(`langs.${x.language}`) })}
                            className="shrink-0 text-ink-2 hover:text-anor-ink"
                            onClick={() => {
                              removeAt("languages", i, "");
                              focusSoon("lang-add");
                            }}
                          >
                            <Trash2 className="size-4.5" />
                          </IconButton>
                        </div>
                      ))}
                      <AddRow
                        id="lang-add"
                        count={langs.length}
                        max={MAX.lang}
                        onClick={() => set("languages", [...langs, { language: LANGS.find((l) => !langs.some((x) => x.language === l)) ?? "en", level: "b1" }])}
                      >
                        {t("resume.addLanguage")}
                      </AddRow>
                    </section>
                  </>
                )}

                {step === "visibility" && (
                  <SelectableCardGroup value={f.visibility ?? "public"} onValueChange={(v) => set("visibility", v as ResumeDraft["visibility"])} label={t("resume.visibility")}>
                    {VISIBILITIES.map((v) => {
                      const Icon = VIS_ICONS[v];
                      return (
                        <SelectableCard key={v} value={v} icon={<Icon />} title={t(`resume.vis.${v}`)} description={t(`resume.visHint.${v}`)} />
                      );
                    })}
                  </SelectableCardGroup>
                )}
              </div>
            </Card>
          )}

          {/* Floating save bar: step navigation + save, always within thumb reach. Its labels
              follow the bar's own width (phones, or the narrow form column beside the preview). */}
          <div className="@container sticky bottom-above-tabbar z-40 mt-6">
            <div className="glass-chrome flex items-center gap-2 rounded-sheet p-2">
              <Button
                type="button"
                variant="ghost"
                icon={<ArrowLeft className="size-4.5" />}
                disabled={at === 0}
                onClick={() => goTo(STEPS[at - 1])}
                className="@max-md:w-11 @max-md:px-0"
              >
                <span className="@max-md:sr-only">{t("common.back")}</span>
              </Button>
              <p role="status" className="flex min-w-0 flex-1 items-center gap-2 px-1 text-sm text-ink-2 @max-lg:sr-only">
                {status}
              </p>
              <span aria-hidden="true" className="flex-1 @lg:hidden" />
              {at < STEPS.length - 1 && (
                <Button type="button" variant="secondary" onClick={() => goTo(STEPS[at + 1])}>
                  {t("states.next")}
                  <ArrowRight aria-hidden="true" className="size-4.5" />
                </Button>
              )}
              <Button type="submit" loading={pending} icon={!dirty && savedAt ? <Check className="size-4.5" /> : undefined}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>

        {live && (
          <aside aria-label={t("resumePage.livePreview")} className="min-w-0">
            <div className="sticky top-24">
              <p className="mb-2 flex items-center gap-2 text-sm text-ink-2">
                <Eye aria-hidden="true" className="size-4 shrink-0" />
                {t("resumePage.previewNote")}
              </p>
              <div className="overflow-y-auto overscroll-contain rounded-sheet" style={{ maxHeight: "calc(100dvh - 9rem)" }}>
                {/* Scaled like a page thumbnail; layout inside follows its own container. */}
                <div style={{ zoom: 0.8 }}>
                  <ResumeView r={previewDetail} preview headingAs="h2" />
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
      {guard}
    </form>
  );
}

function StepHeading({ step, at }: { step: EditorStep; at: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="num text-sm font-medium text-ink-2">{t("resumePage.stepOf", { n: at + 1, total: STEPS.length })}</p>
        <h2
          id="step-title"
          data-step-heading=""
          tabIndex={-1}
          className="mt-1 break-words font-display text-xl font-semibold tracking-heading text-ink outline-none" // jv-ui-ignore: programmatic focus target after a step change, not a control
        >
          {t(`resumePage.steps.${step}`)}
        </h2>
        <p className="mt-1.5 max-w-2xl text-md text-ink-2">{t(`resumePage.stepHints.${step}`)}</p>
      </div>
    </div>
  );
}

/** Preview step: how ready the resume is, with a jump to every missing part. */
function Readiness({ check, onGo }: { check: ReturnType<typeof resumeChecklist>; onGo: (s: EditorStep) => void }) {
  const { t } = useTranslation();
  return (
    <Card padding="md">
      <Progress value={check.percent} label={t("resumePage.completeness")} tone={check.percent === 100 ? "firuza" : "lapis"} showValue />
      {check.missing.length ? (
        <ul className="-mx-2 mt-3 grid gap-x-4 sm:grid-cols-2">
          {check.missing.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onGo(c.step)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-control px-2 text-start text-md transition-[background-color,scale] duration-150 hover:bg-sunken active:scale-[0.98]"
              >
                <CircleDashed aria-hidden="true" className="size-4.5 shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 text-ink">{t(`resumePage.check.${c.id}`)}</span>
                <span className="shrink-0 text-sm font-medium text-lapis-ink">{t("resumePage.add")}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-md text-ink-2">
          <Check aria-hidden="true" className="size-4.5 shrink-0 text-firuza" />
          {t("resumePage.complete")}
        </p>
      )}
    </Card>
  );
}

/** One experience/education entry: its own titled block with a remove action. */
function Entry({ id, title, subtitle, removeLabel, onRemove, children }: {
  id: string; title: string; subtitle?: string; removeLabel: string; onRemove: () => void; children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-5 rounded-panel border border-line bg-sunken/60 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 pt-2">
          <h3 id={`${id}-title`} className="break-words text-md font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 break-words text-sm text-ink-2">{subtitle}</p>}
        </div>
        <IconButton label={removeLabel} onClick={onRemove} className="-mr-1.5 -mt-0.5 shrink-0 text-ink-2 hover:text-anor-ink">
          <Trash2 className="size-4.5" />
        </IconButton>
      </div>
      {children}
    </section>
  );
}

function NoEntries({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-4 rounded-panel border border-dashed border-line-strong p-5">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-control bg-lapis-soft text-lapis [&_svg]:size-5">{icon}</span>
      <div className="min-w-0">
        <p className="text-md font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm text-ink-2">{body}</p>
      </div>
    </div>
  );
}

function AddRow({ id, count, max, onClick, children }: { id?: string; count: number; max: number; onClick: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  const full = count >= max;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button id={id} type="button" variant="soft" icon={<Plus className="size-4.5" />} onClick={onClick} disabled={full}>{children}</Button>
      {full && <p className="text-sm text-ink-2">{t("resumePage.maxReached", { max })}</p>}
    </div>
  );
}

function ChipGroup({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className="mb-2.5 text-sm font-medium text-ink">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function StepCallout({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="rounded-control bg-anor-soft px-4 py-3 text-sm text-anor-ink">{message}</p>;
}

function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

function EditorSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true">
        <div className="mb-6 flex flex-col gap-3 md:mb-8">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-64 max-w-full md:h-10" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="flex gap-2 overflow-hidden lg:flex-col">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex shrink-0 items-center gap-2.5 py-2 pl-1.5">
                <Skeleton className="size-7 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          <div className="surface-card rounded-sheet p-6 md:p-8">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-7 w-48" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <div className="mt-8 flex flex-col gap-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-11 rounded-control" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
