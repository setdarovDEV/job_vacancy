import type { TFunction } from "../i18n/i18n";
import type { ApiError } from "./client";

/** A user-facing sentence for an API error code (falls back to a generic message). */
export function errorText(t: TFunction, e: ApiError | null | undefined): string {
  if (!e) return "";
  if (e.code === "rate_limited") return t("errors.rate_limited", { seconds: e.retry_after ?? 60 });
  const key = `apiErrors.${e.code}`;
  const text = t(key);
  return text === key ? t("errors.internal_error") : text;
}

// Request fields that are arrays; their "skills[i]" element errors keep the plain rules.
const LIST_FIELDS = new Set(["skills", "languages", "experience", "education", "ids"]);

/** Per-field messages from a validation_failed error, keyed by JSON field name. */
export function fieldErrors(t: TFunction, e: ApiError | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!e?.fields) return out;
  for (const [field, rule] of Object.entries(e.fields)) {
    const [name, param] = rule.split("=");
    // On a list field min/max count items, not characters (fields.skills = "max=20").
    const counted = LIST_FIELDS.has(field) && (name === "max" || name === "min");
    const key = `validation.${counted ? `${name}_items` : name}`;
    const text = t(key, { n: param ?? "" });
    out[field] = text === key ? t("validation.invalid") : text;
    // "skills[3]" (one element) also shows under its list's field, which is what forms render.
    const list = field.replace(/\[\d+\]$/, "");
    if (list !== field && !(list in out)) out[list] = out[field];
  }
  return out;
}
