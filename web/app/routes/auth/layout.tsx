import { useEffect } from "react";
import { Outlet, useNavigate, useSearchParams } from "react-router";

import { useSession } from "~/shared/auth/session";
import { GirihPattern } from "~/shared/brand/GirihPattern";
import { localizedPath } from "~/shared/i18n/config";
import { useLocale } from "~/shared/i18n/hooks";

/** Where to go after signing in: ?next= (same-site paths only) or the home page. */
export function useNext() {
  const [params] = useSearchParams();
  const next = params.get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default function AuthLayout() {
  const { status } = useSession();
  const navigate = useNavigate();
  const locale = useLocale();
  const next = useNext();
  // Signed-in people have nothing to do on these pages.
  useEffect(() => {
    if (status === "authed" && !location.pathname.includes("verify-email")) {
      navigate(next ?? localizedPath(locale, "/"), { replace: true });
    }
  }, [status, next, locale, navigate]);

  return (
    <div className="relative isolate flex min-h-[calc(100dvh-4rem)] justify-center px-4 py-12 md:py-20">
      <GirihPattern className="-z-10" reveal={false} focus="ellipse 45% 55% at 50% 0%" />
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
