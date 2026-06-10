// Improve translations — the member contributor surface (design D37, reframed
// per the audit ruling §1: every string already HAS a translation, so progress
// is PERSONAL coverage — "You've suggested N of M". Saved rows stay editable
// forever; saves are per-row (batch only for fuzzy-merged "+N similar" rows).

import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Languages, Info, Check, Pencil, ChevronRight, ListChecks, TriangleAlert,
  RotateCw, Search, X,
} from "lucide-react";
import i18n, { LANGUAGES, resolveLanguage } from "../i18n";
import { api } from "../api/client";
import { useConfirm } from "./confirm";
import { applyOverrides } from "../trOverrides";
import {
  TR_CATEGORIES, catalogEntries, categoryOf, mergeRows, blankPlaceholders,
  restorePlaceholders, type MergedRow,
} from "../trCatalog";
import { Modal, SingleSelect } from "./common";
import { QuoteBoxed } from "./HelpUs";
import type { Me } from "../types";

interface MineRow { key: string; text: string; updated_at: string }

/** Live wording for a key in a locale: override → bundled → English fallback.
 *  The override map is passed explicitly (not read back out of i18next) so rows
 *  re-render the moment a fresh override fetch lands. */
function currentWording(locale: string, key: string, overrides: Record<string, string>): string {
  return overrides[key] ?? (i18n.getResource(locale, "translation", key) as string | undefined) ?? "";
}

/** English source with each {{placeholder}} shown as a "___" blank — members see
 *  where the variable goes, never the token syntax (D44 §6). */
function SourceText({ text }: { text: string }) {
  return <>{blankPlaceholders(text)}</>;
}

