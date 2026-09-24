import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Building2, ExternalLink, ShieldCheck } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate, useParams } from "react-router";

import type { ShellHandle } from "../site";
import { EmployerOnly } from "./EmployerOnly";
import { useMyCompany, type Company } from "./company-hook";
import { ChoiceChips } from "./vacancy-edit/ChoiceChips";
import { DescriptionEditor } from "./vacancy-edit/DescriptionEditor";
import {
  EMPTY, ENUMS, fromDetail, LIMITS, readiness, REQUIRED, salaryInverted, stepOf, STEPS, tidyDescription, validate,
  type Detail, type EditorStep, type VInput,
} from "./vacancy-edit/model";
import { Readiness, VacancyPreview } from "./vacancy-edit/Preview";
import { api, apiError } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { withAuth } from "~/shared/auth/session";
import { nameOf, useCatalog } from "~/shared/catalog/catalog";
import { FormError } from "~/shared/forms/FormError";
import { TagInput } from "~/shared/forms/TagInput";
import { useSubmit } from "~/shared/forms/useSubmit";
import { useUnsavedChanges } from "~/shared/forms/useUnsavedChanges";
import { localizedPath } from "~/shared/i18n/config";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { authed } from "~/shared/query/query";
import { BackLink } from "~/shared/ui/BackLink";
import { Badge, type BadgeTone } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Callout } from "~/shared/ui/Callout";
import { Card, CardFooter } from "~/shared/ui/Card";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Field, Input } from "~/shared/ui/Field";
import { Progress } from "~/shared/ui/Progress";
import { SalaryRange } from "~/shared/ui/SalaryRange";
import { PageHeader } from "~/shared/ui/Section";
import { Select } from "~/shared/ui/Select";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";
import { Stepper } from "~/shared/ui/Stepper";
import { toast } from "~/shared/ui/toast-store";

// A focused editor: its floating save bar replaces the tab bar on phones (one blurred layer).
export const handle: ShellHandle = { tabBar: false };

const STATUS_TONE: Record<Detail["status"], BadgeTone> = {
  draft: "neutral", moderation: "zafaron", published: "firuza", rejected: "anor", archived: "outline", expired: "outline",
};

export default function VacancyEdit() {
  return <EmployerOnly><Loader /></EmployerOnly>;
}

function Loader() {
  const { id } = useParams();
  const { t } = useTranslation();
  const mine = useMyCompany();
  const q = useQuery({
    queryKey: ["vacancy", id],
    enabled: Boolean(id),
    queryFn: () => authed<Detail>(() => api.GET("/vacancies/{vacancy}", { params: { path: { vacancy: id! } } })),
  });
  const loading = useSkeletonHold(mine.isPending || (Boolean(id) && q.isPending));
  if (loading) return <SkeletonDelay><EditorSkeleton /></SkeletonDelay>;

  const header = (
    <PageHeader
      title={id ? t("vacancyEditor.editTitle") : t("nav.postVacancy")}
      breadcrumbs={<BackLink to="/employer">{t("account.dashboard")}</BackLink>}
    />
  );
  if (mine.isError) {
    return <>{header}<Card padding="none"><ErrorState error={mine.error} onRetry={() => mine.refetch()} /></Card></>;
  }
  if (!mine.company) {
    return (
      <>
        {header}
        <Card padding="none">
          <EmptyState
            icon={<Building2 />}
            title={t("employer.noCompany")}
            body={t("employer.createHint")}
            action={<Button asChild><LocalizedLink to="/employer/company">{t("employer.createCompany")}</LocalizedLink></Button>}
          />
        </Card>
      </>
    );
  }
  if (id && (q.isError || !q.data)) {
    return <>{header}<Card padding="none"><ErrorState error={q.error} onRetry={() => q.refetch()} /></Card></>;
  }
  return <VacancyForm key={id ?? "new"} company={mine.company} existing={q.data} />;
}

