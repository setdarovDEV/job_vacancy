import { createContext, useContext, useMemo, type ReactNode } from "react";

import { htmlLang, type Locale } from "./config";
import type { Messages } from "./messages/uz";

// A deliberately small translator (~1 KB instead of i18next's ~17 KB): messages arrive
// from the root loader, so all we need is lookup, {{var}} interpolation and plurals.
export type TVars = Record<string, string | number> & { count?: number };
export type TFunction = (key: string, vars?: TVars) => string;

function lookup(messages: unknown, key: string): unknown {
  let cur = messages;
  for (const part of key.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function createT(messages: Messages, locale: Locale): TFunction {
  const plural = new Intl.PluralRules(htmlLang[locale]);
  return (key, vars) => {
    let value = lookup(messages, key);
    if (vars?.count !== undefined) {
      // "hours" + count 5 → hours_many (ru) / hours_other; falls back to the bare key.
      value = lookup(messages, `${key}_${plural.select(vars.count)}`) ?? lookup(messages, `${key}_other`) ?? value;
    }
    if (typeof value !== "string") return key;
    return vars ? value.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? "")) : value;
  };
}

const Ctx = createContext<{ t: TFunction; locale: Locale } | null>(null);

export function I18nProvider({ messages, locale, children }: { messages: Messages; locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ t: createT(messages, locale), locale }), [messages, locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTranslation() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTranslation outside I18nProvider");
  return v;
}
