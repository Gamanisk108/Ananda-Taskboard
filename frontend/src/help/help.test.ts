// The "self-updating" guarantee. This test reads the real nav/view/menu label groups
// from en.json and fails the build if an actionable feature has no help article and
// isn't deliberately ignored below. So when someone adds a new button (a new i18n key)
// without documenting it, CI goes red with a precise message. It also checks the help
// registry's internal integrity (real surfaces, content exists, no dupes).

import { describe, it, expect } from "vitest";
import en from "../locales/en.json";
import {
  ARTICLES,
  articlesForRole,
  whatsNew,
  latestVersion,
  isAdminOnly,
  CATEGORIES,
} from "./registry";
import { EN } from "./content/en";

// Keys in nav/view/menu that are NOT standalone features needing help. If you add a
// feature key, prefer writing an article over adding it here — only ignore genuine
// labels, hints, and structural strings, and say why.
const IGNORE: Record<string, Record<string, string>> = {
  nav: {
    globalOverview: "tab label, self-evident",
    projectOverview: "tab label, self-evident",
    noProjects: "empty-state label, not an action",
  },
  view: {
    hideArchive: "the toggled-off label of view.archive (same feature)",
    archiveHint: "tooltip text, not a feature",
    shareHint: "tooltip text, not a feature",
  },
  menu: {
    account: "menu label, not a feature",
    logout: "self-evident, no help needed",
  },
};

const documentedSurfaces = new Set(
  ARTICLES.map((a) => a.surface).filter(Boolean),
);

/** Resolve a dotted key path within en.json (e.g. "view.board"). */
function resolveKey(path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      en,
    );
}

describe("help coverage tripwire", () => {
  for (const group of ["nav", "view", "menu"] as const) {
    const keys = Object.keys(
      (en as Record<string, Record<string, unknown>>)[group],
    );
    for (const key of keys) {
      const surface = `${group}.${key}`;
      const ignored = IGNORE[group]?.[key];
      it(`${surface} is documented or explicitly ignored`, () => {
        if (ignored) {
          // Sanity: don't both ignore AND document the same surface.
          expect(documentedSurfaces.has(surface)).toBe(false);
          return;
        }
        expect(
          documentedSurfaces.has(surface),
          `No help article documents "${surface}". Add one to src/help/registry.ts ` +
            `(and content/en.ts), or, if it's not a feature, list it in IGNORE.${group} ` +
            `in help.test.ts with a reason.`,
        ).toBe(true);
      });
    }
  }
});

describe("help registry integrity", () => {
  it("has no duplicate article ids", () => {
    const ids = ARTICLES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every surface points at a real i18n key", () => {
    for (const a of ARTICLES) {
      if (!a.surface) continue;
      expect(
        typeof resolveKey(a.surface),
        `surface "${a.surface}" (article "${a.id}") is missing from en.json`,
      ).toBe("string");
    }
  });

  it("every article has English content", () => {
    for (const a of ARTICLES) {
      const c = EN[a.id];
      expect(c, `article "${a.id}" has no entry in content/en.ts`).toBeTruthy();
      expect(
        c.title.trim().length,
        `article "${a.id}" has an empty title`,
      ).toBeGreaterThan(0);
      expect(
        c.body.trim().length,
        `article "${a.id}" has an empty body`,
      ).toBeGreaterThan(0);
    }
  });

  it("no content entries are orphaned (every content id is a registered article)", () => {
    const ids = new Set(ARTICLES.map((a) => a.id));
    for (const id of Object.keys(EN)) {
      expect(
        ids.has(id),
        `content/en.ts has "${id}" with no matching article in registry.ts`,
      ).toBe(true);
    }
  });

  it("addedISO values are valid yyyy-mm-dd dates", () => {
    for (const a of ARTICLES) {
      if (!a.addedISO) continue;
      expect(
        a.addedISO,
        `article "${a.id}" addedISO is not yyyy-mm-dd`,
      ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(
        Number.isNaN(Date.parse(a.addedISO)),
        `article "${a.id}" addedISO is not a real date`,
      ).toBe(false);
    }
  });
});

describe("what's new", () => {
  it("latestVersion is the newest addedISO", () => {
    expect(latestVersion()).toBe("2026-06-11");
  });

  it("shows nothing once the user has seen the latest version", () => {
    expect(whatsNew(latestVersion(), true)).toHaveLength(0);
  });

  it("surfaces newer items to a user who hasn't seen them", () => {
    const fresh = whatsNew("2026-01-01", true);
    expect(fresh.length).toBeGreaterThan(0);
    // newest-first ordering
    expect(fresh[0].addedISO! >= fresh[fresh.length - 1].addedISO!).toBe(true);
  });

  it("hides admin-only new items from non-admins", () => {
    // "holidays" is admin-only and dated; a member shouldn't get it in What's New.
    const memberNew = whatsNew("2026-01-01", false).map((a) => a.id);
    expect(memberNew).not.toContain("holidays");
  });
});

describe("categories", () => {
  const validCats = new Set(CATEGORIES.map((c) => c.key));

  it("every article has a known category", () => {
    for (const a of ARTICLES) {
      expect(
        validCats.has(a.category),
        `article "${a.id}" has unknown category "${a.category}"`,
      ).toBe(true);
    }
  });

  it("every category label key exists in en.json", () => {
    for (const c of CATEGORIES) {
      expect(
        typeof resolveKey(c.labelKey),
        `missing i18n key ${c.labelKey}`,
      ).toBe("string");
    }
  });

  it("every category renders at least one article (no empty sections)", () => {
    for (const c of CATEGORIES) {
      expect(
        ARTICLES.some((a) => a.category === c.key),
        `category "${c.key}" has no articles — remove it or add one`,
      ).toBe(true);
    }
  });

  it("flags admin-only articles and not shared ones", () => {
    expect(isAdminOnly(ARTICLES.find((a) => a.id === "team")!)).toBe(true);
    expect(isAdminOnly(ARTICLES.find((a) => a.id === "list-view")!)).toBe(
      false,
    );
  });
});

describe("role filtering", () => {
  it("admins see every article", () => {
    expect(articlesForRole(true).length).toBe(ARTICLES.length);
  });

  it("members do not see admin-only articles", () => {
    const memberIds = new Set(articlesForRole(false).map((a) => a.id));
    expect(memberIds.has("team")).toBe(false);
    expect(memberIds.has("list-view")).toBe(true);
  });
});
