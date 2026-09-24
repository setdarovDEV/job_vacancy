import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, Building2, CircleAlert, Send, ShieldCheck } from "lucide-react";
import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

import { useMyCompany } from "./company-hook";
import { api, dataOf, type Schemas } from "~/shared/api/client";
import { withAuth } from "~/shared/auth/session";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { FormError } from "~/shared/forms/FormError";
import { useSubmit } from "~/shared/forms/useSubmit";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { salary } from "~/shared/lib/format";
import { authedPage } from "~/shared/query/query";
import { Button } from "~/shared/ui/Button";
import { DialogContent, DialogRoot } from "~/shared/ui/Dialog";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Field, Textarea } from "~/shared/ui/Field";
import { SelectableCard, SelectableCardGroup } from "~/shared/ui/SelectableCard";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";

type Vacancy = Schemas["VacancyCard"];

const MAX_MESSAGE = 2000;

/**
 * Invite a candidate to one of the current company's published vacancies: pick the vacancy
 * (ones in the candidate's field first), add an optional message, then a success state with a
 * drawn check and a link to the new application.
 */
export default function InviteDialog({
  open, onOpenChange, resumeId, name, resumeTitle, categoryId, onInvited,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  resumeId: string;
  /** Candidate's name, for the title. */
  name: string;
  /** Resume title, shown under the dialog title. */
  resumeTitle?: string;
  /** The resume's field: vacancies in it are listed first. */
  categoryId?: number | null;
  /** Called with the resume id once the invitation is sent. */
  onInvited?: (resumeId: string) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const qc = useQueryClient();
  const my = useMyCompany();
  const cid = my.company?.id;
  const vacancies = useQuery({
    // Own key under the ["company-vacancies", id] prefix: edits elsewhere refresh it, and it
    // never shares a cache entry with the dashboard's paged lists (different data shape).
    queryKey: ["company-vacancies", cid, "invite-options"],
    enabled: Boolean(cid),
    queryFn: () => authedPage<Vacancy>(() =>
      api.GET("/companies/{company}/vacancies", { params: { path: { company: cid! }, query: { status: "published", limit: 50 } } })),
  });

  // Vacancies in the candidate's field come first; the first one is preselected. The "same
  // field" note appears only when it tells the options apart.
  const options = useMemo(() => {
    const list = vacancies.data?.data ?? [];
    const match = (v: Vacancy) => categoryId != null && v.category_id === categoryId;
    const hits = list.filter(match);
    const telling = hits.length > 0 && hits.length < list.length;
    return [...hits, ...list.filter((v) => !match(v))].map((v) => ({ v, match: telling && match(v) }));
  }, [vacancies.data, categoryId]);

  const [picked, setPicked] = useState("");
  const chosen = options.some((o) => o.v.id === picked) ? picked : (options[0]?.v.id ?? "");
  const [message, setMessage] = useState("");
  const [taken, setTaken] = useState<ReadonlySet<string>>(() => new Set());
  const [done, setDone] = useState<{ applicationId?: string } | null>(null);
  const { pending, error, fields, run } = useSubmit();
  const skeleton = useSkeletonHold(my.isPending || (Boolean(cid) && vacancies.isPending));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const vacancyId = chosen;
    void run(
      () => withAuth(() => api.POST("/resumes/{resume}/invite", {
        params: { path: { resume: resumeId } },
        body: { vacancy_id: vacancyId, message: message.trim() || undefined },
      })),
      (res) => {
        setDone({ applicationId: dataOf<Schemas["Application"]>(res)?.id });
        onInvited?.(resumeId);
        // The kanban, its counts and the dashboard's application totals now include this one.
        void qc.invalidateQueries({ queryKey: ["applications", vacancyId] });
        void qc.invalidateQueries({ queryKey: ["application-stats", vacancyId] });
        void qc.invalidateQueries({ queryKey: ["company-vacancies", cid] });
      },
      (err) => {
        // The candidate already applied (or was invited) there: say so next to the choice.
        if (err.code !== "already_applied") return false;
        setTaken((s) => new Set(s).add(vacancyId));
        return true;
      },
    );
  };

  const close = () => onOpenChange(false);
  const cancel = <Button type="button" variant="ghost" onClick={close}>{t("common.cancel")}</Button>;
  const conflict = taken.has(chosen);
  const vacancyError = conflict ? t("candidatesPage.alreadyApplied") : fields.vacancy_id;

  let body: ReactNode;
  let footer: ReactNode = null;
  if (done) {
    body = <Success title={t("candidates.invited")} text={t("candidates.invitedBody")} />;
    footer = (
      <>
        <Button type="button" variant="secondary" onClick={close}>{t("common.close")}</Button>
        {done.applicationId && (
          <Button asChild>
            <LocalizedLink to={`/employer/applications/${done.applicationId}`} prefetch="intent">{t("candidatesPage.openApplication")}</LocalizedLink>
          </Button>
        )}
      </>
    );
  } else if (my.isError) {
    body = <ErrorState error={my.error} onRetry={() => my.refetch()} headingAs="p" />;
    footer = cancel;
  } else if (skeleton) {
    body = <FormSkeleton />;
  } else if (!my.company) {
    body = <EmptyState size="sm" headingAs="p" icon={<Building2 />} title={t("candidatesPage.noCompanyTitle")} body={t("employer.noCompany")} />;
    footer = (
      <>
        {cancel}
        <Button asChild><LocalizedLink to="/employer/company">{t("employer.createCompany")}</LocalizedLink></Button>
      </>
    );
  } else if (vacancies.isError) {
    body = <ErrorState error={vacancies.error} onRetry={() => vacancies.refetch()} headingAs="p" />;
    footer = cancel;
  } else if (options.length === 0) {
    body = (
      <EmptyState size="sm" headingAs="p" icon={<BriefcaseBusiness />} title={t("candidatesPage.noPublishedTitle")} body={t("candidates.noPublished")} />
    );
    footer = (
      <>
        {cancel}
        <Button asChild><LocalizedLink to="/employer/vacancies/new">{t("nav.postVacancy")}</LocalizedLink></Button>
      </>
    );
  } else {
    body = (
      <form id="invite-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <FormError>{error}</FormError>
        <div>
          <p className="mb-2 text-sm font-medium text-ink">{t("candidatesPage.chooseVacancy")}</p>
          <SelectableCardGroup
            value={chosen}
            onValueChange={setPicked}
            label={t("candidatesPage.chooseVacancy")}
            aria-describedby={vacancyError ? "invite-vacancy-error" : undefined}
          >
            {options.map(({ v, match }) => {
              const region = nameOf(idx.regions.get(v.region_id)?.name, locale);
              return (
                <SelectableCard
                  key={v.id}
                  value={v.id}
                  icon={<BriefcaseBusiness />}
                  title={v.title}
                  description={
                    <>
                      {match && <span className="font-medium text-lapis-ink">{t("candidatesPage.matchesField")} · </span>}
                      {region && `${region} · `}
                      {/* "12–20 mln so'm" must not break after the dash. */}
                      <span className="whitespace-nowrap">{salary(v.salary, t, locale)}</span>
                    </>
                  }
                />
              );
            })}
          </SelectableCardGroup>
          {vacancyError && (
            <p id="invite-vacancy-error" role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-anor-ink">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {vacancyError}
            </p>
          )}
        </div>
        <Field label={t("candidates.message")} optional={t("common.optional")} hint={t("candidates.messageHint")} error={fields.message}>
          <Textarea
            rows={4}
            maxLength={MAX_MESSAGE}
            value={message}
            placeholder={t("candidatesPage.messagePlaceholder")}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
        <p className="flex items-start gap-2 text-sm text-ink-2">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-firuza" />
          {t("candidatesPage.inviteNote")}
        </p>
      </form>
    );
    footer = (
      <>
        {cancel}
        <Button type="submit" form="invite-form" loading={pending} disabled={!chosen || conflict} icon={<Send className="size-4.5" />}>
          {t("candidates.sendInvite")}
        </Button>
      </>
    );
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t("candidates.inviteTitle", { name: name || resumeTitle || "" })}
        description={name ? resumeTitle : undefined}
        closeLabel={t("common.close")}
        dismissible={!pending}
        footer={footer}
      >
        {body}
      </DialogContent>
    </DialogRoot>
  );
}

