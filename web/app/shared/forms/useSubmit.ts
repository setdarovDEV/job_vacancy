import { useEffect, useRef, useState } from "react";

import { apiError, type ApiError } from "../api/client";
import { errorText, fieldErrors } from "../api/errors";
import { useTranslation } from "../i18n/i18n";

const shown = (el: Element) => el.getClientRects().length > 0;

/**
 * Form submission state: pending flag, a form-level error sentence and per-field errors
 * mapped from the API's validation response. After a failed submit the first invalid field
 * gets focus and is scrolled to the middle of the screen (or the FormError, if no field is
 * to blame), so the problem is never hidden below the fold or behind the keyboard.
 */
export function useSubmit() {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failures, setFailures] = useState(0);
  const scope = useRef<Element | null>(null);

  useEffect(() => {
    if (!failures) return;
    // Next frame: the error markup (aria-invalid, FormError) is rendered and laid out by then.
    const frame = requestAnimationFrame(() => {
      const root: ParentNode = scope.current?.isConnected ? scope.current : document;
      const field = [...root.querySelectorAll<HTMLElement>('[aria-invalid="true"]')].find(shown);
      const target = field ?? root.querySelector<HTMLElement>("[data-form-error]") ?? document.querySelector<HTMLElement>("[data-form-error]");
      if (!target) return;
      const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      field?.focus({ preventScroll: true });
      target.scrollIntoView({ block: field ? "center" : "nearest", behavior });
    });
    return () => cancelAnimationFrame(frame);
  }, [failures]);

  async function run<R extends { error?: unknown; response: Response }>(
    call: () => Promise<R>,
    onOk: (res: R) => void | Promise<void>,
    onError?: (e: ApiError) => boolean | void, // return true when handled
  ) {
    // The form being submitted (focus is on its submit button or a field), to search it first.
    scope.current = document.activeElement?.closest("form") ?? null;
    setPending(true);
    setError(null);
    setFields({});
    try {
      const res = await call();
      const e = res.response.ok ? null : apiError(res);
      if (!e) return await onOk(res);
      if (onError?.(e)) return;
      setFields(fieldErrors(t, e));
      setError(e.code === "validation_failed" ? null : errorText(t, e));
      setFailures((n) => n + 1);
    } catch {
      setError(t("errors.network"));
      setFailures((n) => n + 1);
    } finally {
      setPending(false);
    }
  }

  return { pending, error, fields, run, setError };
}
