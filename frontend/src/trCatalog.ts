// Community Translations — catalog utilities (design D37/D38).
// The bundled English catalog (locales/en.json) is the source of truth for WHAT
// can be translated; these helpers flatten it, group keys into the 9 contributor
// categories, fuzzy-merge near-identical sources, and validate {{placeholders}}.

import en from "./locales/en.json";

/** One translatable string: a stable dotted key + its English source text. */
export interface CatalogEntry {
  key: string;
  en: string;
}

function flatten(node: unknown, prefix: string, out: CatalogEntry[]) {
  if (typeof node === "string") {
    out.push({ key: prefix, en: node });
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
}

/** Every translatable string in the app, flattened to dotted keys. */
export function catalogEntries(): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  flatten(en, "", out);
  return out;
}

/** The 9 contributor-facing categories (most-used first — design D37), each
 *  owning a set of en.json top-level namespaces. `trc.cat.<key>` is the label.
 *  A vitest completeness test fails the build when a NEW namespace appears in
 *  en.json without a category — assign it here. */
export const TR_CATEGORIES: { key: string; namespaces: string[] }[] = [
  { key: "tasks", namespaces: ["common", "task", "list", "tm", "subtask", "cs", "bulk", "day", "attach", "ai"] },
  { key: "cal", namespaces: ["cal", "holidays"] },
  { key: "status", namespaces: ["view", "kanban", "approvals", "theme", "wfa", "summary"] },
  { key: "team", namespaces: ["ta", "ap", "invite", "accept", "org", "apiKeys"] },
  { key: "proj", namespaces: ["mp", "del", "trash", "restore", "history"] },
  { key: "io", namespaces: ["import", "export", "expcol", "copy", "share"] },
  { key: "nav", namespaces: ["nav", "menu", "settings", "modals", "tabs", "empty"] },
  { key: "account", namespaces: ["login", "reset", "signup", "verify", "legal", "google"] },
  { key: "other", namespaces: ["platform", "help", "onboarding", "emoji", "helpus", "trc", "trv", "fb"] },
];

/** Category key for a dotted string key (its top-level namespace). */
export function categoryOf(key: string): string {
  const ns = key.split(".")[0];
  for (const c of TR_CATEGORIES) if (c.namespaces.includes(ns)) return c.key;
  return "other";
}

/** Grouping/merge form of a string: trim + collapse whitespace + drop a trailing
 *  ellipsis. NEVER casefolds (casing is locale-meaningful). Mirrors the backend's
 *  translations.models.normalize_text — keep the two in sync. */
export function normalizeText(text: string): string {
  let out = text.split(/\s+/).filter(Boolean).join(" ");
  for (const suffix of ["…", "..."]) {
    if (out.endsWith(suffix)) out = out.slice(0, -suffix.length).trimEnd();
  }
  return out;
}

/** A fuzzy-merged contributor row: one canonical entry + the near-identical
 *  variants it also covers ("+N similar" — saving fans out to every key). */
export interface MergedRow {
  primary: CatalogEntry;
  similar: CatalogEntry[];
  /** every key this row's save covers (primary first) */
  keys: string[];
}

/** Collapse entries whose normalized English matches (design D37 fuzzy-merge,
 *  capped at exact-after-normalization per the code audit — no edit distance). */
export function mergeRows(entries: CatalogEntry[]): MergedRow[] {
  const byNorm = new Map<string, CatalogEntry[]>();
  for (const e of entries) {
    const norm = normalizeText(e.en);
    const list = byNorm.get(norm);
    if (list) list.push(e);
    else byNorm.set(norm, [e]);
  }
  return [...byNorm.values()].map((group) => ({
    primary: group[0],
    similar: group.slice(1),
    keys: group.map((g) => g.key),
  }));
}

/** The {{placeholder}} names in a string, sorted (multiset as a sorted list). */
export function extractPlaceholders(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
}

/** True when a suggestion keeps every {{placeholder}} of the English source
 *  intact (members must not delete/translate them — they render as raw text). */
export function placeholdersIntact(enText: string, suggestion: string): boolean {
  const need = extractPlaceholders(enText);
  if (need.length === 0) return true;
  const have = extractPlaceholders(suggestion);
  if (need.length !== have.length) return false;
  return need.every((p, i) => p === have[i]);
}

/** D44 §6 (revised, Gordon 06-09) — members never see token syntax, but the
 *  variable's POSITION stays visible as a "___" blank: "If an account exists for
 *  {{email}}," reads "If an account exists for ___,". No awkward empty gap. */
export const PH_BLANK = "___";
export function blankPlaceholders(text: string): string {
  return text.replace(/\{\{[^}]+\}\}/g, PH_BLANK);
}

/** Turn a member's blanked translation back into a storable string: each "___"
 *  maps (in source order) to the English {{tokens}}. The member may place the
 *  blank wherever their language needs it, so word-order is preserved. If they
 *  drop a blank, the leftover tokens are appended so interpolation never breaks. */
export function restorePlaceholders(enText: string, edited: string): string {
  const tokens = enText.match(/\{\{[^}]+\}\}/g) || [];
  if (tokens.length === 0) return edited.trim();
  let i = 0;
  let out = edited.replace(/_{3,}/g, () => (i < tokens.length ? tokens[i++] : PH_BLANK));
  while (i < tokens.length) out = `${out.trim()} ${tokens[i++]}`;
  return out.trim();
}
