import { Link2, Send, Share, Share2 } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";

import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";
import { Popover, popoverItem } from "~/shared/ui/Popover";
import { toast } from "~/shared/ui/toast-store";

// The page's own address without tracking query strings or #fragments.
const pageUrl = () => location.origin + location.pathname;
const canNativeShare = () => typeof navigator.share === "function";

async function nativeShare(title: string) {
  try {
    await navigator.share({ title, url: pageUrl() });
  } catch {
    /* the user closed the share sheet */
  }
}

/**
 * Share button. On touch devices with the Web Share API it opens the system share sheet
 * (Telegram, SMS, … are all there); elsewhere a small menu: Telegram, copy link, and the system
 * sheet when the desktop browser has one.
 */
export function ShareMenu({ title, className }: { title: string; className?: string }) {
  const { t } = useTranslation();
  // Known only in the browser; the extra row appears after hydration (inside a closed menu).
  const [native, setNative] = useState(false);
  useEffect(() => setNative(canNativeShare()), []);

  const onTrigger = (e: MouseEvent<HTMLButtonElement>) => {
    if (!canNativeShare() || !matchMedia("(pointer: coarse)").matches) return;
    // Cancelling the click stops the popovertarget toggle: the system sheet replaces the menu.
    e.preventDefault();
    void nativeShare(title);
  };

  const telegram = () => {
    const href = `https://t.me/share/url?url=${encodeURIComponent(pageUrl())}&text=${encodeURIComponent(title)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl());
      toast({ tone: "success", title: t("jobs.linkCopied") });
    } catch {
      toast({ tone: "error", title: t("vacancyPage.copyFailed") });
    }
  };

  return (
    <Popover
      label={t("jobs.share")}
      align="start"
      className="w-60"
      trigger={(p) => (
        <Button
          {...p}
          type="button"
          variant="secondary"
          icon={<Share2 className="size-4.5" />}
          onClick={onTrigger}
          className={className}
        >
          {t("jobs.share")}
        </Button>
      )}
    >
      <ul role="list" className="flex flex-col">
        <li>
          <button type="button" className={popoverItem} onClick={telegram}>
            <Send aria-hidden="true" className="size-4.5 text-ink-3" />
            {t("vacancyPage.telegram")}
          </button>
        </li>
        <li>
          <button type="button" className={popoverItem} onClick={() => void copy()}>
            <Link2 aria-hidden="true" className="size-4.5 text-ink-3" />
            {t("vacancyPage.copyLink")}
          </button>
        </li>
        {native && (
          <li>
            <button type="button" className={popoverItem} onClick={() => void nativeShare(title)}>
              <Share aria-hidden="true" className="size-4.5 text-ink-3" />
              {t("vacancyPage.shareMore")}
            </button>
          </li>
        )}
      </ul>
    </Popover>
  );
}
