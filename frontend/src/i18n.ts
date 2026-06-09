// App interface translation (i18next). Per-user language comes from /api/me;
// falls back to the browser locale, then English. Catalogs live in ./locales.
// Keep LANGUAGES in sync with backend SUPPORTED_LANGUAGES (accounts/models.py).
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import it from "./locales/it.json";
import es from "./locales/es.json";
import hi from "./locales/hi.json";
import bn from "./locales/bn.json";
import ta from "./locales/ta.json";
import te from "./locales/te.json";
import mr from "./locales/mr.json";
import gu from "./locales/gu.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import pt from "./locales/pt.json";
import zh from "./locales/zh.json";

/** The bundled catalogs, keyed by locale. Exported so the community-translations
 *  runtime can re-assert the pristine bundle under live overrides (an override
 *  that gets cleared must fall back to the bundled wording, not stick). */
export const CATALOGS: Record<string, Record<string, unknown>> = {
  en, it, es, hi, bn, ta, te, mr, gu, de, fr, pt, zh,
};

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español (México)" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "zh", label: "中文 (简体)" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "mr", label: "मराठी" },
  { code: "gu", label: "ગુજરાતી" },
];

const SUPPORTED = new Set(LANGUAGES.map((l) => l.code));

/** Resolve the language to use: explicit preference → browser locale → English. */
export function resolveLanguage(pref?: string | null): string {
  if (pref && SUPPORTED.has(pref)) return pref;
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return SUPPORTED.has(nav) ? nav : "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en }, it: { translation: it }, es: { translation: es },
    hi: { translation: hi }, bn: { translation: bn }, ta: { translation: ta },
    te: { translation: te }, mr: { translation: mr }, gu: { translation: gu },
    de: { translation: de }, fr: { translation: fr }, pt: { translation: pt },
    zh: { translation: zh },
  },
  lng: "en",
  fallbackLng: "en",          // untranslated/Pass-2 keys show English, never blank
  interpolation: { escapeValue: false },
});

export default i18n;
