import { Heart } from "lucide-react";
import { useNavigate } from "react-router";

import { useSession } from "../auth/session";
import { localizedPath } from "../i18n/config";
import { useLocale } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { toggleSaved, useSaved } from "./saved";

export function SaveButton({ id, withLabel, className }: { id: string; withLabel?: boolean; className?: string }) {
  const { t } = useTranslation();
  const { status, user } = useSession();
  const saved = useSaved(id);
  const navigate = useNavigate();
  const locale = useLocale();
  if (user?.role === "employer") return null;
  const label = saved ? t("jobs.saved") : t("jobs.save");
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={withLabel ? undefined : label}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (status !== "authed") {
          navigate(`${localizedPath(locale, "/login")}?next=${encodeURIComponent(location.pathname + location.search)}`);
          return;
        }
        void toggleSaved(id, !saved);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control transition-[background-color,color,scale] duration-150 ease-spring active:scale-[0.94]",
        // Icon-only: 40px with a mouse, at least 44px to a finger (min-*, so a caller's larger size wins).
        withLabel
          ? "h-11 border border-line-strong bg-surface px-4 text-md font-medium hover:bg-sunken"
          : "size-10 hover:bg-sunken pointer-coarse:min-h-11 pointer-coarse:min-w-11",
        saved ? "text-anor" : "text-ink-3 hover:text-ink",
        className,
      )}
    >
      <Heart className={cn("size-5 transition-transform duration-200", saved && "scale-110 fill-current")} />
      {withLabel && <span className={saved ? "text-ink" : ""}>{label}</span>}
    </button>
  );
}
