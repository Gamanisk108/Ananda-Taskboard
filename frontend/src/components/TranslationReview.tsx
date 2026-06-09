// Translation review — the superadmin "poll graph" (design D38). One horizontal
// bar per distinct suggested variant, length = submitters, calm azure (NOT
// status colors); the live variant gets the green check + chip. Approving goes
// live app-wide instantly (runtime overrides, no redeploy) so it confirms first.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Languages, Check, ChevronRight, Inbox, TriangleAlert } from "lucide-react";
import { LANGUAGES } from "../i18n";
import { api } from "../api/client";
import { catalogEntries, placeholdersIntact } from "../trCatalog";
import { Modal, SingleSelect, Spinner } from "./common";
import { useConfirm } from "./confirm";

interface Variant { text: string; count: number; users: string[] }
interface Poll { key: string; live: string | null; total: number; variants: Variant[] }

export function TranslationReview({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const targets = LANGUAGES.filter((l) => l.code !== "en");
  const [locale, setLocale] = useState(targets[0].code);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
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
  // Suggestions for keys that no longer exist in the catalog are hidden
  // (catalog drift after a deploy — audit ruling: silently hide).
  const polls = (review.data ?? []).filter((p) => enByKey.has(p.key));

  const localeLabel = targets.find((l) => l.code === locale)?.label ?? locale;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["tr-review", locale] });
    queryClient.invalidateQueries({ queryKey: ["tr-overrides", locale] });
  }

  const approve = useMutation({
    mutationFn: (v: { key: string; text: string }) =>
      api.post("/api/translations/approve", { locale, key: v.key, text: v.text }),
    onSuccess: (_d, v) => { setJustApproved(v); refresh(); },
  });
  const clear = useMutation({
    mutationFn: (key: string) => api.del("/api/translations/override", { locale, key }),
    onSuccess: () => { setJustApproved(null); refresh(); },
  });

  async function onApprove(poll: Poll, variant: Variant) {
    const en = enByKey.get(poll.key) ?? "";
    const phBroken = !placeholdersIntact(en, variant.text);
    const ok = await confirm({
      title: t("trv.confirmTitle"),
      danger: false,
      confirmLabel: t("trv.confirmCta"),
      body: (
        <>
          <p style={{ margin: 0 }}>{t("trv.confirmBody", { lang: localeLabel })}</p>
          <div className="cf-quote">
            <span className="lang">{localeLabel} · “{en}”</span>
            {variant.text}
          </div>
          {phBroken && (
            <p style={{ color: "var(--danger)", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
              <TriangleAlert size={14} /> {t("trv.phWarn")}
            </p>
          )}
        </>
      ),
    });
    if (ok) approve.mutate({ key: poll.key, text: variant.text });
  }

  async function onClear(poll: Poll) {
    const ok = await confirm({
      body: t("trv.clearConfirm", { key: enByKey.get(poll.key) ?? poll.key }),
      danger: true,
      confirmLabel: t("trv.clear"),
    });
    if (ok) clear.mutate(poll.key);
  }

  return (
    <Modal icon={<Languages />} title={t("trv.title")} onClose={onClose} wide>
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
        polls.map((poll) => {
          const en = enByKey.get(poll.key) ?? poll.key;
          const maxN = Math.max(...poll.variants.map((v) => v.count));
          const hasLive = poll.variants.some((v) => poll.live !== null && v.text === poll.live);
          const detailOpen = openDetail === poll.key;
          return (
            <div key={poll.key} className={`poll-card${detailOpen ? " detailopen" : ""}`}>
              {justApproved?.key === poll.key && (
                <div className="poll-approved">
                  <Check size={17} />
                  <span><b>{justApproved.text}</b> {t("trv.approvedBanner")}</span>
                </div>
              )}
              <div className="poll-top">
                <div className="pt-tx">
                  <div className="poll-key">key · {poll.key}</div>
                  <div className="poll-en">{en}</div>
                  <div className="poll-live-now">
                    {poll.live ? (
                      <>
                        <span className="chip-live"><Check size={12} /> {t("trv.live")}</span>
                        <span className="lv-txt">{poll.live}</span>
                      </>
                    ) : (
                      <span className="lv-none">{t("trv.noLive")}</span>
                    )}
                  </div>
                </div>
                <div className="pt-n">
                  <b>{poll.total}</b>{poll.total === 1 ? t("trv.reply1") : t("trv.replyN")}
                </div>
              </div>
              <div className="poll-bars">
                {poll.variants.map((v, i) => {
                  const live = poll.live !== null && v.text === poll.live;
                  const lead = v.count === maxN && !hasLive;
                  const phBroken = !placeholdersIntact(en, v.text);
                  return (
                    <button key={i} type="button"
                      className={`poll-bar${live ? " live" : ""}${lead && !live ? " lead" : ""}`}
                      onClick={() => !live && onApprove(poll, v)}
                      title={live ? undefined : t("trv.makeLive")}>
                      <span className="pb-txt">
                        <span className="tick"><Check size={14} /></span>
                        {v.text}
                        {phBroken && <span className="poll-warn" title={t("trv.phWarn")}><TriangleAlert size={13} /></span>}
                      </span>
                      <span className="pb-track">
                        <span className="pb-fill" style={{ width: `${Math.max(8, Math.round((v.count / maxN) * 100))}%` }} />
                      </span>
                      {!live && <span className="pb-approve"><Check size={14} /> {t("trv.makeLive")}</span>}
                      <span className="pb-n">
                        {v.count}
                        <span className="ppl">{v.count === 1 ? t("trv.person1") : t("trv.personN")}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="poll-foot">
                <button type="button" className="poll-exp" onClick={() => setOpenDetail(detailOpen ? null : poll.key)}
                  aria-expanded={detailOpen}>
                  <span className="chev"><ChevronRight size={15} /></span>
                  {detailOpen ? t("trv.hideWho") : t("trv.seeWho")}
                </button>
                {poll.live && (
                  <button type="button" className="btn-danger clear" onClick={() => onClear(poll)}>
                    {t("trv.clear")}
                  </button>
                )}
              </div>
              {detailOpen && (
                <div className="poll-detail">
                  {poll.variants.map((v, i) => (
                    <div key={i}>
                      <div className="grp-h">{v.text} · {v.count}</div>
                      {v.users.map((name, j) => (
                        <div key={j} className="sub-row">
                          <span className="who" title={name}>{name}</span>
                          <span className={`said${poll.live !== null && v.text === poll.live ? " win" : ""}`}>{v.text}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </Modal>
  );
}
