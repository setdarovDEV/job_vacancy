import { BadgeCheck, LockKeyhole, MessagesSquare } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import { Outlet, useNavigate, useSearchParams } from "react-router";

import type { ShellHandle } from "../site";
import { useSession } from "~/shared/auth/session";
import { GirihPattern } from "~/shared/brand/GirihPattern";
import { localizedPath } from "~/shared/i18n/config";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";

// The form is the whole job on these pages: no floating tab bar over it on phones.
export const handle: ShellHandle = { tabBar: false };

/** Where to go after signing in: ?next= (same-site paths only) or the home page. */
export function useNext() {
  const [params] = useSearchParams();
  const next = params.get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

// Only claims the product backs today: company verification, resume visibility, stages + chat.
const trust = [
  { icon: BadgeCheck, title: "authPage.verifiedTitle", body: "authPage.verifiedBody", tone: "text-firuza-ink" },
  { icon: LockKeyhole, title: "authPage.privacyTitle", body: "authPage.privacyBody", tone: "text-lapis-ink" },
  { icon: MessagesSquare, title: "authPage.statusTitle", body: "authPage.statusBody", tone: "text-lapis-ink" },
] as const;

export default function AuthLayout() {
  const { t } = useTranslation();
  const { status } = useSession();
  const navigate = useNavigate();
  const locale = useLocale();
  const next = useNext();
  // Signed-in people have nothing to do on these pages. Only those who *arrive* signed in are sent
  // on: signing in here (anon → authed) leaves the route to the page itself, or sign-up would be
  // overridden on its way to verify-email (and a new employer's way to /employer).
  const seenAnon = useRef(false);
  useEffect(() => {
    if (status === "anon") seenAnon.current = true;
    else if (status === "authed" && !seenAnon.current && !location.pathname.includes("verify-email")) {
      navigate(next ?? localizedPath(locale, "/"), { replace: true });
    }
  }, [status, next, locale, navigate]);

  return (
    <div className="relative isolate">
      {/* From md the aurora runs up under the clear header and gives the glass card colour to refract.
          Phones stay on calm paper: the card is solid there, so the light would only cost paint. */}
      <div
        aria-hidden="true"
        className="aurora-hero aurora-fade anim-fade pointer-events-none absolute inset-x-0 -top-(--header-h) bottom-0 -z-10 hidden md:block"
        style={{ animationDuration: "var(--dur-4)" }}
      />
      <GirihPattern className="-z-10 hidden md:block" reveal={false} focus="ellipse 42% 58% at 24% 42%" />
      <div
        className={cn(
          "container-page grid gap-8 pb-16 pt-6 md:gap-12 md:pb-24 md:pt-10",
          // Desktop: brand story on the left, the form on the right, together filling the first screen.
          "lg:min-h-[calc(100dvh-var(--header-h))] lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-center lg:gap-16 lg:py-12 xl:gap-24",
        )}
      >
        {/* First in the DOM (and for keyboard / screen readers): the form is what people came for. */}
        <div className="mx-auto w-full min-w-0 max-w-md lg:order-last">
          <Outlet />
        </div>
        <aside aria-labelledby="auth-aside-title" className="mx-auto w-full min-w-0 max-w-md md:max-w-none lg:order-first lg:max-w-xl">
          <div className="hidden lg:block">
            <p className="glass-panel inline-flex max-w-full items-center gap-2.5 rounded-pill px-3.5 py-1.5 text-sm text-ink-2">
              <span className="shrink-0 font-display font-semibold tracking-heading text-ink">{t("brand.name")}</span>
              <span aria-hidden="true" className="h-3.5 w-px shrink-0 bg-line-strong" />
              <span className="min-w-0 truncate">{t("brand.tagline")}</span>
            </p>
            <h2
              id="auth-aside-title"
              className="mt-6 break-words font-display text-3xl font-semibold tracking-display text-ink xl:text-4xl"
            >
              {t("authPage.heroTitle")}
            </h2>
            <p className="mt-4 max-w-lg text-lead text-ink-2">{t("authPage.heroLead")}</p>
          </div>
          <ul aria-label={t("authPage.trustLabel")} className="grid gap-5 md:grid-cols-3 md:gap-6 lg:mt-10 lg:grid-cols-1">
            {trust.map((item, i) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.title}
                  className="anim-enter flex min-w-0 gap-4 md:flex-col md:gap-3 lg:flex-row lg:gap-4"
                  style={{ "--i": i + 1 } as CSSProperties}
                >
                  {/* Solid tiles: the card and the brand pill already use the glass budget here. */}
                  <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-control border border-line bg-surface shadow-1">
                    <Icon className={cn("size-5", item.tone)} />
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-md font-semibold text-ink">{t(item.title)}</p>
                    <p className="mt-0.5 break-words text-sm text-ink-2">{t(item.body)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
