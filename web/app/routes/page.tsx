import {
  ArrowRight, CalendarClock, Check, ChevronDown, Copy, HeartHandshake, Languages, Mail, MessageCircleQuestion, Send,
  ShieldAlert, TableOfContents,
} from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { data } from "react-router";

import type { Route } from "./+types/page";
import { getPage, SLUGS, type Slug } from "~/shared/content/pages.server";
import { htmlLang, localeFromPath, type Locale } from "~/shared/i18n/config";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { monthNames } from "~/shared/lib/format";
import { seo } from "~/shared/seo/seo";
import { Breadcrumbs } from "~/shared/ui/Breadcrumbs";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { toast } from "~/shared/ui/toast-store";

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const slug = url.pathname.split("/").pop() as Slug;
  if (!SLUGS.includes(slug)) throw data(null, { status: 404 });
  return { page: getPage(slug, localeFromPath(url.pathname)), slug };
}

export function meta({ loaderData, location }: Route.MetaArgs) {
  if (!loaderData) return [];
  return seo({ title: `${loaderData.page.title} | Job Vacancy`, description: loaderData.page.lead, path: location.pathname });
}

type Page = Route.ComponentProps["loaderData"]["page"];
type Section = Page["sections"][number];

// Legal texts are read section by section, so they get a table of contents.
const WITH_TOC: readonly Slug[] = ["privacy", "terms"];

/** "24-sentabr 2026" / "24 сентября 2026 г." / "September 24, 2026" from "2026-09-24" (no time zone drift). */
function longDate(ymd: string, locale: Locale): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (locale === "uz" || locale === "uz-Cyrl") return `${d}-${monthNames(locale, "long")[m - 1]} ${y}`;
  return new Intl.DateTimeFormat(htmlLang[locale], { dateStyle: "long", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function StaticPage({ loaderData }: Route.ComponentProps) {
  const { page, slug } = loaderData;
  const toc = WITH_TOC.includes(slug);
  return (
    <div className="relative isolate">
      {/* Brand light under the (clear at rest) header, fading out before the text. */}
      <div
        aria-hidden="true"
        className="aurora-hero aurora-fade pointer-events-none absolute inset-x-0 -top-(--header-h) -z-10 h-96"
      />
      {toc ? <LegalLayout page={page} /> : (
        <article className="container-prose pb-16 pt-6 md:pb-24 md:pt-10">
          <Intro page={page} />
          {slug === "about" ? <AboutBody page={page} /> : slug === "contacts" ? <ContactsBody page={page} /> : <Prose sections={page.sections} />}
        </article>
      )}
    </div>
  );
}

function Intro({ page }: { page: Page }) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <header className="mb-8">
      <Breadcrumbs items={[{ label: t("shell.palette.home"), to: "/" }, { label: page.title }]} className="mb-4" />
      {/* hyphens: one-word titles like «конфиденциальности» are wider than a phone. */}
      <h1 className="break-words font-display text-2xl font-semibold tracking-heading text-ink hyphens-auto md:text-3xl">{page.title}</h1>
      <p className="mt-3 max-w-2xl text-lead text-ink-2">{page.lead}</p>
      {page.updated && (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-2">
          <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
          <time dateTime={page.updated}>{t("staticPage.updated", { date: longDate(page.updated, locale) })}</time>
        </p>
      )}
    </header>
  );
}

/* ---- legal pages: sticky table of contents (desktop) + collapsible one (phones) -------------- */

