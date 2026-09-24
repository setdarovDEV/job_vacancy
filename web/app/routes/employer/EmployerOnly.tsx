import { BadgeCheck, BriefcaseBusiness, ChevronsUpDown } from "lucide-react";

import { useMyCompany } from "./company-hook";
import { useSession } from "~/shared/auth/session";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { Avatar } from "~/shared/ui/Avatar";
import { Button, IconButton } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { EmptyState } from "~/shared/ui/EmptyState";
import { MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuRoot, MenuTrigger } from "~/shared/ui/Menu";

export function EmployerOnly({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useSession();
  if (user?.role === "employer" || user?.role === "admin") return <>{children}</>;
  return (
    <Card padding="none">
      <h1 className="sr-only">{t("dashboardPage.employerArea")}</h1>
      <EmptyState
        icon={<BriefcaseBusiness />}
        headingAs="h2"
        title={t("apiErrors.employer_only")}
        body={t("dashboardPage.employerOnlyBody")}
        action={<Button asChild variant="secondary"><LocalizedLink to="/employers" prefetch="intent">{t("dashboardPage.forEmployers")}</LocalizedLink></Button>}
      />
    </Card>
  );
}

/**
 * Company switcher for people in several companies (renders nothing with one). The choice
 * applies to every employer page, so a new vacancy lands in the company picked here.
 */
export function CompanySwitcher({ className, disabled, compact }: {
  className?: string;
  disabled?: boolean;
  /** Icon-only trigger, for next to a title that already names the company. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { company, companies, selectCompany } = useMyCompany();
  if (!company || companies.length < 2) return null;
  // The compact trigger sits in a title that already names the company; don't repeat it.
  const label = compact ? t("dashboardPage.switchCompanyShort") : t("dashboardPage.switchCompany", { name: company.name });
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        {compact ? (
          <IconButton label={label} disabled={disabled} className={className}>
            <ChevronsUpDown className="size-5" />
          </IconButton>
        ) : (
          <Button variant="secondary" disabled={disabled} className={cn("min-w-0 max-w-full justify-start sm:max-w-64", className)} aria-label={label}>
            <Avatar name={company.name} src={company.logo_url} square size="xs" />
            <span className="min-w-0 flex-1 truncate text-start">{company.name}</span>
            <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
          </Button>
        )}
      </MenuTrigger>
      <MenuContent align={compact ? "start" : "end"} className="w-72">
        <MenuLabel>{t("dashboardPage.companies")}</MenuLabel>
        <MenuRadioGroup value={company.id} onValueChange={selectCompany}>
          {companies.map((c) => (
            <MenuRadioItem key={c.id} value={c.id} icon={<Avatar name={c.name} src={c.logo_url} square size="xs" />}>
              <span className="block truncate">{c.name}</span>
              {c.my_role && <span className="block text-sm text-ink-2">{t(`employer.roles.${c.my_role}`)}</span>}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </MenuRoot>
  );
}

/**
 * A company name with the verified badge glued to its last word, so the badge never wraps onto
 * a line of its own (a no-break space doesn't hold an inline icon; a nowrap span does).
 */
export function VerifiedName({ name, verified, iconClassName }: { name: string; verified?: boolean; iconClassName?: string }) {
  const { t } = useTranslation();
  if (!verified) return <>{name}</>;
  const cut = name.lastIndexOf(" ");
  return (
    <>
      {cut > 0 && name.slice(0, cut + 1)}
      <span className="whitespace-nowrap">
        {name.slice(cut + 1)}{" "}
        <BadgeCheck role="img" aria-label={t("common.verified")} className={cn("inline-block align-middle text-firuza", iconClassName)} />
      </span>
    </>
  );
}
