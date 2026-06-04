import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useUsers } from "../users";

interface Comment {
  id: number;
  author: number | null;
  text: string;
  created_at: string;
}

export function CommentSection({ taskId, meId, meIsAdmin = false }: { taskId: number; meId: number; meIsAdmin?: boolean }) {
  const { t } = useTranslation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  // active @-mention being typed: the query text and where the "@" sits
  const [mention, setMention] = useState<{ query: string; at: number } | null>(null);
  const [mentionedIds, setMentionedIds] = useState<number[]>([]); // users picked via @
  const inputRef = useRef<HTMLInputElement>(null);
  const users = useUsers();

  function load() {
    api.get(`/api/tasks/${taskId}/comments`).then(setComments).catch(() => setComments([]));
  }
  useEffect(load, [taskId]);

  const matches = mention
    ? users.filter((u) => (u.name || u.email).toLowerCase().includes(mention.query)).slice(0, 6)
    : [];

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setText(val);
    const caret = e.target.selectionStart ?? val.length;
    const m = val.slice(0, caret).match(/@([^\s@]*)$/); // "@" + word chars right before the caret
    setMention(m ? { query: m[1].toLowerCase(), at: caret - m[1].length - 1 } : null);
  }

  function pick(u: { id: number; name: string; email: string }) {
    if (!mention) return;
    const name = u.name || u.email;
    const caretEnd = mention.at + 1 + mention.query.length;
    setText(`${text.slice(0, mention.at)}@${name} ${text.slice(caretEnd)}`);
    setMentionedIds((ids) => (ids.includes(u.id) ? ids : [...ids, u.id]));
    setMention(null);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!mention || matches.length === 0) return;
    if (e.key === "Enter") { e.preventDefault(); pick(matches[0]); }
    else if (e.key === "Escape") setMention(null);
  }

  async function saveEdit() {
    if (!editing) return;
    await api.patch(`/api/comments/${editing.id}`, { text: editing.text });
    setEditing(null);
    load();
  }

  async function del(id: number) {
    if (!confirm("Delete this comment?")) return;
    await api.del(`/api/comments/${id}`);
    load();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    // only keep mentions whose @Name still appears in the final text
    const mentions = mentionedIds.filter((id) => {
      const u = users.find((x) => x.id === id);
      return u && text.includes(`@${u.name || u.email}`);
    });
    setBusy(true);
    try {
      await api.post(`/api/tasks/${taskId}/comments`, { text, mentions });
      setText("");
      setMention(null);
      setMentionedIds([]);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 14 }}>
      <h3 className="section-title">{t("task.comments")} ({comments.length})</h3>
      {comments.map((c) => {
        const canManage = c.author === meId || meIsAdmin;
        return (
          <div key={c.id} className="card" data-testid="comment" style={{ padding: 9, marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, alignItems: "center" }}>
              <strong>{c.author === meId ? "You" : "Team member"}</strong>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="muted mono">{c.created_at.slice(0, 10)}</span>
                {canManage && editing?.id !== c.id && (
                  <>
                    <button type="button" className="btn-ghost" data-testid="comment-edit" style={{ padding: "1px 6px", fontSize: 12 }}
                      onClick={() => setEditing({ id: c.id, text: c.text })}>Edit</button>
                    <button type="button" className="btn-ghost" data-testid="comment-delete" style={{ padding: "1px 6px", fontSize: 12, color: "var(--danger)" }}
                      onClick={() => del(c.id)}>Delete</button>
                  </>
                )}
              </span>
            </div>
            {editing?.id === c.id ? (
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <input data-testid="comment-edit-input" value={editing.text} onChange={(e) => setEditing({ id: c.id, text: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } }} />
                <button type="button" className="btn-primary" data-testid="comment-save" onClick={saveEdit}>Save</button>
                <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            ) : (
              <div style={{ whiteSpace: "pre-wrap", marginTop: 3 }}>{c.text}</div>
            )}
          </div>
        );
      })}
      <form onSubmit={add} style={{ display: "flex", gap: 8, marginTop: 8, position: "relative" }}>
        {matches.length > 0 && (
          <div className="mention-pop" data-testid="mention-popup">
            {matches.map((u) => (
              <button type="button" key={u.id} className="mention-item" data-testid="mention-item" onClick={() => pick(u)}>
                {u.name || u.email}
              </button>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          data-testid="comment-input"
          placeholder={t("task.addComment")}
          value={text}
          onChange={onChange}
          onKeyDown={onKeyDown}
        />
        <button className="btn-secondary" data-testid="comment-post" disabled={busy}>{t("common.post")}</button>
      </form>
    </div>
  );
}