function LegalLayout({ page }: { page: Page }) {
  const { t } = useTranslation();
  const ids = page.sections.map((s) => s.id);
  const [active, hold] = useActiveSection(ids);
  const jump = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    const ms = jumpTo(e, id);
    if (ms !== false) hold(id, ms);
  };
  return (
    <div className="container-page pb-16 pt-6 md:pb-24 md:pt-10">
      <div className="mx-auto grid max-w-4xl lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <article className="min-w-0">
          <Intro page={page} />
          <Card padding="none" className="mb-8 lg:hidden">
            <details className="disclosure group">
              <summary className="flex min-h-14 cursor-pointer items-center gap-3 rounded-panel px-5 py-3 text-md font-semibold text-ink focus-visible:-outline-offset-2">
                <TableOfContents aria-hidden="true" className="size-5 shrink-0 text-lapis" />
                <span className="min-w-0 flex-1">{t("staticPage.toc")}</span>
                <span className="num text-sm font-normal text-ink-2">{t("staticPage.sections", { count: ids.length })}</span>
                <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-ink-2 transition-transform duration-300 ease-spring group-open:rotate-180" />
              </summary>
              <nav aria-label={t("staticPage.onThisPage")} className="px-5 pb-5">
                <TocList sections={page.sections} onJump={jump} />
              </nav>
            </details>
          </Card>
          <Prose sections={page.sections} numbered />
          <QuestionsCard />
        </article>
        {/* After the article in the DOM (read after the H1), first column on screen. */}
        <div className="max-lg:hidden lg:sticky lg:top-24 lg:order-first lg:self-start">
          <nav aria-label={t("staticPage.onThisPage")}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-caps text-ink-2">{t("staticPage.onThisPage")}</p>
            <TocList sections={page.sections} active={active} onJump={jump} dense />
          </nav>
        </div>
      </div>
    </div>
  );
}

