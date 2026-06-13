// Create-on-the-fly panel for the project/sub-project pickers (Task popup AND the
// AI review rows). Posts a new Project (name + color + emoji) or Sub-project
// (name + color); blank color/emoji let the backend auto-assign. On success the
// parent selects the new entity. Shared so both surfaces behave identically.

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { ColorPicker } from "./common";
import { EmojiPicker } from "./EmojiPicker";

// Sentinel option value for the "+ New project/sub-project" entry in a picker.
export const NEW_OPT = "__new__";

export function InlineCreate({ kind, projectId, onCreated, onCancel }: {
  kind: "project" | "subproject";
  projectId: number;
  onCreated: (entity: unknown) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [emoji, setEmoji] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Synchronous in-flight guard: `busy` updates a tick late, so fast double-clicks
  // could POST twice and create duplicate projects. The ref blocks re-entry now.
  const submitting = useRef(false);

  async function create() {
    const nm = name.trim();
    if (!nm) { setErr(t("tm.nameRequired", "Name is required")); return; }
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setErr("");
    try {
      const entity = kind === "project"
        ? await api.post("/api/projects", { name: nm, color, emoji })
        : await api.post("/api/subprojects", { project: projectId, name: nm, color });
      onCreated(entity);  // unmounts this panel on success
    } catch {
      setErr(t("tm.createFailed", "Couldn't create that — the name may already be taken."));
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="card" data-testid="inline-create"
      style={{ padding: 10, marginBottom: 12, background: "var(--surface-sunk)", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {kind === "project" && <EmojiPicker value={emoji} onPick={setEmoji} title={t("mp.emojiTitle")} />}
      <ColorPicker value={color} onChange={setColor} title={t("mp.colorTitle", "Color")} />
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
        placeholder={kind === "project" ? t("tm.newProjectPh", "New project name") : t("tm.newSubPh", "New sub-project name")}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }}
        style={{ flex: 1, minWidth: 160 }} />
      <button type="button" className="btn-primary" onClick={create} disabled={busy}>{t("common.create", "Create")}</button>
      <button type="button" className="btn-ghost" onClick={onCancel}>{t("common.cancel")}</button>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, width: "100%" }}>{err}</div>}
    </div>
  );
}
