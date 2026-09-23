import { useSession } from "~/shared/auth/session";
import { useTranslation } from "~/shared/i18n/i18n";
import { EmptyState } from "~/shared/ui/EmptyState";

export function EmployerOnly({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useSession();
  if (user?.role === "employer" || user?.role === "admin") return <>{children}</>;
  return <EmptyState title={t("apiErrors.employer_only")} />;
}
