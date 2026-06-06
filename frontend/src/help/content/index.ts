// Help-content loader. Returns article text for the active UI language, falling back
// to English per-key when a translation is missing. This is what lets us ship English
// now and add languages later WITHOUT touching components or the parity-checked JSON
// catalogs: to add Italian, create ./it.ts exporting the same shape and register it in
// LOCALES below. Anything it omits still shows English.

import { EN, type HelpContent } from "./en";

export type { HelpContent };

// Register translated catalogs here as they're written, e.g.  it: IT, hi: HI.
// Each may be partial — missing ids fall back to English automatically.
const LOCALES: Record<string, Record<string, HelpContent>> = {
  en: EN,
};

/** All article text for `lang`: English base with any translated keys layered on top. */
export function allContent(lang: string): Record<string, HelpContent> {
  return { ...EN, ...(LOCALES[lang] ?? {}) };
}
