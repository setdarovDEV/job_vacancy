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
        "inline-flex items-center justify-center gap-2 rounded-control transition-colors",
        withLabel ? "h-11 border border-line-strong bg-surface px-4 text-[0.9375rem] font-medium hover:bg-sunken" : "size-10 hover:bg-sunken",
        saved ? "text-anor" : "text-ink-3 hover:text-ink",
        className,
      )}
    >
      <Heart className={cn("size-5 transition-transform duration-200", saved && "scale-110 fill-current")} />
      {withLabel && <span className={saved ? "text-ink" : ""}>{label}</span>}
    </button>
  );
}
