import { useState } from "react";

import { apiError, type ApiError } from "../api/client";
import { errorText, fieldErrors } from "../api/errors";
import { useTranslation } from "../i18n/i18n";

/**
 * Form submission state: pending flag, a form-level error sentence and per-field errors
 * mapped from the API's validation response.
 */
export function useSubmit() {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function run<R extends { error?: unknown; response: Response }>(
    call: () => Promise<R>,
    onOk: (res: R) => void | Promise<void>,
    onError?: (e: ApiError) => boolean | void, // return true when handled
  ) {
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
    } catch {
      setError(t("errors.network"));
    } finally {
      setPending(false);
    }
  }

  return { pending, error, fields, run, setError };
}
