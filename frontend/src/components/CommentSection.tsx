import { useEffect, useState } from "react";
import { api } from "../api/client";

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

  function load() {
    api.get(`/api/tasks/${taskId}/comments`).then(setComments).catch(() => setComments([]));
  }
  useEffect(load, [taskId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.post(`/api/tasks/${taskId}/comments`, { text });
      setText("");
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
      <form onSubmit={add} style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input placeholder="Add a comment…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-secondary" disabled={busy}>Post</button>
      </form>
    </div>
  );
}
