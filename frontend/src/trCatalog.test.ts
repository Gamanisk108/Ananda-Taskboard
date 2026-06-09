// Community Translations catalog utilities: the category map must stay complete
// (a new en.json namespace with no category fails the build — same self-updating
// pattern as the help-coverage test), and placeholder validation must catch the
// ways members actually break {{tokens}}.

import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import {
  TR_CATEGORIES,
  catalogEntries,
  categoryOf,
  extractPlaceholders,
  mergeRows,
  normalizeText,
  placeholdersIntact,
} from "./trCatalog";

describe("category map", () => {
  it("covers every top-level namespace in en.json exactly once", () => {
    const mapped = TR_CATEGORIES.flatMap((c) => c.namespaces);
    const dupes = mapped.filter((ns, i) => mapped.indexOf(ns) !== i);
    expect(dupes).toEqual([]);
    const missing = Object.keys(en).filter((ns) => !mapped.includes(ns));
    // If this fails you added a namespace to en.json — assign it a category in
    // trCatalog.ts TR_CATEGORIES so members can translate it.
    expect(missing).toEqual([]);
  });

  it("resolves a key to its category", () => {
    expect(categoryOf("task.markDone")).toBe("tasks");
    expect(categoryOf("login.title")).toBe("account");
    expect(categoryOf("unknown.namespace")).toBe("other");
  });

  it("flattens the catalog to dotted keys", () => {
    const entries = catalogEntries();
    expect(entries.length).toBeGreaterThan(500);
    expect(entries.every((e) => typeof e.en === "string" && e.key.includes("."))).toBe(true);
  });
});

describe("normalizeText", () => {
  it("collapses whitespace and trailing ellipsis, preserves case", () => {
    expect(normalizeText("  Add   link…  ")).toBe("Add link");
    expect(normalizeText("Add link...")).toBe("Add link");
    expect(normalizeText("Marcar como Hecho")).toBe("Marcar como Hecho");
  });
});

describe("mergeRows (fuzzy-merge, exact-after-normalization)", () => {
  it("groups identical-after-normalization sources and fans out keys", () => {
    const rows = mergeRows([
      { key: "a.addLink", en: "Add link" },
      { key: "b.addLink", en: "Add link…" },
      { key: "c.other", en: "Delete" },
    ]);
    const merged = rows.find((r) => r.primary.key === "a.addLink");
    expect(merged?.similar.map((s) => s.key)).toEqual(["b.addLink"]);
    expect(merged?.keys).toEqual(["a.addLink", "b.addLink"]);
    expect(rows.find((r) => r.primary.key === "c.other")?.similar).toEqual([]);
  });

  it("does NOT merge different strings (no edit-distance fuzz)", () => {
    const rows = mergeRows([
      { key: "a", en: "Add link" },
      { key: "b", en: "Add a link" },
    ]);
    expect(rows).toHaveLength(2);
  });
});

describe("placeholders", () => {
  it("extracts {{tokens}} sorted", () => {
    expect(extractPlaceholders("Delete {{n}} of {{total}}?")).toEqual(["n", "total"]);
    expect(extractPlaceholders("plain")).toEqual([]);
  });

  it("accepts intact placeholders anywhere in the suggestion", () => {
    expect(placeholdersIntact("Due {{date}}", "Vence el {{date}}")).toBe(true);
    expect(placeholdersIntact("plain", "sencillo")).toBe(true);
  });

  it("rejects missing, translated, or mangled placeholders", () => {
    expect(placeholdersIntact("Due {{date}}", "Vence pronto")).toBe(false);
    expect(placeholdersIntact("Due {{date}}", "Vence el {{fecha}}")).toBe(false);
    expect(placeholdersIntact("Move {{n}} tasks", "Mover {n} tareas")).toBe(false);
    expect(placeholdersIntact("{{a}} and {{b}}", "{{a}} y {{a}}")).toBe(false);
  });
});
