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
  { key: "tasks", namespaces: ["common", "task", "list", "tm", "subtask", "cs", "bulk", "day"] },
  { key: "cal", namespaces: ["cal", "holidays"] },
  { key: "status", namespaces: ["view", "kanban", "approvals", "theme"] },
  { key: "team", namespaces: ["ta", "ap", "invite", "accept", "org"] },
  { key: "proj", namespaces: ["mp", "del", "trash", "restore", "history"] },
  { key: "io", namespaces: ["import", "export", "expcol", "copy"] },
  { key: "nav", namespaces: ["nav", "menu", "settings", "modals", "tabs", "empty"] },
  { key: "account", namespaces: ["login", "reset", "signup", "verify"] },
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

/** D44 §6 — placeholders are INVISIBLE to members. Strip every {{token}} (and
 *  the surrounding space) so "Assigned to {{name}}" reads "Assigned to". Members
 *  translate only the visible text; the build re-inserts the variable. */
export function stripPlaceholders(text: string): string {
  return text.replace(/\s*\{\{[^}]+\}\}\s*/g, " ").replace(/\s{2,}/g, " ").trim();
}

/** Re-insert the English source's {{placeholders}} into a member's brace-free
 *  translation, at their source position. Single leading/trailing tokens are
 *  placed exactly; a mid-string or multi-token case can't preserve order in this
 *  v1 (flagged) — we append the tokens so interpolation never breaks. */
export function reinsertPlaceholders(enText: string, visibleTranslation: string): string {
  const tokens = [...enText.matchAll(/\{\{[^}]+\}\}/g)].map((m) => m[0]);
  const v = visibleTranslation.trim();
  if (tokens.length === 0) return v;
  if (tokens.length === 1) {
    const ph = tokens[0];
    const idx = enText.indexOf(ph);
    const before = enText.slice(0, idx).trim();
    const after = enText.slice(idx + ph.length).trim();
    if (!before && after) return `${ph} ${v}`.trim();          // leading token
    if (before && !after) return `${v} ${ph}`.trim();          // trailing token
    if (!before && !after) return ph;                          // token-only string
    return `${v} ${ph}`.trim();                                // mid-string fallback (flagged)
  }
  return `${v} ${tokens.join(" ")}`.trim();                    // multi-token fallback (flagged)
}

/** Strings whose {{placeholder}} sits mid-sentence or that have 2+ tokens: their
 *  word-order can't be expressed without showing tokens (v1 limit — see report). */
export function placeholderPositionAmbiguous(enText: string): boolean {
  const tokens = [...enText.matchAll(/\{\{[^}]+\}\}/g)].map((m) => m[0]);
  if (tokens.length === 0) return false;
  if (tokens.length > 1) return true;
  const ph = tokens[0];
  const idx = enText.indexOf(ph);
  const before = enText.slice(0, idx).trim();
  const after = enText.slice(idx + ph.length).trim();
  return Boolean(before && after); // token in the middle
}