/** Firuza check that draws itself: the circle first, then the tick. */
function Success({ title, text }: { title: string; text: string }) {
  return (
    // role=status: the result is read out when it replaces the form.
    <div role="status" className="flex flex-col items-center pb-2 pt-3 text-center">
      <span aria-hidden="true" className="anim-pop grid size-16 place-items-center rounded-full bg-firuza-soft text-firuza-ink" data-state="open">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-9">
          <circle cx="12" cy="12" r="9.5" className="anim-draw origin-center -rotate-90" style={{ "--len": 60 } as CSSProperties} />
          <path d="m7.75 12.25 3 3 5.5-6" className="anim-draw" style={{ "--len": 13, animationDelay: "300ms" } as CSSProperties} />
        </svg>
      </span>
      <p className="mt-5 font-display text-xl font-semibold tracking-heading text-ink">{title}</p>
      <p className="mt-1.5 max-w-sm text-md text-ink-2">{text}</p>
    </div>
  );
}

/** Same shape as the form: the question, two vacancy cards, the message field, the note. */
function FormSkeleton() {
  const { t } = useTranslation();
  return (
    <SkeletonDelay>
      <div role="status" className="flex flex-col gap-5">
        <span className="sr-only">{t("common.loading")}</span>
        <div>
          <Skeleton className="mb-2 h-4 w-48" />
          <div className="grid gap-2">
            <Skeleton className="h-18 rounded-control" />
            <Skeleton className="h-18 rounded-control" />
          </div>
        </div>
        <div>
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="h-28 rounded-control" />
        </div>
        <Skeleton className="h-4 w-3/4" />
      </div>
    </SkeletonDelay>
  );
}
