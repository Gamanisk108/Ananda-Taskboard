// Maps the active UI language to a date-fns locale so the calendar views render
// month/weekday NAMES localized. Use ONLY for display formats (e.g. "MMM d",
// "EEEE") — never for the "yyyy-MM-dd" strings used as map keys or API params,
// which must stay ASCII. Marathi (mr) has no date-fns locale, so it borrows
// Hindi (also Devanagari) instead of falling back to English.
import { enUS, it, es, fr, de, pt, zhCN, hi, bn, ta, te, gu } from "date-fns/locale";
import type { Locale } from "date-fns";
import i18n from "./i18n";

const MAP: Record<string, Locale> = {
  en: enUS, it, es, fr, de, pt, zh: zhCN, hi, bn, ta, te, mr: hi, gu,
};

export function dfLocale(): Locale {
  return MAP[i18n.language] ?? enUS;
}
