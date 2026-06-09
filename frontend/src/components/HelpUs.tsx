// "Help Us" (design D36/D40/D41): the Settings hub of ask-cards plus the three
// community flows — Report a problem · Suggest a feature · Spread the word.
// Spread the word is the NEW-CENTER REFERRAL (audit ruling §3): it shares the
// self-serve signup link; the join-link/approval concept is v2.

import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Heart, Languages, TriangleAlert, Sparkles, Share2, ChevronRight, Send,
  Paperclip, X, Copy, Mail, MessageCircle, Check, Info, Link2,
} from "lucide-react";
import { api } from "../api/client";
import { Modal, SingleSelect } from "./common";
import { useSubmitGuard } from "../useSubmitGuard";
import { catalogEntries, mergeRows } from "../trCatalog";
import { LANGUAGES } from "../i18n";

/* ---- devotional quotes (D40) — wording is sacred; NEVER run through i18n or
   paraphrase. Verified quotes only (the handoff's two unverified ones are
   omitted pending verification — see the build report). ---- */
export function QuoteBoxed({ text, who }: { text: string; who: string }) {
  return (
    <span className="an-quote">
      <span className="an-qt">{text}</span>
      <span className="an-qw" style={{ display: "block" }}>{who}</span>
    </span>
  );
}

function QuoteLite({ text, who }: { text: string; who: string }) {
  return (
    <p className="an-quote-lite">
      <span className="qt">{text}</span>
      <span className="qw">{who}</span>
    </p>
  );
}

/* =====================================================================
   The hub pane (lives inside Settings → Help Us)
   ===================================================================== */
export type HelpUsFlow = "translate" | "report" | "suggest" | "spread";