function TocList({ sections, active, onJump, dense }: {
  sections: Section[];
  active?: string;
  onJump: (e: MouseEvent<HTMLAnchorElement>, id: string) => void;
  /** Desktop sidebar: smaller rows (still 44px on touch screens). */
  dense?: boolean;
}) {
  return (
    <ol className="border-l border-line">
      {sections.map((s, i) => {
        const on = s.id === active;
        return (
          <li key={s.id}>
            {/* Real #anchors: they work before hydration and open in a new tab as expected. */}
            <a
              href={`#${s.id}`}
              onClick={(e) => onJump(e, s.id)}
              aria-current={on ? "true" : undefined}
              className={cn(
                // Colour-only change for the current item: no reflow while the reader scrolls.
                "-ml-px flex items-baseline gap-3 border-l-2 pl-4 pr-2 transition-colors duration-150",
                dense ? "min-h-10 py-2 text-sm pointer-coarse:min-h-11" : "min-h-11 py-2.5 text-md",
                on ? "border-lapis text-ink" : "border-transparent text-ink-2 hover:border-line-strong hover:text-ink",
              )}
            >
              <span aria-hidden="true" className={cn("num text-xs", on ? "text-lapis-ink" : "text-ink-3")}>{pad(i + 1)}</span>
              <span className="min-w-0 break-words">{s.h}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Smooth in-page jump (instant under reduced motion). The heading's scroll-margin-top (app.css)
 * lands it below the sticky header; focus follows so keyboard and screen-reader users continue
 * from the section. Returns how long the scroll-spy should keep the clicked item, or false for
 * modified clicks (new tab etc.), which the browser handles itself.
 */
function jumpTo(e: MouseEvent<HTMLAnchorElement>, id: string): number | false {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const target = document.getElementById(id);
  if (!target) return false;
  e.preventDefault();
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  // A shareable #hash without a history entry per click; React Router's state object is kept.
  window.history.replaceState(window.history.state, "", `#${id}`);
  target.focus({ preventScroll: true });
  // A smooth scroll passes other headings on its way; an instant jump needs no hold.
  return smooth ? 900 : 0;
}

/**
 * Scroll-spy for the desktop TOC: the current section is the last heading that has passed the
 * upper 40% of the viewport. IntersectionObserver fires only when a heading crosses that line,
 * so nothing runs per scroll frame. After a TOC click the clicked item wins until the smooth
 * scroll has passed the headings in between, then the spy re-checks where the page stopped.
 */
function useActiveSection(ids: string[]): [string | undefined, (id: string, ms: number) => void] {
  const [active, setActive] = useState<string>();
  const holdUntil = useRef(0);
  const repick = useRef<() => void>(() => {});
  const timer = useRef(0);
  const key = ids.join(" ");
  useEffect(() => {
    const els = key.split(" ").map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length || !("IntersectionObserver" in window)) return;
    const pick = () => {
      if (Date.now() < holdUntil.current) return;
      const line = window.innerHeight * 0.4;
      let current = els[0].id;
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id;
      setActive(current);
    };
    repick.current = pick;
    const io = new IntersectionObserver(pick, { rootMargin: "0px 0px -60% 0px" });
    for (const el of els) io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer.current);
    };
  }, [key]);
  const hold = (id: string, ms: number) => {
    setActive(id);
    holdUntil.current = Date.now() + ms;
    // Crossings during the hold were skipped: settle on where the page actually ended up.
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => repick.current(), ms + 50);
  };
  return [active, hold];
}

/* ---- content ------------------------------------------------------------------------------ */

function Prose({ sections, numbered }: { sections: Section[]; numbered?: boolean }) {
  return (
    <div className="divide-y divide-line">
      {sections.map((s, i) => (
        <section key={s.id} aria-labelledby={s.id} className="py-8 first:pt-0 md:py-10">
          {/* tabIndex -1: the TOC moves focus here after the jump. */}
          <h2
            id={s.id}
            tabIndex={-1}
            // One step below the H1 on every width: long legal headings stay calm next to the text.
            className="flex items-baseline gap-3 break-words font-display text-xl font-semibold tracking-heading text-ink"
          >
            {numbered && <span aria-hidden="true" className="num text-lapis-ink">{pad(i + 1)}</span>}
            <span className="min-w-0">{s.h}</span>
          </h2>
          <div className="rich-text mt-4">
            {s.p.map((p) => <p key={p}>{linkEmails(p)}</p>)}
          </div>
        </section>
      ))}
    </div>
  );
}

const EMAIL_RE = /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/;

/** Addresses in the text become mailto links (the wording itself stays as written). */
function linkEmails(text: string): ReactNode {
  const parts = text.split(EMAIL_RE);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (i % 2 ? <a key={i} href={`mailto:${part}`}>{part}</a> : part));
}

/** Icon tile of the design system (lapis unless the section is a warning). */
function Tile({ children, tone = "lapis" }: { children: ReactNode; tone?: "lapis" | "zafaron" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-control [&_svg]:size-5",
        tone === "lapis" ? "bg-lapis-soft text-lapis" : "bg-zafaron-soft text-zafaron-ink",
      )}
    >
      {children}
    </span>
  );
}

function QuestionsCard() {
  const { t } = useTranslation();
  return (
    <Card as="aside" aria-labelledby="static-questions" className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
      <Tile><MessageCircleQuestion /></Tile>
      <div className="min-w-0 flex-1">
        <h2 id="static-questions" className="text-lead font-semibold tracking-snug text-ink">{t("staticPage.questionsTitle")}</h2>
        <p className="mt-1 text-md text-ink-2">{t("staticPage.questionsBody")}</p>
      </div>
      <Button asChild variant="secondary" className="max-sm:w-full">
        <LocalizedLink to="/contacts" prefetch="intent">
          {t("staticPage.contactUs")}
          <ArrowRight aria-hidden="true" className="size-4" />
        </LocalizedLink>
      </Button>
    </Card>
  );
}

const ABOUT_ICONS: Record<string, ReactNode> = { why: <HeartHandshake />, "how-it-works": <Languages /> };

