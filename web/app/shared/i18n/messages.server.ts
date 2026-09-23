// Server-only: all locales are bundled on the server; the root loader ships just one.
import type { Locale } from "./config";
import en from "./messages/en";
import ru from "./messages/ru";
import uz from "./messages/uz";
import uzCyrl from "./messages/uz-Cyrl";
import type { Messages } from "./messages/uz";

const all: Record<Locale, Messages> = { uz, "uz-Cyrl": uzCyrl, ru, en };

export function messagesFor(locale: Locale): Messages {
  return all[locale];
}
