import { Fragment, useEffect, useState, type ReactNode } from "react";

import { useTranslation } from "~/shared/i18n/i18n";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";

/** Link inside a sentence (consent line): always underlined, so it never differs by colour alone. */
export const authLink = "font-medium text-lapis-ink underline underline-offset-3";

/**
 * Standalone link in the card footer ("Sign up", "Back to sign in"): a hit area of at least 44px
 * tall (and wider than short words like "Kirish"); negative margins cancel the padding, so the
 * line itself doesn't grow.
 */
export const authFooterLink = "-mx-1 -my-3 inline-block rounded-control px-1 py-3 font-medium text-lapis-ink underline-offset-3 hover:underline";

/**
 * A translated sentence with `<tag>…</tag>` spans turned into elements (links, bold), so every
 * locale keeps its own word order and no translated fragments are glued together.
 */
export function rich(text: string, tags: Record<string, (chunk: string) => ReactNode>): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/<(\w+)>(.*?)<\/\1>/g)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const render = tags[m[1]];
    out.push(<Fragment key={m.index}>{render ? render(m[2]) : m[2]}</Fragment>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Id of the card's subtitle: code inputs point aria-describedby at it ("we sent a code to …"). */
export const AUTH_SUBTITLE_ID = "auth-subtitle";

/**
 * The auth form surface. Phones: a solid card (a 32px blur over plain paper costs frames and
 * shows nothing). From md it floats over the aurora as glass-sheet, drawn as a separate layer so
 * the card itself keeps its solid fallback below md. `auth-card` (app.css) names it only while a
 * view transition runs, so it morphs between login, register and the reset steps: a permanent
 * view-transition-name would make the card a backdrop root and the glass inside it would stop
 * blurring the page.
 */
export function AuthCard({ title, subtitle, icon, children, footer }: {
  title: string;
  subtitle?: ReactNode;
  /** Illustration-grade icon above the title (verify, reset): says what kind of step this is. */
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card
      as="section"
      aria-labelledby="auth-title"
      radius="sheet"
      padding="lg"
      className="auth-card relative isolate md:border-transparent md:bg-transparent md:shadow-none"
    >
      <div aria-hidden="true" className="glass-sheet hidden rounded-sheet md:absolute md:-inset-px md:-z-10 md:block" />
      {icon && (
        <span aria-hidden="true" className="mb-5 grid size-12 place-items-center rounded-panel bg-lapis-soft text-lapis-ink">
          {icon}
        </span>
      )}
      <h1 id="auth-title" className="break-words font-display text-xl font-semibold tracking-heading text-ink sm:text-2xl">
        {title}
      </h1>
      {subtitle && <p id={AUTH_SUBTITLE_ID} className="mt-2 break-words text-md text-ink-2">{subtitle}</p>}
      <div className="mt-6 md:mt-7">{children}</div>
      {footer && <p className="mt-6 border-t border-line pt-5 text-center text-md text-ink-2 md:mt-7">{footer}</p>}
    </Card>
  );
}

/** Seconds until the next code may be requested; ticks once a second while above zero. */
export function useCooldown(initial: number) {
  const [cooldown, setCooldown] = useState(initial);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);
  return [cooldown, setCooldown] as const;
}

/**
 * "Didn't get it?" line with the resend button. The countdown is tabular (num), so the label
 * doesn't jitter every second, and it isn't a live region (no announcement every tick).
 */
export function ResendRow({ cooldown, sending, onResend, extra }: {
  cooldown: number;
  sending: boolean;
  onResend: () => void;
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-ink-2">{t("authPage.noCode")}</p>
      <div className="-mx-2 flex flex-wrap items-center justify-between gap-x-4">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onResend}
          disabled={cooldown > 0}
          loading={sending}
          className="num px-2 text-lapis-ink hover:bg-lapis-soft hover:text-lapis-ink disabled:text-ink-2 disabled:opacity-100"
        >
          {cooldown > 0 ? t("auth.resendIn", { s: cooldown }) : t("auth.resend")}
        </Button>
        {extra}
      </div>
    </div>
  );
}
