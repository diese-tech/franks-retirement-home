'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FrhModal from '@/components/ui/FrhModal';

// Weekly Superlatives panel. Admins edit/add directly; players suggest new ones.
export default function SuperlativesPanel({ superlatives, isAdmin, canSuggest }) {
  const router = useRouter();
  const [modal, setModal] = useState(null); // { mode: 'edit'|'add'|'suggest', item? }

  return (
    <div className="frh-panel">
      <header className="frh-panel__titlebar frh-panel__titlebar--purple">
        <div className="frh-panel__ttl">
          <span className="frh-panel__accent" />
          🏅 Weekly Superlatives
        </div>
        <div className="frh-panel__chips">
          <span className="frh-panel__chip">_</span>
          <span className="frh-panel__chip">&#9633;</span>
          <span className="frh-panel__chip">&times;</span>
        </div>
      </header>
      <div className="frh-panel__body" style={{ padding: '10px 12px' }}>
        {superlatives.length === 0 ? (
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.55, textAlign: 'center', padding: '12px 0' }}>
            No superlatives yet.
          </div>
        ) : (
          superlatives.map((s) => (
            <div key={s.id} className="superlative">
              <div className="superlative__title">
                {s.weekLabel && <span style={{ fontSize: 9, opacity: 0.5, fontFamily: 'Share Tech Mono, monospace' }}>{s.weekLabel}</span>}
                {s.title}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setModal({ mode: 'edit', item: s })}
                    style={{ marginLeft: 'auto', fontSize: 9, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--frh-deep-blue)', fontFamily: 'Share Tech Mono, monospace' }}
                  >
                    edit
                  </button>
                )}
              </div>
              {s.nominee && <div className="superlative__nominee">🏆 {s.nominee}</div>}
              {s.description && <div className="superlative__desc">{s.description}</div>}
            </div>
          ))
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {isAdmin && (
            <button className="frh-btn" onClick={() => setModal({ mode: 'add' })}>+ Add</button>
          )}
          <button className="frh-btn" onClick={() => setModal({ mode: 'suggest' })}>💡 Suggest one</button>
        </div>
      </div>

      {modal && (
        <SuperlativeModal
          mode={modal.mode}
          item={modal.item}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); router.refresh(); }}
          canSuggest={canSuggest}
        />
      )}
    </div>
  );
}

function SuperlativeModal({ mode, item, onClose, onSaved, canSuggest }) {
  const isSuggest = mode === 'suggest';
  const editing = mode === 'edit';
  const [form, setForm] = useState({
    title: item?.title || '',
    nominee: item?.nominee || '',
    description: item?.description || '',
    weekLabel: item?.weekLabel || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true); setErr('');
    try {
      let res;
      if (isSuggest) {
        res = await fetch('/api/superlatives/suggest', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: form.title, description: form.description, nominee: form.nominee }),
        });
      } else if (editing) {
        res = await fetch(`/api/admin/superlatives/${item.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch('/api/admin/superlatives', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Save failed'); }
      else if (isSuggest) { setDone(data.message || 'Suggestion sent!'); }
      else { onSaved?.(); }
    } catch {
      setErr('Network error');
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/admin/superlatives/${item.id}`, { method: 'DELETE' });
      if (res.ok) onSaved?.();
      else setErr('Delete failed');
    } catch { setErr('Network error'); } finally { setBusy(false); }
  };

  const title = isSuggest ? 'Suggest a Superlative' : editing ? 'Edit Superlative' : 'New Superlative';

  return (
    <FrhModal title={title} accent="purple" onClose={onClose}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontFamily: 'Boogaloo, cursive', fontSize: 22, marginBottom: 8 }}>💡 Sent!</div>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, opacity: 0.7, marginBottom: 16 }}>{done}</div>
          <button className="frh-btn frh-btn--primary" onClick={onClose}>Close</button>
        </div>
      ) : (
        <>
          {isSuggest && !canSuggest && (
            <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#CC3300', marginBottom: 10 }}>
              Heads up: only logged-in league members can submit suggestions.
            </div>
          )}
          <div className="frh-field">
            <label className="frh-field__label">Title</label>
            <input className="frh-input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Beer League MVP" />
          </div>
          <div className="frh-field">
            <label className="frh-field__label">Nominee (optional)</label>
            <input className="frh-input" value={form.nominee} onChange={(e) => set('nominee', e.target.value)} placeholder="Who takes it?" />
          </div>
          <div className="frh-field">
            <label className="frh-field__label">Description (optional)</label>
            <input className="frh-input" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Why?" />
          </div>
          {!isSuggest && (
            <div className="frh-field">
              <label className="frh-field__label">Week label (optional)</label>
              <input className="frh-input" value={form.weekLabel} onChange={(e) => set('weekLabel', e.target.value)} placeholder="e.g. Week 4" />
            </div>
          )}
          {err && <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#CC3300', marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="frh-btn frh-btn--primary" onClick={save} disabled={busy || !form.title.trim()}>
              {busy ? 'Saving…' : isSuggest ? 'Send Suggestion' : 'Save'}
            </button>
            {editing && (
              <button className="frh-btn frh-btn--danger" onClick={del} disabled={busy}>Delete</button>
            )}
          </div>
        </>
      )}
    </FrhModal>
  );
}
