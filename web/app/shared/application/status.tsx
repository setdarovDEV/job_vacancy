import { Check, CircleX, Eye, Handshake, PartyPopper, Send, Undo2, Users, type LucideIcon } from "lucide-react";

import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { Badge, type BadgeTone } from "../ui/Badge";
import { popoverItem } from "../ui/Popover";

export const STATUSES = ["sent", "viewed", "invited", "interview", "hired", "rejected", "withdrawn"] as const;
export type AppStatus = (typeof STATUSES)[number];
export const FINAL: AppStatus[] = ["hired", "rejected", "withdrawn"];
/** Where an employer may move an application ("sent" is only the initial state, "withdrawn" is the seeker's). */
export const EMPLOYER_TARGETS = ["viewed", "invited", "interview", "hired", "rejected"] as const;
export type EmployerTarget = (typeof EMPLOYER_TARGETS)[number];
export const isEmployerTarget = (s: string | null | undefined): s is EmployerTarget =>
  (EMPLOYER_TARGETS as readonly string[]).includes(s ?? "");

type Tone = Exclude<BadgeTone, "outline">;

/**
 * How each status reads everywhere (badge, kanban column, stage menu): a tint that follows the
 * funnel (neutral → lapis in progress → za'faron interview → firuza hired, anor declined) plus an
 * icon, so a status never depends on colour alone — the label always says it too.
 */
export const STATUS_LOOK: Record<AppStatus, { tone: Tone; icon: LucideIcon }> = {
  sent: { tone: "neutral", icon: Send },
  viewed: { tone: "lapis", icon: Eye },
  invited: { tone: "lapis", icon: Handshake },
  interview: { tone: "zafaron", icon: Users },
  hired: { tone: "firuza", icon: PartyPopper },
  rejected: { tone: "anor", icon: CircleX },
  withdrawn: { tone: "neutral", icon: Undo2 },
};

const tile: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2",
  lapis: "bg-lapis-soft text-lapis-ink",
  firuza: "bg-firuza-soft text-firuza-ink",
  zafaron: "bg-zafaron-soft text-zafaron-ink",
  anor: "bg-anor-soft text-anor-ink",
};

export const lookOf = (status: string | null | undefined) => STATUS_LOOK[(status ?? "sent") as AppStatus] ?? STATUS_LOOK.sent;

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useTranslation();
  const look = lookOf(status);
  const Icon = look.icon;
  // Withdrawn is the seeker's own quiet exit: an outline pill rather than a tinted one.
  return (
    <Badge tone={status === "withdrawn" ? "outline" : look.tone} icon={<Icon />} className={className}>
      {t(`enums.application_status.${status}`)}
    </Badge>
  );
}

/** The status icon in a small tinted circle (kanban column headers, stage menus). Decorative. */
export function StatusIcon({ status, className }: { status: string | null | undefined; className?: string }) {
  const look = lookOf(status);
  const Icon = look.icon;
  return (
    <span aria-hidden="true" className={cn("grid size-6 shrink-0 place-items-center rounded-full [&_svg]:size-3.5", tile[look.tone], className)}>
      <Icon />
    </span>
  );
}

/**
 * "Move to…" rows for a Popover: every stage an employer may pick, the current one ticked and
 * disabled. Rows use `popoverItem`, so picking one closes the popover.
 */
export function StageMenuItems({ current, onPick }: { current?: string | null; onPick: (s: EmployerTarget) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <p className="px-3 pb-1 pt-1.5 text-xs font-medium text-ink-2">{t("employer.moveTo")}</p>
      {EMPLOYER_TARGETS.map((s) => {
        const on = s === current;
        return (
          <button key={s} type="button" className={popoverItem} disabled={on} aria-current={on || undefined} onClick={() => onPick(s)}>
            <StatusIcon status={s} />
            <span className="min-w-0 flex-1 truncate">{t(`enums.application_status.${s}`)}</span>
            {on && <Check aria-hidden="true" className="size-4 shrink-0 text-lapis" strokeWidth={2.5} />}
          </button>
        );
      })}
    </>
  );
}
