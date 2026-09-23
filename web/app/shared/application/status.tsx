import type { BadgeTone } from "../ui/Badge";
import { Badge } from "../ui/Badge";
import { useTranslation } from "../i18n/i18n";

export const STATUSES = ["sent", "viewed", "invited", "interview", "hired", "rejected", "withdrawn"] as const;
export type AppStatus = (typeof STATUSES)[number];
export const FINAL: AppStatus[] = ["hired", "rejected", "withdrawn"];

const tone: Record<AppStatus, BadgeTone> = {
  sent: "neutral", viewed: "lapis", invited: "firuza", interview: "firuza", hired: "firuza", rejected: "anor", withdrawn: "outline",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useTranslation();
  return <Badge tone={tone[status as AppStatus] ?? "neutral"} className={className}>{t(`enums.application_status.${status}`)}</Badge>;
}