export function ImproveTranslations({ me, onClose }: { me: Me; onClose: () => void }) {
  const { t } = useTranslation();
  const targets = LANGUAGES.filter((l) => l.code !== "en");
  const uiLang = resolveLanguage(me.language);
  const [locale, setLocale] = useState(uiLang !== "en" ? uiLang : targets[0].code);
  const [openCat, setOpenCat] = useState<string | null>(TR_CATEGORIES[0].key);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => mergeRows(catalogEntries()), []);
  const byCategory = useMemo(() => {
    const map = new Map<string, MergedRow[]>();
    for (const r of rows) {
      const cat = categoryOf(r.primary.key);
      const list = map.get(cat);
      if (list) list.push(r);
      else map.set(cat, [r]);
    }
    return map;
  }, [rows]);

  // The member's own suggestions for this locale (key → text).
  const mineQuery = useQuery({
    queryKey: ["tr-mine", locale],
    queryFn: () => api.get(`/api/translations/mine?locale=${locale}`) as Promise<MineRow[]>,
  });
  const mine = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of mineQuery.data ?? []) map.set(r.key, r.text);
    return map;
  }, [mineQuery.data]);

  // Live overrides for the locale being translated (so "Current wording" is
  // honest even when it isn't the member's own UI language).
  const overridesQuery = useQuery({
    queryKey: ["tr-overrides", locale],
    queryFn: () => api.get(`/api/translations/overrides?locale=${locale}`) as Promise<Record<string, string>>,
  });
  useEffect(() => {
    if (overridesQuery.data) applyOverrides(locale, overridesQuery.data);
  }, [overridesQuery.data, locale]);
  const overrides = useMemo(() => overridesQuery.data ?? {}, [overridesQuery.data]);

  const total = rows.length;
  const suggested = rows.filter((r) => mine.has(r.primary.key)).length;
  const pct = total ? Math.round((suggested / total) * 100) : 0;
  const localeLabel = targets.find((l) => l.code === locale)?.label ?? locale;

  const q = query.trim().toLowerCase();
  const searchHits = useMemo(() => {
    if (!q) return null;
    const hits = rows.filter((r) =>
      r.primary.en.toLowerCase().includes(q) ||
      currentWording(locale, r.primary.key, overrides).toLowerCase().includes(q) ||
      (mine.get(r.primary.key) ?? "").toLowerCase().includes(q),
    );
    const grouped = new Map<string, MergedRow[]>();
    for (const r of hits) {
      const cat = categoryOf(r.primary.key);
      const list = grouped.get(cat);
      if (list) list.push(r);
      else grouped.set(cat, [r]);
    }
    return grouped;
  }, [q, rows, locale, mine, overrides]);

  const loading = mineQuery.isLoading;
  const allDone = !loading && total > 0 && suggested === total;

  const bar = (
    <>
      <div className="tr-bar">
        <div className="tr-lang">
          <span className="lbl">{t("trc.into")}</span>
          <SingleSelect value={locale} onChange={(v) => { setLocale(v); setQuery(""); }}
            options={targets.map((l) => ({ value: l.code, label: l.label }))} testId="trc-lang" />
        </div>
        <div className="tr-prog">
          <span>{t("trc.progress")}</span>
          <span className="ptrack"><i style={{ width: `${pct}%` }} /></span>
          <Trans i18nKey="trc.progressText" values={{ n: suggested, m: total }}
            components={{ b: <b className="mono" /> }} />
        </div>
      </div>
      <div className="tr-srcnote"><Info size={14} /> {t("trc.srcNote")}</div>
    </>
  );

  return (
    <Modal icon={<Languages />} title={t("trc.title")} onClose={onClose} wide
      footer={
        <>
          <span style={{ fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 7 }}>
            <Check size={14} /> {t("trc.leaveNote")}
          </span>
          <button type="button" className="btn-secondary" style={{ marginLeft: "auto" }} onClick={onClose}>
            {t("common.close")}
          </button>
        </>
      }>
      {bar}
      {loading ? (
        <>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="tr-sk"><div className="ln s" /><div className="ln l" /><div className="ln m" /></div>
          ))}
        </>
      ) : allDone ? (
        <div className="tr-done">
          {/* D43: official prayer-hands artwork (transparent alpha; theme-inverts in dark). */}
          <img className="hh-img" src="/assets/prayer-hands-alpha.png" alt="" />
          <h3>{t("trc.doneTitle")}</h3>
          <p>{t("trc.doneBody")}</p>
          <QuoteBoxed
            text="The happiness of one's own heart alone cannot satisfy the soul; one must try to include, as necessary to one's own happiness, the happiness of others."
            who="Paramhansa Yogananda"
          />
        </div>
      ) : (
        <>
          <div className="tr-search">
            <input type="search" placeholder={t("trc.searchPh")} value={query}
              onChange={(e) => setQuery(e.target.value)} data-testid="trc-search" />
            {query ? (
              <button type="button" className="tr-search-x" title={t("common.close")} onClick={() => setQuery("")}>
                <X size={13} />
              </button>
            ) : (
              <span className="tr-search-x" style={{ background: "transparent", color: "var(--faint)" }}><Search size={14} /></span>
            )}
          </div>
          {searchHits ? (
            <>
              <div className="tr-resultcount">
                <Trans i18nKey="trc.results"
                  values={{ n: [...searchHits.values()].reduce((a, l) => a + l.length, 0), q: query.trim(), c: searchHits.size }}
                  components={{ b: <b className="mono" /> }} />
              </div>
              {TR_CATEGORIES.filter((c) => searchHits.has(c.key)).map((c) => (
                <Section key={c.key} catKey={c.key} open onToggle={() => {}} count={searchHits.get(c.key)!.length} neutral>
                  {searchHits.get(c.key)!.map((r) => (
                    <Row key={`${locale}:${r.primary.key}`} row={r} locale={locale} localeLabel={localeLabel}
                      mineText={mine.get(r.primary.key)} overrides={overrides} showCat />
                  ))}
                </Section>
              ))}
            </>
          ) : (
            TR_CATEGORIES.map((c) => {
              const list = byCategory.get(c.key) ?? [];
              if (list.length === 0) return null;
              const remaining = list.filter((r) => !mine.has(r.primary.key)).length;
              const open = openCat === c.key;
              // Rows without the member's suggestion sort first (D37).
              const sorted = open
                ? [...list].sort((a, b) => Number(mine.has(a.primary.key)) - Number(mine.has(b.primary.key)))
                : list;
              return (
                <Section key={c.key} catKey={c.key} open={open} count={remaining}
                  onToggle={() => setOpenCat(open ? null : c.key)}>
                  {open && sorted.map((r) => (
                    <Row key={`${locale}:${r.primary.key}`} row={r} locale={locale} localeLabel={localeLabel}
                      mineText={mine.get(r.primary.key)} overrides={overrides} />
                  ))}
                </Section>
              );
            })
          )}
        </>
      )}
    </Modal>
  );
}

function Section({ catKey, open, onToggle, count, neutral, children }: {
  catKey: string; open: boolean; onToggle: () => void; count: number; neutral?: boolean;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className={`trc-sec${open ? " open" : ""}`}>
      <button type="button" className="trc-sec-head" onClick={onToggle} aria-expanded={open}>
        <span className="chev"><ChevronRight size={15} /></span>
        <span style={{ display: "grid", placeItems: "center", color: "var(--muted)" }}><ListChecks size={15} /></span>
        <span className="sname">{t(`trc.cat.${catKey}`)}</span>
        {neutral ? (
          <span className="count mono" style={{ color: "var(--muted)", background: "var(--sunk)" }}>{count}</span>
        ) : count === 0 ? (
          <span className="count zero" title={t("trc.allSuggested")}><Check size={13} /></span>
        ) : (
          <span className="count untr mono" title={t("trc.badgeTitle", { n: count })}>{count}</span>
        )}
      </button>
      {open && <div className="tr-rows">{children}</div>}
    </div>
  );
}

