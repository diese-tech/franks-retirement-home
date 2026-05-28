'use client';

import { useState } from 'react';
import FrhModal from '@/components/ui/FrhModal';

const TYPES = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'match_hype', label: 'Match Hype' },
  { value: 'player_spotlight', label: 'Player Spotlight' },
  { value: 'team_roast', label: 'Team Roast' },
  { value: 'weekly_recap', label: 'Weekly Recap' },
];

// Admin create/edit modal. `post` = existing post (edit) or null (create).
export default function PostEditorModal({ post, onClose, onSaved }) {
  const editing = Boolean(post);
  const [form, setForm] = useState({
    title: post?.title || '',
    type: post?.type || 'announcement',
    body: post?.body || '',
    excerpt: post?.excerpt || '',
    pinned: post?.pinned || false,
    status: post?.status || 'draft',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (publish) => {
    setBusy(true);
    setErr('');
    const payload = { ...form, status: publish ? 'published' : form.status };
    try {
      const url = editing ? `/api/admin/bulletin/${post.id}` : '/api/admin/bulletin';
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Save failed'); }
      else { onSaved?.(); }
    } catch {
      setErr('Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FrhModal title={editing ? 'Edit Post' : 'New Bulletin Post'} accent="blue" onClose={onClose}>
      <div className="frh-field">
        <label className="frh-field__label">Title</label>
        <input className="frh-input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Headline" />
      </div>
      <div className="frh-field">
        <label className="frh-field__label">Type</label>
        <select className="frh-select" value={form.type} onChange={(e) => set('type', e.target.value)}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div className="frh-field">
        <label className="frh-field__label">Excerpt (optional)</label>
        <input className="frh-input" value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} placeholder="One-line teaser" />
      </div>
      <div className="frh-field">
        <label className="frh-field__label">Body</label>
        <textarea className="frh-textarea" value={form.body} onChange={(e) => set('body', e.target.value)} placeholder="Write the post… (line breaks become paragraphs)" />
      </div>
      <div className="frh-field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input id="pinned" type="checkbox" checked={form.pinned} onChange={(e) => set('pinned', e.target.checked)} />
        <label htmlFor="pinned" className="frh-field__label" style={{ margin: 0 }}>Pin to top</label>
      </div>

      {err && <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#CC3300', marginBottom: 8 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="frh-btn" onClick={() => save(false)} disabled={busy || !form.title.trim() || !form.body.trim()}>
          {busy ? 'Saving…' : 'Save Draft'}
        </button>
        <button className="frh-btn frh-btn--primary" onClick={() => save(true)} disabled={busy || !form.title.trim() || !form.body.trim()}>
          {busy ? 'Saving…' : 'Publish'}
        </button>
      </div>
    </FrhModal>
  );
}
