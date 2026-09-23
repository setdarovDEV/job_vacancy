import { createT, type TFunction } from "../i18n/i18n";
import { defaultLocale, type Locale } from "../i18n/config";
import type { Messages } from "../i18n/messages/uz";

type Match = { id: string; loaderData?: unknown } | undefined;

/** A translator for `meta` exports, built from the root loader's messages. */
export function metaT(matches: Match[]): { t: TFunction; locale: Locale } {
  const root = matches.find((m) => m?.id === "root")?.loaderData as { messages?: Messages; locale?: Locale } | undefined;
  const locale = root?.locale ?? defaultLocale;
  if (!root?.messages) return { t: (k) => k, locale };
  return { t: createT(root.messages, locale), locale };
}