function Row({ row, locale, localeLabel, mineText, overrides, showCat }: {
  row: MergedRow; locale: string; localeLabel: string; mineText?: string;
  overrides: Record<string, string>; showCat?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const en = row.primary.en;
  const key = row.primary.key;
  // Members type/see only the brace-free text; the source token is re-inserted
  // on save (D44 §6). So the editable draft is the STRIPPED form of their save.
  const savedVisible = blankPlaceholders(mineText ?? "");
  const [draft, setDraft] = useState(savedVisible);
  const [editing, setEditing] = useState(false);
  const [simOpen, setSimOpen] = useState(false);

  const current = currentWording(locale, key, overrides);
  const saved = mineText !== undefined;

  const save = useMutation({
    mutationFn: () =>
      api.put("/api/translations/mine", {
        locale,
        // Re-insert the English token at its source slot so interpolation works.
        entries: row.keys.map((k) => ({ key: k, text: restorePlaceholders(en, draft) })),
      }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["tr-mine", locale] });
    },
  });
  // Retract: deletes the caller's own suggestion across the row's fan-out keys.
  const remove = useMutation({
    mutationFn: () => api.del("/api/translations/mine", { locale, keys: row.keys }),
    onSuccess: () => {
      setEditing(false);
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["tr-mine", locale] });
    },
  });
  // Destructive → styled confirm first (app-wide rule; CodeRabbit PR#8).
  const confirmDialog = useConfirm();
  async function confirmRemove() {
    if (await confirmDialog({
      body: t("trc.removeConfirm", "Withdraw your suggestion “{{text}}”?", { text: savedVisible }),
      danger: true,
      confirmLabel: t("trc.remove", "Remove"),
    })) remove.mutate();
  }

  const showInput = !saved || editing;
  const dirty = draft.trim().length > 0 && draft.trim() !== savedVisible;

  const cls = ["tr-row", !saved ? "untranslated" : "", saved && !editing ? "saved" : "", save.isError ? "error" : "", simOpen ? "simopen" : ""]
    .filter(Boolean).join(" ");

  return (
    <div className={cls}>
      <div className="tr-en">
        <div className="tr-lbl">
          {t("trc.english")}
          {showCat && <span className="tr-catref">{t(`trc.cat.${categoryOf(key)}`)}</span>}
        </div>
        <div className="tr-val"><SourceText text={en} /></div>
        {row.similar.length > 0 && (
          <div className="tr-similar">
            <button type="button" className="tr-simbtn" onClick={() => setSimOpen((o) => !o)} aria-expanded={simOpen}>
              <ChevronRight size={13} style={{ transform: simOpen ? "rotate(90deg)" : undefined, transition: "transform .15s" }} />
              {t("trc.similar", { n: row.similar.length })}
            </button>
            {simOpen && (
              <div className="tr-variants">
                <div className="tv-h">{t("trc.alsoCovers")}</div>
                {row.similar.map((s) => <div key={s.key} className="v">{s.en}</div>)}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="tr-cur">
        <div className="tr-lbl">{t("trc.current")}</div>
        <div className={`tr-val${current ? "" : " none"}`}>{blankPlaceholders(current) || "—"}</div>
      </div>
      {save.isError ? (
        <div className="tr-err">
          <span className="msg"><TriangleAlert size={15} /> {t("trc.saveErr")}</span>
          <button type="button" className="btn-secondary" onClick={() => save.mutate()}>
            <RotateCw size={14} /> {t("trc.retry")}
          </button>
        </div>
      ) : (
        <div className="tr-inwrap">
          <div className="tr-field">
            <div className="tr-lbl">{t("trc.yoursIn", { lang: localeLabel })}</div>
            {showInput ? (
              <div className="tr-inputrow">
                <textarea className="tr-in" rows={1} placeholder={t("trc.inputPh")} value={draft}
                  onChange={(e) => setDraft(e.target.value)} />
                <button type="button" className="btn-primary tr-save"
                  disabled={!dirty || save.isPending}
                  onClick={() => save.mutate()}>
                  <Check size={14} /> {saved ? t("trc.update") : t("common.save")}
                </button>
              </div>
            ) : (
              /* D48: a saved row locks in — static text + Saved ✓ + Edit + Remove. */
              <div className="tr-minewrap">
                <span className="tr-mine">{savedVisible}</span>
                <span className="tr-savedwrap">
                  <span className="tr-saved"><Check size={15} /> {t("trc.saved")}</span>
                  <button type="button" className="btn-ghost tr-edit" onClick={() => { setDraft(savedVisible); setEditing(true); }}>
                    <Pencil size={14} /> {t("common.edit")}
                  </button>
                  <button type="button" className="btn-ghost tr-edit" disabled={remove.isPending}
                    title={t("trc.removeHint", "Withdraw your suggestion for this phrase")}
                    onClick={confirmRemove}>
                    <X size={14} /> {t("trc.remove", "Remove")}
                  </button>
                </span>
              </div>
            )}
            {editing && saved && <div className="tr-prev">{t("trc.prevSaved", { text: savedVisible })}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
