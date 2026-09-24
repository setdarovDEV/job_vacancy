import type { ReactNode } from "react";

import { useSession, type User } from "~/shared/auth/session";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";

// Below-the-fold sections skip rendering until near the viewport. Vertical padding (not margins)
// makes the section gap, so paint containment never clips a lifted card's shadow.
export const band = "container-page defer-paint py-8 md:py-12";
/** Placeholder height while a section is skipped (leaning to phone heights) so the scrollbar doesn't jump. */
export const est = (rem: number) => ({ containIntrinsicSize: `auto ${rem}rem` });

/** Where "post a vacancy" leads: the editor for employers, sign-up as an employer for everyone else. */
export function postHref(user: Pick<User, "role"> | null | undefined): string {
  return user?.role === "employer" ? "/employer/vacancies/new" : "/register?role=employer";
}

/** Section title of the landing: optional eyebrow, H2 and one line of context. */
export function SectionHead({ id, eyebrow, title, description, className }: {
  id: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "reveal max-w-2xl"}>
      {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-caps text-lapis-ink">{eyebrow}</p>}
      <h2 id={id} className="break-words font-display text-xl font-semibold tracking-heading text-ink md:text-2xl">{title}</h2>
      {description && <p className="mt-2 text-md text-ink-2 md:text-base">{description}</p>}
    </div>
  );
}

/** Hero and closing band share it: sign in for visitors, the cabinet for employers, nothing for seekers. */
export function SecondaryCta() {
  const { t } = useTranslation();
  const { user } = useSession();
  if (user && user.role !== "employer") return null;
  return (
    <Button asChild size="lg" shape="pill" variant="glass">
      {user ? (
        <LocalizedLink to="/employer" prefetch="intent">{t("account.dashboard")}</LocalizedLink>
      ) : (
        <LocalizedLink to="/login?next=/employer">{t("employersPage.login")}</LocalizedLink>
      )}
    </Button>
  );
}
