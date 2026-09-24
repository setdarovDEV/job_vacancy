import { Heart } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useSession } from "../auth/session";
import { localizedPath } from "../i18n/config";
import { useLocale } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { toast } from "../ui/toast-store";
import { toggleSaved, useSaved } from "./saved";

/**
 * Heart toggle for a vacancy. The fill flips at once (optimistic) with a spring pop; removing
 * offers Undo in a toast, a failure rolls back with an error toast. Anonymous visitors go to
 * sign-in and come back; employers don't get the button at all.
 */
export function SaveButton({ id, withLabel, className }: { id: string; withLabel?: boolean; className?: string }) {
  const { t } = useTranslation();
  const { status, user } = useSession();
  const saved = useSaved(id);
  const navigate = useNavigate();
  const locale = useLocale();
  // Bumped on every save so the pop replays; 0 = never touched (no pop on first paint).
  const [pops, setPops] = useState(0);
  if (user?.role === "employer") return null;
  const label = saved ? t("jobs.saved") : t("jobs.save");

  const toggle = async (on: boolean) => {
    if (on) setPops((n) => n + 1);
    const ok = await toggleSaved(id, on);
    if (!ok) {
      toast({ tone: "error", title: t("vacanciesPage.saveFailed") });
      return;
    }
    if (!on) {
      toast({
        tone: "info",
        title: t("vacanciesPage.unsaved"),
        action: { label: t("vacanciesPage.undo"), onClick: () => void toggle(true) },
      });
    }
  };

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={withLabel ? undefined : t("jobs.save")}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (status !== "authed") {
          navigate(`${localizedPath(locale, "/login")}?next=${encodeURIComponent(location.pathname + location.search)}`);
          return;
        }
        void toggle(!saved);
      }}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-2 transition-[background-color,border-color,color,scale] duration-150 ease-spring active:scale-[0.94]",
        withLabel
          ? cn("h-11 rounded-control border px-4 text-md font-medium", saved ? "border-anor/30 bg-anor-soft text-anor-ink" : "border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-sunken")
          : cn(
              // Icon-only: 40px with a mouse, at least 44px to a finger (min-*, so a caller's larger size wins).
              "size-10 rounded-pill pointer-coarse:min-h-11 pointer-coarse:min-w-11",
              saved ? "bg-anor-soft text-anor" : "text-ink-3 hover:bg-anor-soft hover:text-anor",
            ),
        className,
      )}
    >
      <Heart
        key={pops}
        aria-hidden="true"
        className={cn("size-5 shrink-0", saved && "fill-current text-anor", saved && pops > 0 && "anim-heart")}
      />
      {withLabel && <span>{label}</span>}
    </button>
  );
}
