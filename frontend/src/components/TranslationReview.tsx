// Translation review — the superadmin "poll graph" (design D38 + §10). One
// horizontal bar per distinct suggested variant, length = submitters, calm azure
// (NOT status colors); the live variant gets the green check + chip. Approving
// goes live app-wide instantly (runtime overrides, no redeploy) so it confirms
// first. v2: matches-current flag, free-text override, top-5 collapse, brace-free
// display (placeholders invisible), broken-placeholder bars not approvable.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Languages, Check, ChevronRight, ChevronDown, Inbox, TriangleAlert, Pencil, X } from "lucide-react";
import i18n, { LANGUAGES } from "../i18n";
import { api } from "../api/client";
import { catalogEntries, placeholdersIntact, blankPlaceholders, restorePlaceholders } from "../trCatalog";
import { Modal, SingleSelect, Spinner } from "./common";
import { useConfirm } from "./confirm";

interface Variant { text: string; count: number; users: string[] }
interface Poll { key: string; live: string | null; total: number; variants: Variant[] }

const TOP = 5; // 100+ replies → show the top-5 wordings, collapse the long tail.

export function TranslationReview({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const targets = LANGUAGES.filter((l) => l.code !== "en");
  const [locale, setLocale] = useState(targets[0].code);
  const [justApproved, setJustApproved] = useState<{ key: string; text: string } | null>(null);

  const enByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of catalogEntries()) map.set(e.key, e.en);
    return map;
  }, []);

  const review = useQuery({
    queryKey: ["tr-review", locale],
    queryFn: () => api.get(`/api/translations/review?locale=${locale}`) as Promise<Poll[]>,
  });
  const polls = (review.data ?? []).filter((p) => enByKey.has(p.key));
  const localeLabel = targets.find((l) => l.code === locale)?.label ?? locale;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["tr-review", locale] });
    queryClient.invalidateQueries({ queryKey: ["tr-overrides", locale] });
  }

  const approve = useMutation({
    mutationFn: (v: { key: string; text: string }) =>
      api.post("/api/translations/approve", { locale, key: v.key, text: v.text }),
    onSuccess: (_d, v) => { setJustApproved({ key: v.key, text: blankPlaceholders(v.text) }); refresh(); },
  });
  const clear = useMutation({
    mutationFn: (key: string) => api.del("/api/translations/override", { locale, key }),
    onSuccess: () => { setJustApproved(null); refresh(); },
  });
  // Moderation: dismiss a suggested variant (removes it from the poll entirely).
  const dismiss = useMutation({
    mutationFn: (v: { key: string; text: string }) =>
      api.del("/api/translations/suggestion", { locale, key: v.key, text: v.text }),
    onSuccess: refresh,
  });

  async function onDismiss(key: string, text: string) {
    const ok = await confirm({
      body: t("trv.dismissConfirm", "Remove the suggestion “{{text}}” from this poll? The submitter keeps nothing — this can't be undone.", { text: blankPlaceholders(text) }),
      danger: true,
      confirmLabel: t("trv.dismiss", "Remove suggestion"),
    });
    if (ok) dismiss.mutate({ key, text });
  }

  // Approve a specific wording (a bar's text, or a free-text override). `text`
  // already has placeholders re-inserted by the caller.
  async function approveText(key: string, text: string) {
    const en = enByKey.get(key) ?? "";
    const phBroken = !placeholdersIntact(en, text);
    const ok = await confirm({
      title: t("trv.confirmTitle"),
      danger: false,
      confirmLabel: t("trv.confirmCta"),
      body: (
        <>
          <p style={{ margin: 0 }}>{t("trv.confirmBody", { lang: localeLabel })}</p>
          <div className="cf-quote">
            <span className="lang">{localeLabel} · “{blankPlaceholders(en)}”</span>
            {blankPlaceholders(text)}
          </div>
          {phBroken && (
            <p style={{ color: "var(--danger)", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
              <TriangleAlert size={14} /> {t("trv.phWarn")}
            </p>
          )}
        </>
      ),
    });
    if (ok) approve.mutate({ key, text });
  }

  async function onClear(poll: Poll) {
    const ok = await confirm({
      body: t("trv.clearConfirm", { key: blankPlaceholders(enByKey.get(poll.key) ?? poll.key) }),
      danger: true,
      confirmLabel: t("trv.clear"),
    });
    if (ok) clear.mutate(poll.key);
  }

  return (
    <Modal fullScreenOnNarrow icon={<Languages />} title={t("trv.title")} onClose={onClose} wide>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{t("trv.sub")}</p>
      <div className="rv-bar">
        <div className="rv-lang">
          <span className="lbl">{t("trv.reviewing")}</span>
          <SingleSelect value={locale} onChange={(v) => { setLocale(v); setJustApproved(null); }}
            options={targets.map((l) => ({ value: l.code, label: l.label }))} testId="trv-lang" />
        </div>
        <div className="rv-count">
          <b>{polls.length}</b> {t("trv.haveSuggestions")}
        </div>
      </div>

      {review.isLoading ? (
        <Spinner />
      ) : polls.length === 0 ? (
        <div className="rv-empty">
          <div className="ei"><Inbox size={23} /></div>
          <h3>{t("trv.emptyTitle")}</h3>
          <p>{t("trv.emptyBody")}</p>
        </div>
      ) : (
        polls.map((poll) => (
          <PollCard key={poll.key} poll={poll} en={enByKey.get(poll.key) ?? poll.key} locale={locale}
            justApproved={justApproved?.key === poll.key ? justApproved.text : null}
            onApprove={approveText} onClear={() => onClear(poll)} onDismiss={onDismiss} />
        ))
      )}
    </Modal>
  );
}

function PollCard({ poll, en, locale, justApproved, onApprove, onClear, onDismiss }: {
  poll: Poll; en: string; locale: string; justApproved: string | null;
  onApprove: (key: string, text: string) => void; onClear: () => void;
  onDismiss: (key: string, text: string) => void;
}) {
  const { t } = useTranslation();
  const [detailOpen, setDetailOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // What everyone using this locale sees right now: override → bundled.
  const currentLive = poll.live ?? (i18n.getResource(locale, "translation", poll.key) as string | undefined) ?? "";
  const maxN = Math.max(...poll.variants.map((v) => v.count));
  const hasLive = poll.variants.some((v) => poll.live !== null && v.text === poll.live);
  const collapsed = poll.variants.length > TOP + 1 && !showAll;
  const shown = collapsed ? poll.variants.slice(0, TOP) : poll.variants;
  const hiddenReplies = collapsed ? poll.variants.slice(TOP).reduce((a, v) => a + v.count, 0) : 0;

  return (
    <div className={`poll-card${detailOpen ? " detailopen" : ""}`}>
      {justApproved && (
        <div className="poll-approved">
          <Check size={17} />
          <span><b>{justApproved}</b> {t("trv.approvedBanner")}</span>
        </div>
      )}
      <div className="poll-top">
        <div className="pt-tx">
          <div className="poll-key">key · {poll.key}</div>
          <div className="poll-en">{blankPlaceholders(en)}</div>
          {/* Show the live-wording line only when it ISN'T already a green bar
              below (avoids the duplicate "LIVE Salva" + green-Salva redundancy). */}
          {!hasLive && (
            <div className="poll-live-now">
              {poll.live ? (
                <>
                  <span className="chip-live"><Check size={12} /> {t("trv.live")}</span>
                  <span className="lv-txt">{blankPlaceholders(poll.live)}</span>
                </>
              ) : (
                <span className="lv-none">{t("trv.noLive")}</span>
              )}
            </div>
          )}
        </div>
        <div className="pt-n">
          <b>{poll.total}</b>{poll.total === 1 ? t("trv.reply1") : t("trv.replyN")}
        </div>
      </div>
      <div className="poll-bars">
        {shown.map((v, i) => (
          <PollBar key={i} v={v} poll={poll} en={en} maxN={maxN} hasLive={hasLive}
            currentLive={currentLive} onApprove={onApprove} />
        ))}
      </div>
      {collapsed && (
        <button type="button" className="poll-more" onClick={() => setShowAll(true)}>
          <ChevronDown size={14} /> {t("trv.showAll", { n: poll.variants.length, m: hiddenReplies })}
        </button>
      )}

      <OwnWordingEditor en={en} onApprove={(text) => onApprove(poll.key, text)} />

      <div className="poll-foot">
        <button type="button" className="poll-exp" onClick={() => setDetailOpen((o) => !o)} aria-expanded={detailOpen}>
          <span className="chev"><ChevronRight size={15} /></span>
          {detailOpen ? t("trv.hideWho") : t("trv.seeWho")}
        </button>
        {poll.live && (
          <button type="button" className="btn-danger clear" onClick={onClear}>{t("trv.clear")}</button>
        )}
      </div>
      {detailOpen && <PollDetail poll={poll} onDismiss={onDismiss} />}
    </div>
  );
}

/** One suggested-variant bar: proportional fill + live/lead/broken flags;
 *  clicking approves (unless it's already live or its placeholders are broken). */
function PollBar({ v, poll, en, maxN, hasLive, currentLive, onApprove }: {
  v: Variant; poll: Poll; en: string; maxN: number; hasLive: boolean; currentLive: string;
  onApprove: (key: string, text: string) => void;
}) {
  const { t } = useTranslation();
  const live = poll.live !== null && v.text === poll.live;
  const matchesCurrent = !live && currentLive !== "" && v.text === currentLive;
  const lead = v.count === maxN && !hasLive;
  const phBroken = !placeholdersIntact(en, v.text);
  return (
    <button type="button"
      className={`poll-bar${live ? " live" : ""}${lead && !live ? " lead" : ""}${phBroken ? " phbad" : ""}`}
      onClick={() => !live && !phBroken && onApprove(poll.key, v.text)}
      disabled={phBroken}
      title={live ? undefined : phBroken ? t("trv.phWarn") : t("trv.makeLive")}>
      <span className="pb-txt">
        <span className="tick"><Check size={14} /></span>
        {blankPlaceholders(v.text)}
        {live && <span className="pb-flag livechip">{t("trv.live")}</span>}
        {matchesCurrent && <span className="pb-flag match">{t("trv.matchesCurrent")}</span>}
        {phBroken && <span className="pb-flag bad"><TriangleAlert size={11} /> {t("trv.phBad")}</span>}
      </span>
      <span className="pb-track">
        <span className="pb-fill" style={{ width: `${Math.max(8, Math.round((v.count / maxN) * 100))}%` }} />
      </span>
      {!live && !phBroken && <span className="pb-approve"><Check size={14} /> {t("trv.makeLive")}</span>}
      <span className="pb-n">
        {v.count}
        <span className="ppl">{v.count === 1 ? t("trv.person1") : t("trv.personN")}</span>
      </span>
    </button>
  );
}

/** §10: superadmin free-text override — type a wording not among the variants. */
function OwnWordingEditor({ en, onApprove }: { en: string; onApprove: (text: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState("");
  if (!open) {
    return (
      <button type="button" className="poll-own-btn" onClick={() => setOpen(true)}>
        <Pencil size={14} /> {t("trv.ownWording")}
      </button>
    );
  }
  return (
    <div className="poll-own open">
      <div className="tr-lbl">{t("trv.ownLabel")}</div>
      <div className="tr-inputrow">
        <textarea className="tr-in" rows={1} placeholder={t("trv.ownPh")} value={own}
          onChange={(e) => setOwn(e.target.value)} />
        <button type="button" className="btn-primary" disabled={!own.trim()}
          onClick={() => { onApprove(restorePlaceholders(en, own)); setOwn(""); setOpen(false); }}>
          <Check size={14} /> {t("trv.makeLive")}
        </button>
      </div>
    </div>
  );
}

/** Who-suggested-what expander, with the per-variant moderation dismiss. */
function PollDetail({ poll, onDismiss }: { poll: Poll; onDismiss: (key: string, text: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="poll-detail">
      {poll.variants.map((v, i) => (
        <div key={i}>
          <div className="grp-h">
            {blankPlaceholders(v.text)} · {v.count}
            {/* Moderation: remove a junk/abusive variant from the poll. */}
            {!(poll.live !== null && v.text === poll.live) && (
              <button type="button" className="btn-ghost grp-dismiss" title={t("trv.dismiss", "Remove suggestion")} aria-label={t("trv.dismiss", "Remove suggestion")}
                onClick={() => onDismiss(poll.key, v.text)}>
                <X size={13} />
              </button>
            )}
          </div>
          {v.users.map((name, j) => (
            <div key={j} className="sub-row">
              <span className="who" title={name}>{name}</span>
              <span className={`said${poll.live !== null && v.text === poll.live ? " win" : ""}`}>{blankPlaceholders(v.text)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