export function HelpUsPane({ onOpen }: { onOpen: (flow: HelpUsFlow) => void }) {
  const { t } = useTranslation();
  const phraseCount = mergeRows(catalogEntries()).length;
  const langCount = LANGUAGES.length - 1; // 12 targets; English is the source
  const cards: { flow: HelpUsFlow; icon: ReactNode; title: string; blurb: string; cta: string; meta?: ReactNode }[] = [
    {
      flow: "translate", icon: <Languages size={21} />,
      title: t("helpus.trTitle"), blurb: t("helpus.trBlurb"), cta: t("helpus.trCta"),
      meta: (
        <span>
          <span className="mono">{langCount}</span> {t("helpus.langs")} · <span className="mono">{phraseCount}</span> {t("helpus.phrases")}
        </span>
      ),
    },
    { flow: "report", icon: <TriangleAlert size={21} />, title: t("helpus.repTitle"), blurb: t("helpus.repBlurb"), cta: t("helpus.repCta") },
    { flow: "suggest", icon: <Sparkles size={21} />, title: t("helpus.sugTitle"), blurb: t("helpus.sugBlurb"), cta: t("helpus.sugCta") },
    { flow: "spread", icon: <Share2 size={21} />, title: t("helpus.spreadTitle"), blurb: t("helpus.spreadBlurb"), cta: t("helpus.spreadCta") },
  ];
  return (
    <>
      <div className="hu-head">
        <h3><span className="hu-heart"><Heart size={18} /></span>{t("helpus.title")}</h3>
        {/* lite epigraph between title and description (D40 placement) */}
        <QuoteLite text="Many hands make a miracle." who="Swami Kriyananda" />
        <div className="sub">{t("helpus.sub")}</div>
      </div>
      <div className="hu-stack">
        {cards.map((c) => (
          <div key={c.flow} className="hu-card">
            <div className="hu-ic">{c.icon}</div>
            <div className="hu-tx">
              <div className="hu-t">{c.title}</div>
              <div className="hu-b">{c.blurb}</div>
              {c.meta && <div className="hu-meta">{c.meta}</div>}
            </div>
            <div className="hu-cta">
              <button type="button" className="btn-primary" onClick={() => onOpen(c.flow)}>
                {c.cta} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* =====================================================================
   Shared flow bits
   ===================================================================== */
function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="an-toggle">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className={`an-tg${on ? " on" : ""}`}><span className="an-tg-knob" /></span>
      <span className="an-tg-tx">
        <span className="an-tg-lbl">{label}</span>
        {hint && <span className="an-tg-hint">{hint}</span>}
      </span>
    </label>
  );
}

function SuccessPanel({ title, body, refNo, quote }: { title: string; body: ReactNode; refNo?: string; quote?: { text: string; who: string } }) {
  const { t } = useTranslation();
  return (
    <div className="an-success">
      <div className="an-sx-ic"><Check size={27} /></div>
      <h3>{title}</h3>
      <p>{body}</p>
      {refNo && <div className="an-sx-ref">{t("fb.reference")} <b>{refNo}</b></div>}
      {quote && <QuoteBoxed text={quote.text} who={quote.who} />}
    </div>
  );
}

/** Downscale + JPEG-compress an image file into a small data-URL (≤~300 KB —
 *  the backend hard-caps at 1 MB; storage is in-database, so stay tiny). */
async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.6, 0.4]) {
      const out = canvas.toDataURL("image/jpeg", quality);
      if (out.length < 400_000) return out;
    }
    return canvas.toDataURL("image/jpeg", 0.3);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* =====================================================================
   Report a problem (D41)
   ===================================================================== */
const WHERE_KEYS = ["whThis", "whTasks", "whCal", "whTeam", "whProjects", "whIO", "whAccount", "whOther"];
const SEVERITIES = [
  { key: "minor", labelKey: "fb.sevMinor" },
  { key: "slows", labelKey: "fb.sevSlows" },
  { key: "blocks", labelKey: "fb.sevBlocks" },
];

export function ReportProblemDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [busy, run] = useSubmitGuard();
  const [message, setMessage] = useState("");
  const [where, setWhere] = useState("whThis");
  const [severity, setSeverity] = useState("minor");
  const [shot, setShot] = useState<{ name: string; data: string } | null>(null);
  const [tech, setTech] = useState(true);
  const [sentRef, setSentRef] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setErr("");
    try {
      setShot({ name: file.name, data: await compressImage(file) });
    } catch {
      setErr(t("fb.shotErr"));
    }
  }

  const send = () => run(async () => {
    setErr("");
    try {
      const res = (await api.post("/api/feedback/report", {
        message: message.trim(),
        where,
        severity,
        screenshot: shot?.data ?? "",
        tech: tech
          ? {
              ua: navigator.userAgent,
              page: window.location.pathname + window.location.search,
              viewport: `${window.innerWidth}x${window.innerHeight}`,
              theme: document.documentElement.dataset.theme ?? "",
              lang: document.documentElement.lang,
            }
          : {},
      })) as { ref: string };
      setSentRef(res.ref);
    } catch {
      setErr(t("fb.errSend"));
    }
  });

  if (sentRef) {
    return (
      <Modal icon={<TriangleAlert />} title={t("helpus.repTitle")} onClose={onClose}
        footer={<button type="button" className="btn-primary" onClick={onClose}>{t("common.done", "Done")}</button>}>
        <SuccessPanel title={t("fb.repDoneTitle")} body={t("fb.repDoneBody")} refNo={sentRef} />
      </Modal>
    );
  }
  return (
    <Modal icon={<TriangleAlert />} title={t("helpus.repTitle")} onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
          <button type="button" className="btn-primary" disabled={!message.trim() || busy} onClick={send}>
            <Send size={14} /> {t("fb.send")}
          </button>
        </>
      }>
      <div className="flow-intro"><TriangleAlert size={22} /><p>{t("fb.repIntro")}</p></div>
      <div className="field">
        <label>{t("fb.what")}</label>
        <textarea rows={3} placeholder={t("fb.whatPh")} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <div className="field">
        <label>{t("fb.where")}</label>
        <WhereSelect value={where} onChange={setWhere} keys={WHERE_KEYS} />
      </div>
      <div className="field">
        <label>{t("fb.block")}</label>
        <div className="an-seg">
          {SEVERITIES.map((s) => (
            <button key={s.key} type="button" className={`an-seg-opt${severity === s.key ? " on" : ""}`}
              onClick={() => setSeverity(s.key)}>{t(s.labelKey)}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>{t("fb.shot")}</label>
        {shot ? (
          <div className="an-attach has">
            <span className="an-att-thumb"><img src={shot.data} alt="" /></span>
            <span className="an-att-meta">
              <span className="an-att-nm" title={shot.name}>{shot.name}</span>
              <span className="an-att-sz mono">{Math.round(shot.data.length * 0.75 / 1024)} KB</span>
            </span>
            <button type="button" className="an-att-x" title={t("common.remove", "Remove")} onClick={() => setShot(null)}>
              <X size={15} />
            </button>
          </div>
        ) : (
          <button type="button" className="an-attach" onClick={() => fileRef.current?.click()}>
            <Paperclip size={18} />
            <span className="an-att-tx">{t("fb.attach")} <span className="opt">{t("fb.optional")}</span></span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <div className="an-techbox">
        <Toggle label={t("fb.tech")} hint={t("fb.techHint")} on={tech} onChange={setTech} />
      </div>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</div>}
    </Modal>
  );
}

/** Custom select for the Where/Area pickers (house rule: never native). */
function WhereSelect({ value, onChange, keys }: { value: string; onChange: (v: string) => void; keys: string[] }) {
  const { t } = useTranslation();
  return (
    <SingleSelect width="100%" value={value} onChange={onChange}
      options={keys.map((k) => ({ value: k, label: t(`fb.${k}`) }))} />
  );
}

/* =====================================================================
   Suggest a feature (D41)
   ===================================================================== */
const AREA_KEYS = ["whTasks", "whCal", "whTeam", "whProjects", "whNotif", "whMobile", "whOther"];

export function SuggestFeatureDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [busy, run] = useSubmitGuard();
  const [idea, setIdea] = useState("");
  const [detail, setDetail] = useState("");
  const [area, setArea] = useState("whTasks");
  const [notify, setNotify] = useState(true);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const send = () => run(async () => {
    setErr("");
    try {
      await api.post("/api/feedback/suggest", {
        idea: idea.trim(), detail: detail.trim(), area, notify_when_shipped: notify,
      });
      setSent(true);
    } catch {
      setErr(t("fb.errSend"));
    }
  });

  if (sent) {
    return (
      <Modal icon={<Sparkles />} title={t("helpus.sugTitle")} onClose={onClose}
        footer={<button type="button" className="btn-primary" onClick={onClose}>{t("common.done", "Done")}</button>}>
        <SuccessPanel title={t("fb.sugDoneTitle")} body={t("fb.sugDoneBody")} />
      </Modal>
    );
  }
  return (
    <Modal icon={<Sparkles />} title={t("helpus.sugTitle")} onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>{t("common.cancel")}</button>
          <button type="button" className="btn-primary" disabled={!idea.trim() || busy} onClick={send}>
            <Send size={14} /> {t("fb.sendIdea")}
          </button>
        </>
      }>
      <div className="flow-intro"><Sparkles size={22} /><p>{t("fb.sugIntro")}</p></div>
      <div className="field">
        <label>{t("fb.idea")}</label>
        <input type="text" placeholder={t("fb.ideaPh")} value={idea} onChange={(e) => setIdea(e.target.value)} maxLength={300} />
      </div>
      <div className="field">
        <label>{t("fb.more")} <span className="lbl-opt">{t("fb.optional")}</span></label>
        <textarea rows={3} placeholder={t("fb.morePh")} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </div>
      <div className="field">
        <label>{t("fb.area")}</label>
        <WhereSelect value={area} onChange={setArea} keys={AREA_KEYS} />
      </div>
      <div className="an-techbox">
        <Toggle label={t("fb.notifyShip")} on={notify} onChange={setNotify} />
      </div>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 10 }}>{err}</div>}
    </Modal>
  );
}