function VacancyForm({ company, existing }: { company: Company; existing?: Detail }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { categories, regions } = useCatalog();
  const { pending, error, fields, run, setError } = useSubmit();

  const [f, setF] = useState<VInput>(() => (existing ? fromDetail(existing) : EMPTY));
  const [baseline] = useState(() => JSON.stringify(f));
  const dirty = useMemo(() => JSON.stringify(f) !== baseline, [f, baseline]);
  const guard = useUnsavedChanges(dirty);
  const [publishing, setPublishing] = useState(false);
  // Published or waiting for review: saving keeps it there (unverified companies' edits are re-reviewed by the API).
  const live = existing?.status === "published" || existing?.status === "moderation";
  const verified = company.verified;

  const [step, setStep] = useState<EditorStep>("basics");
  const [visited, setVisited] = useState<ReadonlySet<EditorStep>>(() => new Set(["basics"]));
  // Keys that failed a save attempt (or a blur check). Only those show errors, live, so they clear as they're fixed.
  const [flagged, setFlagged] = useState<ReadonlySet<string>>(() => new Set());
  const [focusReq, setFocusReq] = useState({ n: 0, invalid: false });
  const stepRef = useRef<HTMLDivElement>(null);
  const at = STEPS.indexOf(step);

  const problems = useMemo(() => validate(f, t), [f, t]);
  const errors = useMemo(
    () => Object.fromEntries(Object.entries(problems).filter(([k]) => flagged.has(k))),
    [problems, flagged],
  );
  const err = (k: string): string | undefined => errors[k] ?? fields[k];
  const fixMessage = t("vacancyEditor.fix");
  // Everything flagged is fixed: the summary goes too.
  useEffect(() => {
    if (flagged.size && !Object.keys(errors).length) {
      setFlagged(new Set());
      if (error === fixMessage) setError(null);
    }
  }, [flagged, errors, error, fixMessage, setError]);

  const ready = useMemo(() => readiness(f), [f]);
  const inverted = salaryInverted(f);
  const failing = useMemo(() => {
    const s = new Set<EditorStep>();
    [...Object.keys(errors), ...Object.keys(fields)].forEach((k) => s.add(stepOf(k)));
    if (inverted) s.add("conditions"); // SalaryRange flags it inline right away
    return s;
  }, [errors, fields, inverted]);
  const steps = STEPS.map((s) => ({
    id: s,
    label: t(`vacancyEditor.steps.${s}`),
    error: failing.has(s),
    done: s === "preview" ? false : ready.items.filter((c) => c.step === s && c.required).every((c) => c.done) && (Boolean(existing) || visited.has(s)),
  }));

  // Typing stays instant; the preview catches up when the main thread is free.
  const deferred = useDeferredValue(f);

  // Floating save bar on phones: toasts rise above it while the editor is open.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--toast-lift", "4.5rem");
    return () => void root.style.removeProperty("--toast-lift");
  }, []);

  // After a step change: focus its heading (or the first invalid field) and bring it into view.
  useEffect(() => {
    if (!focusReq.n) return;
    const frame = requestAnimationFrame(() => {
      const root = stepRef.current;
      if (!root) return;
      const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      const invalid = focusReq.invalid ? root.querySelector<HTMLElement>('[aria-invalid="true"]') : null;
      if (invalid) {
        invalid.focus({ preventScroll: true });
        invalid.scrollIntoView({ block: "center", behavior });
        return;
      }
      root.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
      if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: "start", behavior });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusReq]);

  // A server-side validation error (422) in another step: open that step and point at the field.
  useEffect(() => {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    const target = STEPS.find((s) => keys.some((k) => stepOf(k) === s));
    if (target && target !== step) goTo(target, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  function goTo(s: EditorStep, invalid = false) {
    setStep(s);
    setVisited((v) => (v.has(s) ? v : new Set(v).add(s)));
    setFocusReq((r) => ({ n: r.n + 1, invalid }));
  }

  const set = <K extends keyof VInput>(k: K, v: VInput[K]) => setF((s) => ({ ...s, [k]: v }));
  // Blur check: a started field that breaks a rule says so now; empty required fields wait for a save.
  const touch = (k: "title" | "description") => {
    if (f[k].trim() && problems[k]) setFlagged((s) => (s.has(k) ? s : new Set(s).add(k)));
  };

  // Enter in a one-line field never publishes by accident: it moves to the first required field
  // still empty in this step, or on to the next step.
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter" || e.defaultPrevented || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.nativeEvent.isComposing) return;
    // Only the form's own fields: list filters and suggestion popovers handle Enter themselves.
    if (!(e.target instanceof HTMLInputElement) || e.target.closest("[popover]")) return;
    e.preventDefault();
    const missing = REQUIRED[step]?.find((r) => problems[r.field]);
    if (missing && missing.id !== e.target.id) document.getElementById(missing.id)?.focus();
    else if (at < STEPS.length - 1) goTo(STEPS[at + 1]);
  };

  const save = (publish: boolean) => {
    const keys = Object.keys(problems);
    if (keys.length) {
      setFlagged(new Set(keys));
      setError(fixMessage);
      goTo(STEPS.find((s) => keys.some((k) => stepOf(k) === s)) ?? step, true);
      return;
    }
    setPublishing(publish);
    const body: VInput = {
      ...f, title: f.title.trim(), description: tidyDescription(f.description),
      address: f.address?.trim() || undefined, district_id: f.district_id || undefined,
    };
    void run(
      () => withAuth(() => existing
        ? api.PUT("/vacancies/{vacancy}", { params: { path: { vacancy: existing.id } }, body })
        : api.POST("/companies/{company}/vacancies", { params: { path: { company: company.id } }, body })),
      async (res) => {
        const v = res.data?.data as Detail | undefined;
        let status = v?.status;
        let submitError: string | null = null;
        if (publish && v && !live) {
          const sub = await withAuth(() => api.POST("/vacancies/{vacancy}/submit", { params: { path: { vacancy: v.id } } }));
          // Saved but not sent (e.g. an unconfirmed account): say so instead of a quiet "draft saved".
          if (!sub.response.ok) submitError = errorText(t, apiError(sub));
          status = (sub.data?.data as Detail | undefined)?.status ?? status;
        }
        void qc.invalidateQueries({ queryKey: ["company-vacancies", company.id] });
        void qc.invalidateQueries({ queryKey: ["vacancy", existing?.id] });
        if (submitError) toast({ tone: "error", title: submitError, body: t("vacancyEditor.keptAsDraft") });
        else toast({ tone: "success", title: status === "published" ? t("employer.published") : status === "moderation" ? t("employer.sentToModeration") : t("employer.draftSaved") });
        navigate(localizedPath(locale, "/employer"), { state: { allowLeave: true } });
      },
    );
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save(true);
  };

  const region = regions.find((r) => r.id === f.region_id);
  const categoryGroups = useMemo(() => categories.map((c) => ({
    label: nameOf(c.name, locale),
    options: (c.children?.length ? c.children : [c]).map((ch) => ({ value: String(ch.id), label: nameOf(ch.name, locale) })),
  })), [categories, locale]);
  const regionOptions = useMemo(() => regions.map((r) => ({ value: String(r.id), label: nameOf(r.name, locale) })), [regions, locale]);
  const choice = <K extends keyof typeof ENUMS>(k: K) =>
    ENUMS[k].map((v) => ({ value: v as VInput[K] & string, label: t(`enums.${k}.${v}`) }));

  const skills = f.skills ?? [];
  const next = STEPS[at + 1];

  return (
    <form onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate>
      <PageHeader
        breadcrumbs={<BackLink to="/employer">{t("account.dashboard")}</BackLink>}
        // Short words on purpose: the display face is wide, and "Редактирование" didn't fit 360px.
        title={existing ? t("vacancyEditor.editTitle") : t("nav.postVacancy")}
        description={existing ? (
          // What is being edited, and where it stands (the status is text, not just a colour).
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="min-w-0 break-words">{existing.title}</span>
            <Badge tone={STATUS_TONE[existing.status]}>{t(`vacancyStatus.${existing.status}`)}</Badge>
            {existing.status === "published" && (
              // A quiet link, not a full-width button: phones keep the form higher up.
              <LocalizedLink
                to={`/vacancies/${existing.slug}`}
                prefetch="intent"
                className="inline-flex items-center gap-1.5 font-medium text-lapis-ink underline-offset-3 hover:underline pointer-coarse:min-h-11"
              >
                {t("employer.viewPublic")}
                <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
              </LocalizedLink>
            )}
          </span>
        ) : t("employer.formHint")}
      />

      {existing?.status === "rejected" && (
        <Callout tone="danger" title={t("vacancyStatus.rejected")} className="mb-6">
          {existing.reject_reason || t("vacancyPage.ownerHint.rejected")}
        </Callout>
      )}
      {existing?.status === "moderation" && (
        <Callout tone="info" title={t("vacancyStatus.moderation")} className="mb-6">{t("vacancyPage.ownerHint.moderation")}</Callout>
      )}
      <FormError className="mb-4">{error}</FormError>

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label={t("vacancyEditor.sections")} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <Stepper steps={steps} current={step} onStepChange={(s) => goTo(s as EditorStep)} orientation="responsive" className="-mx-1" />
          <div className="mt-6 hidden border-t border-line pt-5 lg:block">
            <Progress value={ready.percent} label={t("vacancyEditor.readiness")} tone={ready.percent === 100 ? "firuza" : "lapis"} size="sm" showValue />
            <p className="mt-2 text-sm text-ink-2">
              {ready.missingRequired ? t("vacancyEditor.requiredLeft", { count: ready.missingRequired }) : t("vacancyEditor.readyShort")}
            </p>
            {!verified && (
              <p className="mt-4 flex gap-2 text-sm text-ink-2">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-zafaron" />
                {t("employer.moderationNote")}
              </p>
            )}
          </div>
        </nav>

        <div ref={stepRef} id="vacancy-step" className="min-w-0">
          {step === "preview" ? (
            <section aria-labelledby="step-title" key={step} className="anim-fade flex flex-col gap-6">
              <StepHeading step={step} at={at} />
              <Readiness data={ready} onGo={(s) => goTo(s)} />
              {!verified && (
                <Callout tone={live ? "warning" : "info"}>{live ? t("vacancyEditor.moderationLive") : t("vacancyEditor.moderationNew")}</Callout>
              )}
              <VacancyPreview f={deferred} company={company} />
              <div>
                <Button type="button" variant="ghost" icon={<ArrowLeft className="size-4.5" />} onClick={() => goTo(STEPS[at - 1])} className="-ml-2">
                  {t("vacancyEditor.backTo", { step: t(`vacancyEditor.steps.${STEPS[at - 1]}`) })}
                </Button>
              </div>
            </section>
          ) : (
            <Card as="section" radius="sheet" padding="lg" aria-labelledby="step-title" key={step} className="@container anim-fade">
              <StepHeading step={step} at={at} />
              <div className="mt-6 flex flex-col gap-6">
                {step === "basics" && (
                  <>
                    <Field label={t("employer.vacancyTitle")} hint={t("employer.vacancyTitleHint")} error={err("title")}>
                      <Input
                        id="f-title"
                        value={f.title}
                        onChange={(e) => set("title", e.target.value)}
                        onBlur={() => touch("title")}
                        maxLength={LIMITS.titleMax}
                        autoComplete="off"
                        enterKeyHint="next"
                      />
                    </Field>
                    <Field label={t("jobs.filters.category")} error={err("category_id")}>
                      <Select
                        id="f-category"
                        value={f.category_id ? String(f.category_id) : ""}
                        placeholder={t("resume.choose")}
                        onValueChange={(v) => set("category_id", Number(v))}
                        groups={categoryGroups}
                      />
                    </Field>
                    <div className="grid gap-6 @lg:grid-cols-2">
                      <Field label={t("jobs.filters.region")} error={err("region_id")}>
                        <Select
                          id="f-region"
                          value={f.region_id ? String(f.region_id) : ""}
                          placeholder={t("resume.choose")}
                          onValueChange={(v) => setF((s) => ({ ...s, region_id: Number(v), district_id: undefined }))}
                          options={regionOptions}
                        />
                      </Field>
                      {(region?.children?.length ?? 0) > 0 && (
                        <Field label={t("employer.district")} optional={t("common.optional")} error={err("district_id")}>
                          <Select
                            value={String(f.district_id ?? "")}
                            placeholder={t("resume.choose")}
                            onValueChange={(v) => set("district_id", v ? Number(v) : undefined)}
                            options={region!.children!.map((d) => ({ value: String(d.id), label: nameOf(d.name, locale) }))}
                          />
                        </Field>
                      )}
                    </div>
                    <Field label={t("jobs.address")} optional={t("common.optional")} error={err("address")}>
                      <Input
                        value={f.address ?? ""}
                        onChange={(e) => set("address", e.target.value)}
                        maxLength={LIMITS.address}
                        placeholder={t("employer.addressPlaceholder")}
                        autoComplete="street-address"
                        enterKeyHint="next"
                      />
                    </Field>
                  </>
                )}

                {step === "conditions" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <SalaryRange
                        legend={t("vacancyEditor.salary")}
                        from={f.salary_min ?? null}
                        to={f.salary_max ?? null}
                        onChange={({ from, to }) => setF((s) => ({ ...s, salary_min: from ?? undefined, salary_max: to ?? undefined }))}
                        currency={f.currency ?? "UZS"}
                        onCurrencyChange={(c) => set("currency", c)}
                        error={fields.salary_max ?? fields.salary_min ?? fields.currency}
                      />
                      <p className="text-sm text-ink-2">{t("employer.salaryHint")}</p>
                    </div>
                    <ChoiceChips name="work_format" label={t("jobs.filters.format")} value={f.work_format} options={choice("work_format")} onChange={(v) => set("work_format", v)} />
                    <ChoiceChips name="employment_type" label={t("jobs.filters.employment")} value={f.employment_type} options={choice("employment_type")} onChange={(v) => set("employment_type", v)} />
                    <ChoiceChips name="experience" label={t("jobs.filters.experience")} value={f.experience} options={choice("experience")} onChange={(v) => set("experience", v)} />
                    <ChoiceChips name="schedule" label={t("jobs.filters.schedule")} value={f.schedule} options={choice("schedule")} onChange={(v) => set("schedule", v)} />
                  </>
                )}

                {step === "description" && (
                  <DescriptionEditor
                    value={f.description}
                    onChange={(v) => set("description", v)}
                    onBlur={() => touch("description")}
                    error={err("description")}
                  />
                )}

                {step === "skills" && (
                  <Field
                    label={t("jobs.skills")}
                    optional={t("common.optional")}
                    hint={t("vacancyEditor.skillsHint", { n: skills.length, max: LIMITS.skills })}
                    error={err("skills")}
                  >
                    <TagInput
                      id="f-skills"
                      value={skills}
                      onChange={(v) => set("skills", v)}
                      max={LIMITS.skills}
                      placeholder={t("resume.skillsPlaceholder")}
                      label={t("jobs.skills")}
                    />
                  </Field>
                )}
              </div>

              <CardFooter className={at > 0 ? "mt-8 justify-between" : "mt-8"}>
                {at > 0 && (
                  <Button type="button" variant="ghost" icon={<ArrowLeft className="size-4.5" />} onClick={() => goTo(STEPS[at - 1])} className="-ml-2">
                    {t("common.back")}
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={() => goTo(next)}>
                  {/* Phones: just "Next"; the stepper above names every step. */}
                  <span className="max-sm:hidden">{t("vacancyEditor.nextTo", { step: t(`vacancyEditor.steps.${next}`) })}</span>
                  <span className="sm:hidden">{t("states.next")}</span>
                  <ArrowRight aria-hidden="true" className="size-4.5" />
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Floating save bar: always within thumb reach; labels follow the bar's own width. */}
          <div className="@container sticky bottom-above-tabbar z-40 mt-6">
            <div className="glass-chrome flex items-center justify-end gap-2 rounded-sheet p-2">
              <p role="status" className="flex min-w-0 flex-1 items-center gap-2 px-2 text-sm text-ink-2 @max-lg:sr-only">
                {dirty ? (
                  <>
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-zafaron" />
                    <span className="truncate">{t("vacancyEditor.unsaved")}</span>
                  </>
                ) : (
                  <span className="num truncate">{t("vacancyEditor.stepOf", { n: at + 1, total: STEPS.length })}</span>
                )}
              </p>
              {!live && (
                <Button type="button" variant="ghost" loading={pending && !publishing} disabled={pending} onClick={() => save(false)}>
                  <span className="@max-lg:sr-only">{t("employer.saveDraft")}</span>
                  <span aria-hidden="true" className="@lg:hidden">{t("vacancyEditor.draftShort")}</span>
                </Button>
              )}
              {/* Phones: the main action takes the rest of the row, like a native bottom CTA. */}
              <Button type="submit" loading={pending && publishing} disabled={pending} className="max-md:flex-1">
                {live ? t("common.save") : t("employer.publish")}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {guard}
    </form>
  );
}

function StepHeading({ step, at }: { step: EditorStep; at: number }) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0">
      <p className="num text-sm font-medium text-ink-2">{t("vacancyEditor.stepOf", { n: at + 1, total: STEPS.length })}</p>
      <h2
        id="step-title"
        data-step-heading=""
        tabIndex={-1}
        className="mt-1 break-words font-display text-xl font-semibold tracking-heading text-ink outline-none" // jv-ui-ignore: programmatic focus target after a step change, not a control
      >
        {t(`vacancyEditor.steps.${step}`)}
      </h2>
      <p className="mt-1.5 max-w-2xl text-md text-ink-2">{t(`vacancyEditor.stepHints.${step}`)}</p>
    </div>
  );
}

/** Same geometry as the editor (header, stepper, step card), so nothing jumps when it arrives. */
function EditorSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true">
        <div className="mb-6 flex flex-col gap-3 md:mb-8">
          <Skeleton className="h-5 w-24" />
          {/* The H1 wraps to two lines on phones. */}
          <Skeleton className="h-8 w-64 max-w-full md:h-10" />
          <Skeleton className="h-8 w-44 sm:hidden" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="flex gap-2 overflow-hidden lg:flex-col">
            {[0, 1, 2, 3, 4].map((i) => (
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
