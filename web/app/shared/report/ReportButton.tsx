import { Flag } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { useSession } from "~/shared/auth/session";
import { useIsCompanyMember } from "~/shared/company/membership";
import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";

import type { ReportTarget } from "./reasons";

const ReportDialog = lazy(() => import("./ReportDialog"));

/**
 * "Report" for a public vacancy or company. Hidden from the company's own team and from
 * admins (they act on content directly), and until membership is known so it never flashes
 * for the team. Signed-out visitors get a sign-in prompt in the dialog. The dialog's code
 * is fetched on first use.
 */
export function ReportButton({ target, companyId, className }: { target: ReportTarget; companyId: string; className?: string }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const member = useIsCompanyMember(companyId);
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  if (member !== false || user?.role === "admin") return null; // unknown yet, or own company
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={className}
        icon={<Flag className="size-4" />}
        onPointerDown={() => setRequested(true)}
        onClick={() => { setRequested(true); setOpen(true); }}
      >
        {t("report.button")}
      </Button>
      {requested && (
        <Suspense fallback={null}>
          <ReportDialog target={target} open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