/* =====================================================================
   Spread the word (D41 + audit ruling §3: NEW-CENTER REFERRAL)
   Shares the public self-serve signup link — no backend, no member invite.
   ===================================================================== */
export function SpreadWordDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const signupUrl = `${window.location.origin}/?signup`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(signupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard denied — the input stays selectable */ }
  }

  const mailHref = `mailto:?subject=${encodeURIComponent(t("fb.spMailSubject"))}&body=${encodeURIComponent(t("fb.spMailBody", { url: signupUrl }))}`;
  const smsHref = `sms:?body=${encodeURIComponent(t("fb.spMailBody", { url: signupUrl }))}`;

  return (
    <Modal icon={<Share2 />} title={t("helpus.spreadTitle")} onClose={onClose}
      footer={<button type="button" className="btn-secondary" onClick={onClose}>{t("common.close")}</button>}>
      <div className="flow-intro"><Share2 size={22} /><p>{t("fb.spIntro")}</p></div>
      <div className="field">
        <label>{t("fb.spShare")}</label>
        <div className="an-copyrow">
          <span className="an-cr-ic"><Link2 size={15} /></span>
          <input className="an-cr-in" readOnly value={signupUrl} onFocus={(e) => e.target.select()} />
          <button type="button" className={`an-cr-btn ${copied ? "btn-secondary an-cr-done" : "btn-primary"}`} onClick={copy}>
            {copied ? <><Check size={14} /> {t("fb.copied")}</> : <><Copy size={14} /> {t("fb.copy")}</>}
          </button>
        </div>
      </div>
      <div className="an-share">
        <button type="button" className="an-share-b" onClick={copy}>
          <span className="ic"><Copy size={18} /></span>{t("fb.spCopyLink")}
        </button>
        <a className="an-share-b" href={mailHref} style={{ textDecoration: "none" }}>
          <span className="ic"><Mail size={18} /></span>{t("fb.spEmail")}
        </a>
        <a className="an-share-b" href={smsHref} style={{ textDecoration: "none" }}>
          <span className="ic"><MessageCircle size={18} /></span>{t("fb.spMessage")}
        </a>
      </div>
      <div className="an-spread-note"><Info size={15} /> {t("fb.spNote")}</div>
      <div style={{ marginTop: 18 }}>
        <QuoteBoxed
          text="Many hands make a miracle."
          who="Swami Kriyananda"
        />
      </div>
    </Modal>
  );
}
