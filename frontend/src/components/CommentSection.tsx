import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useUsers } from "../users";

interface Comment {
  id: number;
  author: number | null;
  text: string;
  created_at: string;
}

export function CommentSection({ taskId, meId }: { taskId: number; meId: number }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // active @-mention being typed: the query text and where the "@" sits
  const [mention, setMention] = useState<{ query: string; at: number } | null>(null);
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

  function pick(u: { name: string; email: string }) {
    if (!mention) return;
    const name = u.name || u.email;
    const caretEnd = mention.at + 1 + mention.query.length;
    setText(`${text.slice(0, mention.at)}@${name} ${text.slice(caretEnd)}`);
    setMention(null);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!mention || matches.length === 0) return;
    if (e.key === "Enter") { e.preventDefault(); pick(matches[0]); }
    else if (e.key === "Escape") setMention(null);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.post(`/api/tasks/${taskId}/comments`, { text });
      setText("");
      setMention(null);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 14 }}>
      <h3 className="section-title">Comments ({comments.length})</h3>
      {comments.map((c) => (
        <div key={c.id} className="card" style={{ padding: 9, marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <strong>{c.author === meId ? "You" : "Team member"}</strong>
            <span className="muted mono">{c.created_at.slice(0, 10)}</span>
          </div>
          <div style={{ whiteSpace: "pre-wrap", marginTop: 3 }}>{c.text}</div>
        </div>
      ))}
      <form onSubmit={add} style={{ display: "flex", gap: 8, marginTop: 8, position: "relative" }}>
        {matches.length > 0 && (
          <div className="mention-pop">
            {matches.map((u) => (
              <button type="button" key={u.id} className="mention-item" onClick={() => pick(u)}>
                {u.name || u.email}
              </button>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          placeholder="Add a comment… (type @ to mention)"
          value={text}
          onChange={onChange}
          onKeyDown={onKeyDown}
        />
        <button className="btn-secondary" disabled={busy}>Post</button>
      </form>
    </div>
  );
}
