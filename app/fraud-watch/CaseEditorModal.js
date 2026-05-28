'use client';

import { useState, useEffect } from 'react';
import FrhModal from '@/components/ui/FrhModal';

// Admin file/edit modal for editorial cases. `c` = existing case or null (new).
export default function CaseEditorModal({ c, defaultType = 'fraud_watch', onClose, onSaved }) {
  const editing = Boolean(c);
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState({
    type: c?.type || defaultType,
    title: c?.title || '',
    charge: c?.charge || '',
    body: c?.body || '',
    relatedPlayerId: c?.relatedPlayer?.id || '',
    status: c?.status || 'draft',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/players')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPlayers(Array.isArray(data) ? data : []))
      .catch(() => setPlayers([]));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (publish) => {
    setBusy(true); setErr('');
    const payload = {
      type: form.type,
      title: form.title,
      charge: form.charge,
      body: form.body,
      relatedPlayerId: form.relatedPlayerId || null,
      status: publish ? 'published' : form.status,
    };
    try {
      const url = editing ? `/api/admin/editorial-cases/${c.id}` : '/api/admin/editorial-cases';
      const res = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'Save failed');
      else onSaved?.();
    } catch {
      setErr('Network error');
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/admin/editorial-cases/${c.id}`, { method: 'DELETE' });
      if (res.ok) onSaved?.();
      else setErr('Delete failed');
    } catch { setErr('Network error'); } finally { setBusy(false); }
  };

  return (
    <FrhModal title={editing ? 'Edit Case' : 'File a Case'} accent="red" onClose={onClose}>
      <div className="frh-field">
        <label className="frh-field__label">Case Type</label>
        <select className="frh-select" value={form.type} onChange={(e) => set('type', e.target.value)}>
          <option value="fraud_watch">Fraud Watch</option>
          <option value="washed_report">Washed Report</option>
        </select>
      </div>
      <div className="frh-field">
        <label className="frh-field__label">Title</label>
        <input className="frh-input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Case headline" />
      </div>
      <div className="frh-field">
        <label className="frh-field__label">Subject (player, optional)</label>
        <select className="frh-select" value={form.relatedPlayerId} onChange={(e) => set('relatedPlayerId', e.target.value)}>
          <option value="">— none —</option>
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}{p.role ? ` (${p.role})` : ''}</option>)}
        </select>
      </div>
      <div className="frh-field">
        <label className="frh-field__label">Charge (optional)</label>
        <input className="frh-input" value={form.charge} onChange={(e) => set('charge', e.target.value)} placeholder="e.g. Stat-padding in garbage time" />
      </div>
      <div className="frh-field">
        <label className="frh-field__label">Body</label>
        <textarea className="frh-textarea" value={form.body} onChange={(e) => set('body', e.target.value)} placeholder="The case against them…" />
      </div>
      {err && <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#CC3300', marginBottom: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="frh-btn" onClick={() => save(false)} disabled={busy || !form.title.trim()}>{busy ? 'Saving…' : 'Save Draft'}</button>
        <button className="frh-btn frh-btn--primary" onClick={() => save(true)} disabled={busy || !form.title.trim()}>{busy ? 'Saving…' : 'Publish'}</button>
        {editing && <button className="frh-btn frh-btn--danger" onClick={del} disabled={busy}>Delete</button>}
      </div>
    </FrhModal>
  );
}
