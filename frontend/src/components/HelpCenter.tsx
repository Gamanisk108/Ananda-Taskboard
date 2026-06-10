import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, ChevronRight, ChevronDown, Mail, CircleHelp } from "lucide-react";
import { Modal } from "./common";
import {
  articlesForRole,
  latestVersion,
  whatsNew,
  CATEGORIES,
  type HelpArticle,
  type HelpCategory,
} from "../help/registry";
import { allContent, type HelpContent } from "../help/content";

// Support address for the Help "Contact us" link. Single source of truth — change here.
const HELP_CONTACT_EMAIL = "Hanuman@anandala.org";

// The "?" panel. Browsing is organised into collapsible, counted sub-sections (so it's
// not a wall of text); searching cuts across all of them as a flat list. A What's New
// block auto-surfaces newly-added features, and admin-only articles carry a muted
// "Admin" chip (no "(admins)" in titles). Content text comes from ../help/content
// (English now, other locales fall back). Marking What's New seen is persisted on open.
export function HelpCenter({
  onClose,
  isAdmin,
  lang,
  lastSeen,
  onSeen,
  onReplayWelcome,
}: {
  onClose: () => void;
  isAdmin: boolean;
  lang: string;
  lastSeen: string | null;
  onSeen: () => void;
  onReplayWelcome: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  // Which sub-sections are expanded. Default: all collapsed → a compact, scannable
  // landing of labelled rows. Users open the one they need (or just search).
  const [openCats, setOpenCats] = useState<Set<HelpCategory>>(new Set());

  const content = useMemo(() => allContent(lang), [lang]);
  const visible = useMemo(() => articlesForRole(isAdmin), [isAdmin]);

  // Capture what the user had seen BEFORE this open (useState initializer runs once),
  // so What's New still lists the new items; then mark the latest version seen and
  // clear the dot in the parent.
  const [seenAtOpen] = useState(lastSeen);
  useEffect(() => {
    localStorage.setItem("at-help-seen", latestVersion());
    onSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newItems = useMemo(
    () => whatsNew(seenAtOpen, isAdmin),
    [isAdmin, seenAtOpen],
  );

  const q = query.trim().toLowerCase();
  const matches = (a: HelpArticle) => {
    const c = content[a.id];
    if (!c) return false;
    return (
      c.title.toLowerCase().includes(q) || c.body.toLowerCase().includes(q)
    );
  };
  const searchResults = q ? visible.filter(matches) : [];

  // visible articles grouped by category, preserving registry order within each.
  const byCategory = useMemo(() => {
    const map = new Map<HelpCategory, HelpArticle[]>();
    for (const a of visible) {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    }
    return map;
  }, [visible]);

  function toggleCat(cat: HelpCategory) {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function Item({ a, isNew }: { a: HelpArticle; isNew?: boolean }) {
    const c: HelpContent = content[a.id] ?? { title: a.id, body: "" };
    const open = openId === a.id;
    return (
      <div className="help-item">
        <button
          type="button"
          className="help-q"
          onClick={() => setOpenId(open ? null : a.id)}
          aria-expanded={open}
        >
          <span className="help-q-title">{c.title}</span>
          {/* D17: the grey "Admin" chip is removed — admin articles live under the
              "For admins" section and state "admins only" in their body. */}
          {isNew && (
            <span className="help-chip help-chip-new">
              {t("help.newBadge", "New")}
            </span>
          )}
          <span aria-hidden className="muted help-q-caret">
            {open ? "▾" : "▸"}
          </span>
        </button>
        {open && (
          <div className="help-a">
            {c.body.split(/\n\n+/).map((para, i) => (
              <p key={i} style={{ margin: i === 0 ? "0 0 8px" : "8px 0 0" }}>
                {para}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Modal fullScreenOnNarrow icon={<CircleHelp />} title={t("help.title", "Help & FAQ")} onClose={onClose} wide>
      <input
        type="search"
        data-testid="help-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("help.search", "Search help…")}
        autoFocus
        style={{ width: "100%", boxSizing: "border-box", marginBottom: 14 }}
      />

      {q ? (
        // ---- Search results (flat across every section) ---------------------
        searchResults.length === 0 ? (
          <div className="empty" style={{ padding: 20 }}>
            {t("help.noResults", "No help found. Try another word.")}
          </div>
        ) : (
          <div>
            {searchResults.map((a) => (
              <Item key={a.id} a={a} />
            ))}
          </div>
        )
      ) : (
        <>
          {newItems.length > 0 && (
            <section style={{ marginBottom: 8 }}>
              <h3
                className="section-title"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Sparkles size={15} /> {t("help.whatsNew", "What's new")}
              </h3>
              {newItems.map((a) => (
                <Item key={a.id} a={a} isNew />
              ))}
            </section>
          )}

          {CATEGORIES.map(({ key, labelKey }) => {
            const items = byCategory.get(key);
            if (!items || items.length === 0) return null;
            const expanded = openCats.has(key);
            return (
              <section key={key} className="help-cat-section">
                <button
                  type="button"
                  className="help-cat"
                  data-testid={`help-cat-${key}`}
                  aria-expanded={expanded}
                  onClick={() => toggleCat(key)}
                >
                  {expanded ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                  <span className="help-cat-label">{t(labelKey)}</span>
                  <span className="help-cat-count muted">{items.length}</span>
                </button>
                {expanded && (
                  <div className="help-cat-body">
                    {items.map((a) => (
                      <Item key={a.id} a={a} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}

      <div className="help-footer">
        <button
          className="btn-ghost"
          data-testid="replay-welcome"
          onClick={onReplayWelcome}
        >
          <Sparkles size={15} aria-hidden style={{ verticalAlign: "-2px", marginRight: 5 }} />{t("help.replayWelcome", "Show welcome again")}
        </button>
        <a
          className="help-contact"
          data-testid="help-contact"
          href={`mailto:${HELP_CONTACT_EMAIL}`}
        >
          <Mail size={14} /> {t("help.contact", "Contact us")}
        </a>
      </div>
    </Modal>
  );
}
