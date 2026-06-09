// Community Translations — the live-override runtime (design D38).
// Resolution order for every UI string: live override → bundled catalog →
// English (i18next fallbackLng). Overrides arrive as a flat {dotted.key: text}
// map from /api/translations/overrides and are merged over the bundled catalog
// at runtime — an approval goes live with NO redeploy.

import i18n, { CATALOGS } from "./i18n";

/** {a.b: x} → {a: {b: x}} so addResourceBundle can deep-merge it. */
function unflatten(map: Record<string, string>): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [key, text] of Object.entries(map)) {
    const parts = key.split(".");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (typeof node[part] !== "object" || node[part] === null) node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = text;
  }
  return root;
}

const lastApplied: Record<string, string> = {}; // locale → JSON of the last map

/** Merge the live overrides for `locale` over its bundled catalog. Re-asserts
 *  the pristine bundle first so a CLEARED override falls back to the bundled
 *  wording instead of sticking. No-ops when nothing changed. */
export function applyOverrides(locale: string, overrides: Record<string, string>) {
  const fingerprint = JSON.stringify(overrides);
  if (lastApplied[locale] === fingerprint) return;
  lastApplied[locale] = fingerprint;
  const bundled = CATALOGS[locale];
  if (bundled) i18n.addResourceBundle(locale, "translation", bundled, true, true);
  i18n.addResourceBundle(locale, "translation", unflatten(overrides), true, true);
  // Re-announce the language so every useTranslation() consumer re-renders with
  // the new wording (addResourceBundle alone doesn't trigger bound re-renders).
  if (i18n.language === locale) void i18n.changeLanguage(locale);
}
