// Source of truth for in-app help. Each ARTICLE documents a real, user-visible
// feature ("surface") whose label already exists as an i18n key (nav.* / view.* /
// menu.*). help.test.ts reads those key groups from en.json and FAILS the build if
// an actionable feature has no article and isn't consciously ignored — that tripwire
// is what keeps help in sync as the app grows. Article *text* lives in content/*.ts
// (English now, other locales fall back to English), keyed by `id`.

export type HelpRole = "admin" | "member";

// Sub-sections of the Help center, in display order (see CATEGORIES). Grouping turns
// the long flat list into a few collapsible chunks so it's not a wall of text.
export type HelpCategory = "views" | "tasks" | "account" | "admin" | "faq";

export interface HelpArticle {
  /** Stable slug; also the key into the content modules (content/en.ts). */
  id: string;
  /** Which collapsible sub-section this lives under. */
  category: HelpCategory;
  /**
   * i18n key of the control this documents, e.g. "view.board" / "nav.team".
   * Omit for general FAQ entries not tied to a single button. When present it
   * MUST be a real key (enforced by help.test.ts).
   */
  surface?: string;
  /** Who can see this article. Default: everyone. Use to hide admin-only tools. */
  roles?: HelpRole[];
  /**
   * Release date (ISO yyyy-mm-dd) this feature/help was added. Drives "What's New":
   * items newer than the user's last-seen date surface automatically. Lexical
   * compare — keep the yyyy-mm-dd format. Omit for the baseline (pre-existing) set.
   */
  addedISO?: string;
}

// Section order + their i18n label keys. Render in this order; skip empty ones.
export const CATEGORIES: { key: HelpCategory; labelKey: string }[] = [
  { key: "views", labelKey: "help.cat.views" },
  { key: "tasks", labelKey: "help.cat.tasks" },
  { key: "account", labelKey: "help.cat.account" },
  { key: "admin", labelKey: "help.cat.admin" },
  { key: "faq", labelKey: "help.cat.faq" },
];

// When you add a new feature button (a new nav.*/view.*/menu.* key), add its article
// here with a category. If a key is genuinely self-explanatory or not a feature, add
// it to IGNORE in help.test.ts (with a reason) instead. One of the two — else CI reds.
export const ARTICLES: HelpArticle[] = [
  // ---- Getting around (the four task views) --------------------------------
  { id: "list-view", category: "views", surface: "view.list" },
  { id: "board-view", category: "views", surface: "view.board" },
  { id: "weekly-view", category: "views", surface: "view.weekly" },
  {
    id: "monthly-view",
    category: "views",
    surface: "view.monthly",
    addedISO: "2026-06-06",
  },

  // ---- Everyday tasks ------------------------------------------------------
  { id: "new-task", category: "tasks", surface: "nav.newTask" },
  { id: "share-view", category: "tasks", surface: "view.shareView" },
  { id: "copy-summary", category: "tasks", surface: "view.copySummary" },
  {
    id: "pending-approval",
    category: "tasks",
    surface: "menu.pendingApproval",
    addedISO: "2026-06-11",
  },
  { id: "archive", category: "tasks", surface: "view.archive" },

  // ---- Your account --------------------------------------------------------
  { id: "notifications", category: "account", surface: "menu.notificationsOn" },
  { id: "daily-push", category: "account", surface: "menu.dailyPush" },
  { id: "language", category: "account", surface: "menu.language" },
  { id: "theme", category: "account", surface: "menu.theme" },

  // ---- For admins ----------------------------------------------------------
  {
    id: "projects",
    category: "admin",
    surface: "nav.projects",
    roles: ["admin"],
  },
  { id: "team", category: "admin", surface: "nav.team", roles: ["admin"] },
  {
    id: "approvals",
    category: "admin",
    surface: "nav.approvals",
    roles: ["admin"],
  },
  { id: "trash", category: "admin", surface: "nav.trash", roles: ["admin"] },
  {
    id: "settings",
    category: "admin",
    surface: "menu.settings",
    roles: ["admin"],
  },
  {
    id: "history",
    category: "admin",
    surface: "menu.history",
    roles: ["admin"],
  },
  {
    id: "restore-points",
    category: "admin",
    surface: "menu.restorePoints",
    roles: ["admin"],
  },
  {
    id: "bulk-migrate",
    category: "admin",
    surface: "menu.bulkMigrate",
    roles: ["admin"],
  },
  // Recently added feature (not a top-bar button → no surface):
  {
    id: "holidays",
    category: "admin",
    roles: ["admin"],
    addedISO: "2026-06-06",
  },

  // ---- Common questions (general FAQ, no single control) -------------------
  { id: "faq-cant-see", category: "faq" },
  { id: "faq-assign", category: "faq" },
  { id: "faq-status", category: "faq" },
  { id: "faq-mobile", category: "faq" },
  { id: "faq-password", category: "faq" },
];

/** True when an article is visible only to admins (so the UI can mark it). */
export function isAdminOnly(a: HelpArticle): boolean {
  return !!a.roles && !a.roles.includes("member");
}

/** Articles a given role may see (admin sees everything). */
export function articlesForRole(isAdmin: boolean): HelpArticle[] {
  return ARTICLES.filter(
    (a) => !a.roles || (isAdmin ? true : a.roles.includes("member")),
  );
}

/** The newest addedISO across all articles (the "current" help version). */
export function latestVersion(): string {
  return ARTICLES.reduce(
    (max, a) => (a.addedISO && a.addedISO > max ? a.addedISO : max),
    "",
  );
}

/** Articles newer than what the user last saw — the "What's New" list. */
export function whatsNew(
  lastSeenISO: string | null,
  isAdmin: boolean,
): HelpArticle[] {
  const seen = lastSeenISO ?? "";
  return articlesForRole(isAdmin)
    .filter((a) => a.addedISO && a.addedISO > seen)
    .sort((a, b) => (b.addedISO ?? "").localeCompare(a.addedISO ?? ""));
}
