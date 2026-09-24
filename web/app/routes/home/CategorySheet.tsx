import { ChevronRight } from "lucide-react";

import { nameOf, useCatalog } from "~/shared/catalog/catalog";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { DialogRoot, SheetContent } from "~/shared/ui/Dialog";
import { categoryIcon } from "./category-icons";

/** Every catalog category with its sub-directions (bottom sheet on phones, side panel from md). */
export default function CategorySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={t("homePage.categories.sheetTitle")}
        description={t("homePage.categories.sheetBody")}
        closeLabel={t("common.close")}
      >
        <ul className="-mx-2 divide-y divide-line">
          {catalog.categories.map((c) => {
            const Icon = categoryIcon(c.icon);
            const subs = c.children ?? [];
            return (
              <li key={c.id} className="py-1.5">
                <LocalizedLink
                  to={`/vacancies?category_id=${c.id}`}
                  className="flex min-h-12 items-center gap-3 rounded-control px-2 transition-colors hover:bg-sunken"
                >
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-control bg-lapis-soft text-lapis-ink">
                    <Icon className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1 break-words text-md font-semibold text-ink">{nameOf(c.name, locale)}</span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
                </LocalizedLink>
                {subs.length > 0 && (
                  <ul aria-label={nameOf(c.name, locale)} className="flex flex-wrap gap-1.5 pb-2 pl-14 pr-2">
                    {subs.map((s) => (
                      <li key={s.id}>
                        <LocalizedLink
                          to={`/vacancies?category_id=${s.id}`}
                          className="inline-flex h-9 items-center rounded-pill bg-sunken px-3 text-sm text-ink-2 transition-colors hover:bg-lapis-soft hover:text-lapis-ink pointer-coarse:h-11"
                        >
                          {nameOf(s.name, locale)}
                        </LocalizedLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </DialogRoot>
  );
}