function AboutBody({ page }: { page: Page }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {page.sections.map((s) => (
          <Card as="section" key={s.id} aria-labelledby={s.id}>
            {ABOUT_ICONS[s.id] && <Tile>{ABOUT_ICONS[s.id]}</Tile>}
            <h2 id={s.id} className="mt-4 break-words text-lead font-semibold tracking-snug text-ink first:mt-0">{s.h}</h2>
            <div className="mt-2 flex flex-col gap-3 text-md text-ink-2">
              {s.p.map((p) => <p key={p}>{p}</p>)}
            </div>
          </Card>
        ))}
      </div>
      {/* Closing band on the brand light, like the other marketing pages. */}
      <Card as="aside" aria-labelledby="about-cta" radius="sheet" padding="none" className="relative isolate mt-6 overflow-hidden px-5 py-10 text-center sm:px-8 md:py-12">
        <div aria-hidden="true" className="aurora-hero pointer-events-none absolute inset-0 -z-10" />
        <h2 id="about-cta" className="mx-auto max-w-xl break-words font-display text-xl font-semibold tracking-heading text-ink md:text-2xl">
          {t("staticPage.aboutCtaTitle")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-md text-ink-2 md:text-base">{t("staticPage.aboutCtaBody")}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild shape="pill">
            <LocalizedLink to="/vacancies" prefetch="intent">{t("shell.footer.allVacancies")}</LocalizedLink>
          </Button>
          <Button asChild variant="secondary" shape="pill">
            <LocalizedLink to="/employers" prefetch="intent">{t("nav.forEmployers")}</LocalizedLink>
          </Button>
        </div>
      </Card>
    </>
  );
}

function ContactsBody({ page }: { page: Page }) {
  const email = page.sections.find((s) => s.id === "email");
  const address = email?.p[0] ?? "";
  return (
    <div className="flex flex-col gap-4">
      {page.sections.map((s) =>
        s.id === "email" ? <EmailCard key={s.id} section={s} /> : (
          <Card as="section" key={s.id} aria-labelledby={s.id} className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Tile tone={s.id === "report-a-scam" ? "zafaron" : "lapis"}>{s.id === "report-a-scam" ? <ShieldAlert /> : <Mail />}</Tile>
            <div className="min-w-0 flex-1">
              <h2 id={s.id} className="break-words text-lead font-semibold tracking-snug text-ink">{s.h}</h2>
              <div className="mt-1.5 flex flex-col gap-3 text-md text-ink-2">
                {s.p.map((p) => <p key={p}>{p}</p>)}
              </div>
              {s.id === "report-a-scam" && address && <ReportButton address={address} subject={s.h} />}
            </div>
          </Card>
        ),
      )}
    </div>
  );
}

function ReportButton({ address, subject }: { address: string; subject: string }) {
  const { t } = useTranslation();
  return (
    <Button asChild variant="secondary" icon={<Send className="size-4" />} className="mt-4 max-sm:w-full">
      <a href={`mailto:${address}?subject=${encodeURIComponent(subject)}`}>{t("staticPage.sendLink")}</a>
    </Button>
  );
}

function EmailCard({ section }: { section: Section }) {
  const { t } = useTranslation();
  const address = section.p[0] ?? "";
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast({ tone: "success", title: t("staticPage.copied") });
    } catch {
      toast({ tone: "error", title: t("staticPage.copyFailed") });
    }
  };
  return (
    <Card as="section" aria-labelledby={section.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Tile><Mail /></Tile>
      <div className="min-w-0 flex-1">
        <h2 id={section.id} className="text-sm font-medium text-ink-2">{section.h}</h2>
        <a
          href={`mailto:${address}`}
          className="mt-0.5 inline-flex min-h-11 max-w-full items-center break-words font-display text-lg font-semibold tracking-heading text-lapis-ink underline-offset-4 hover:underline"
        >
          {address}
        </a>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={() => void copy()}
        icon={copied ? <Check className="size-4 text-firuza-ink" /> : <Copy className="size-4" />}
        className="max-sm:w-full"
      >
        {t("staticPage.copy")}
      </Button>
    </Card>
  );
}
