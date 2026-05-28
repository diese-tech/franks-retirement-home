'use client';

import { useState } from 'react';

function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommentThread({ postId, initialCount = 0, canComment }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState(null); // null = not loaded
  const [count, setCount] = useState(initialCount);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const res = await fetch(`/api/bulletin/${postId}/comments`);
      const data = await res.json();
      if (res.ok) {
        setComments(data.comments || []);
        setCount((data.comments || []).length);
      }
    } catch {
      setComments([]);
    }
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && comments === null) load();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy || !draft.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/bulletin/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Could not post comment');
      } else {
        setComments((c) => [...(c || []), data]);
        setCount((n) => n + 1);
        setDraft('');
      }
    } catch {
      setErr('Network error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      const res = await fetch(`/api/bulletin/comments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setComments((c) => c.filter((x) => x.id !== id));
        setCount((n) => Math.max(0, n - 1));
      }
    } catch { /* ignore */ }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={toggleOpen}
        style={{
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: 'var(--frh-deep-blue)',
          padding: 0,
        }}
      >
        💬 {count} comment{count === 1 ? '' : 's'} {open ? '▲' : '▼'}
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          {comments === null ? (
            <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.5 }}>Loading…</div>
          ) : comments.length === 0 ? (
            <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.5 }}>
              No comments yet. Start the banter.
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="comment">
                <div className="comment__head">
                  <span className="comment__author">{c.authorName}</span>
                  <span className="comment__time">{timeAgo(c.createdAt)}</span>
                  {c.isOwn && (
                    <button type="button" className="comment__del" onClick={() => remove(c.id)}>
                      delete
                    </button>
                  )}
                </div>
                <div className="comment__body">{c.body}</div>
              </div>
            ))
          )}

          {canComment ? (
            <form onSubmit={submit} style={{ marginTop: 10 }}>
              <textarea
                className="frh-textarea"
                style={{ minHeight: 60 }}
                placeholder="Add a comment…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={1000}
              />
              {err && (
                <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#CC3300', marginTop: 4 }}>{err}</div>
              )}
              <button
                type="submit"
                className="frh-btn frh-btn--primary"
                style={{ marginTop: 6 }}
                disabled={busy || !draft.trim()}
              >
                {busy ? 'Posting…' : 'Post Comment'}
              </button>
            </form>
          ) : (
            <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, opacity: 0.55, marginTop: 8 }}>
              Log in as a league member to comment.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
