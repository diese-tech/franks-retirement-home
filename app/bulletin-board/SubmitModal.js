'use client';

import { useState } from 'react';
import FrhModal from '@/components/ui/FrhModal';

const TYPES = [
  { value: 'match_hype', label: 'Match Hype' },
  { value: 'player_spotlight', label: 'Player Spotlight' },
  { value: 'team_roast', label: 'Team Roast' },
];

// Player-submitted post modal. Lands as a draft for admin review.
export default function SubmitModal({ onClose }) {
  const [form, setForm] = useState({ title: '', type: 'match_hype', body: '', excerpt: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/bulletin/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Submit failed'); }
      else { setDone(data.message || 'Submitted for review!'); }
    } catch {
      setErr('Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FrhModal title="Submit a Post" accent="lime" onClose={onClose}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontFamily: 'Boogaloo, cursive', fontSize: 22, marginBottom: 8 }}>📨 Sent!</div>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, opacity: 0.7, marginBottom: 16 }}>{done}</div>
          <button className="frh-btn frh-btn--primary" onClick={onClose}>Close</button>
        </div>
      ) : (
        <>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.65, marginBottom: 12, lineHeight: 1.5 }}>
            Posts from players land in the editor queue and go live after review.
          </div>
          <div className="frh-field">
            <label className="frh-field__label">Title</label>
            <input className="frh-input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Your headline" />
          </div>
          <div className="frh-field">
            <label className="frh-field__label">Type</label>
            <select className="frh-select" value={form.type} onChange={(e) => set('type', e.target.value)}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="frh-field">
            <label className="frh-field__label">Body</label>
            <textarea className="frh-textarea" value={form.body} onChange={(e) => set('body', e.target.value)} placeholder="Make your case…" />
          </div>
          {err && <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#CC3300', marginBottom: 8 }}>{err}</div>}
          <button className="frh-btn frh-btn--primary" onClick={submit} disabled={busy || !form.title.trim() || !form.body.trim()}>
            {busy ? 'Submitting…' : 'Submit for Review'}
          </button>
        </>
      )}
    </FrhModal>
  );
}
