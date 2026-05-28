'use client';

import { useState } from 'react';

// Beer-league themed reaction palette. Keys match REACTION_EMOJI server-side.
const PALETTE = [
  { key: 'beer',  glyph: '🍺', label: 'Cheers' },
  { key: 'fire',  glyph: '🔥', label: 'Heater' },
  { key: 'skull', glyph: '💀', label: 'Washed' },
  { key: 'goat',  glyph: '🐐', label: 'GOAT' },
  { key: 'clown', glyph: '🤡', label: 'Fraud' },
];

export default function ReactionBar({ postId, initialCounts = {}, canReact }) {
  const [counts, setCounts] = useState(initialCounts);
  const [mine, setMine] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const toggle = async (emoji) => {
    if (busy) return;
    if (!canReact) {
      setErr('Log in as a league member to react.');
      setTimeout(() => setErr(''), 2500);
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/bulletin/${postId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Could not react');
        setTimeout(() => setErr(''), 2500);
      } else {
        setCounts(data.counts || {});
        setMine((m) => ({ ...m, [emoji]: data.reacted }));
      }
    } catch {
      setErr('Network error');
      setTimeout(() => setErr(''), 2500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="reaction-bar">
        {PALETTE.map((r) => {
          const count = counts[r.key] || 0;
          return (
            <button
              key={r.key}
              type="button"
              className={`reaction-btn${mine[r.key] ? ' is-on' : ''}`}
              onClick={() => toggle(r.key)}
              title={r.label}
              disabled={busy}
            >
              <span>{r.glyph}</span>
              {count > 0 && <span className="reaction-btn__count">{count}</span>}
            </button>
          );
        })}
      </div>
      {err && (
        <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#CC3300', marginTop: 4 }}>
          {err}
        </div>
      )}
    </div>
  );
}
