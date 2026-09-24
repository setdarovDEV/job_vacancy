import { LayoutGrid } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { nameOf, useCatalog, type Category } from "~/shared/catalog/catalog";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { groupDigits } from "~/shared/lib/format";
import { useSpotlight } from "~/shared/lib/spotlight";
import { Card, CardLink } from "~/shared/ui/Card";
import { categoryIcon } from "./category-icons";
import { band, est, SectionHead } from "./SectionHead";

// The sheet (Radix Dialog) loads on the first press, warmed up on hover/focus of the button.
const loadSheet = () => import("./CategorySheet");
const CategorySheet = lazy(loadSheet);

const href = (c: Category) => `/vacancies?category_id=${c.id}`;

/**
 * Category bento: the first catalog category as a large tile with its sub-directions, eleven
 * uniform tiles (seven on phones) and an "All categories" tile that opens the full list in a
 * sheet. Rows are always full: 2 columns on phones, 4 from md. No counts: the API has none.
 */
export function Categories() {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const list = useSpotlight<HTMLUListElement>();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [lead, ...rest] = catalog.categories;
  if (!lead) return null; // catalog unavailable: the section steps aside rather than leaving a gap
  const LeadIcon = categoryIcon(lead.icon);
  const subs = lead.children ?? [];

  return (
    <section aria-labelledby="home-categories" className={band} style={est(60)}>
      <SectionHead id="home-categories" title={t("homePage.categories.title")} description={t("homePage.categories.body")} />
      <ul ref={list} className="mt-6 grid grid-cols-2 gap-3 md:mt-8 md:grid-cols-4">
        <li className="col-span-2 md:row-span-2">
          <Card interactive padding="none" className="spotlight flex h-full flex-col gap-4 p-4 md:p-6">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-control bg-lapis text-on-lapis shadow-2">
                <LeadIcon className="size-6" />
              </span>
              <div className="min-w-0">
                <h3 className="break-words font-display text-lead font-semibold tracking-heading text-ink sm:text-lg">
                  <CardLink to={href(lead)} prefetch="intent">{nameOf(lead.name, locale)}</CardLink>
                </h3>
                {subs.length > 0 && (
                  <p className="num text-md text-ink-2">
                    {t("homePage.categories.directions", { count: subs.length, n: groupDigits(subs.length) })}
                  </p>
                )}
              </div>
            </div>
            {subs.length > 0 && (
              // Above the stretched link, so each sub-direction is its own target. Four below lg,
              // six on the wide lead tile from lg, so it stays as tall as the two rows beside it.
              <ul className="relative z-10 mt-auto flex flex-wrap gap-2">
                {subs.slice(0, 6).map((s, i) => (
                  <li key={s.id} className={i >= 4 ? "hidden lg:block" : undefined}>
                    <LocalizedLink
                      to={href(s)}
                      prefetch="intent"
                      className="inline-flex h-9 items-center rounded-pill bg-sunken px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-lapis-soft hover:text-lapis-ink pointer-coarse:h-11"
                    >
                      {nameOf(s.name, locale)}
                    </LocalizedLink>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </li>
        {rest.slice(0, 11).map((c, i) => {
          const Icon = categoryIcon(c.icon);
          return (
            <li key={c.id} className={i >= 7 ? "hidden md:block" : undefined}>
              <Card
                as={LocalizedLink}
                to={href(c)}
                prefetch="intent"
                interactive
                padding="sm"
                className="spotlight flex h-full min-h-28 flex-col justify-between gap-3"
              >
                <span aria-hidden="true" className="grid size-10 place-items-center rounded-control bg-lapis-soft text-lapis-ink">
                  <Icon className="size-5" />
                </span>
                <span className="line-clamp-2 break-words text-md font-semibold text-ink">{nameOf(c.name, locale)}</span>
              </Card>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            aria-haspopup="dialog"
            onPointerEnter={() => void loadSheet()}
            onFocus={() => void loadSheet()}
            onClick={() => {
              setMounted(true);
              setOpen(true);
            }}
            className="flex h-full min-h-28 w-full flex-col justify-between gap-3 rounded-panel bg-lapis-soft p-4 text-left transition-transform duration-200 ease-spring hover:shadow-2 active:scale-[0.98]"
          >
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-control bg-surface text-lapis-ink shadow-1">
              <LayoutGrid className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-md font-semibold text-lapis-ink">{t("homePage.categories.all")}</span>
              <span className="num block text-sm text-ink-2">
                {t("homePage.categories.count", { count: catalog.categories.length, n: groupDigits(catalog.categories.length) })}
              </span>
            </span>
          </button>
        </li>
      </ul>
      {mounted && (
        <Suspense fallback={null}>
          <CategorySheet open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </section>
  );
}
