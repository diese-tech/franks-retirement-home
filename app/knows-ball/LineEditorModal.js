'use client';

import { useState, useEffect } from 'react';
import FrhModal from '@/components/ui/FrhModal';

// Admin modal to open a betting line on a scheduled match.
export default function LineEditorModal({ onClose, onSaved }) {
  const [matches, setMatches] = useState([]);
  const [matchId, setMatchId] = useState('');
  const [teamAOdds, setTeamAOdds] = useState('-110');
  const [teamBOdds, setTeamBOdds] = useState('-110');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/matches?status=scheduled')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMatches(Array.isArray(data) ? data : []))
      .catch(() => setMatches([]));
  }, []);

  const match = matches.find((m) => m.id === matchId);

  const save = async () => {
    setBusy(true); setErr('');
    if (!match) { setErr('Pick a match'); setBusy(false); return; }
    const a = parseInt(teamAOdds, 10);
    const b = parseInt(teamBOdds, 10);
    if (!Number.isInteger(a) || !Number.isInteger(b)) { setErr('Odds must be integers like -110 or +120'); setBusy(false); return; }
    try {
      const res = await fetch('/api/admin/betting-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          teamAId: match.homeTeam.id,
          teamAOdds: a,
          teamBId: match.awayTeam.id,
          teamBOdds: b,
        }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'Failed to open line');
      else onSaved?.();
    } catch {
      setErr('Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FrhModal title="Open a Betting Line" accent="yellow" onClose={onClose}>
      <div className="frh-field">
        <label className="frh-field__label">Scheduled Match</label>
        <select className="frh-select" value={matchId} onChange={(e) => setMatchId(e.target.value)}>
          <option value="">— pick a match —</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {m.homeTeam?.tag} vs {m.awayTeam?.tag}
              {m.week ? ` · Wk ${m.week}` : ''}
              {m.division?.name ? ` · ${m.division.name}` : ''}
            </option>
          ))}
        </select>
        {matches.length === 0 && (
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, opacity: 0.55, marginTop: 4 }}>
            No scheduled matches available.
          </div>
        )}
      </div>

      {match && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="frh-field">
            <label className="frh-field__label">{match.homeTeam?.name} odds</label>
            <input className="frh-input" value={teamAOdds} onChange={(e) => setTeamAOdds(e.target.value)} placeholder="-110" />
          </div>
          <div className="frh-field">
            <label className="frh-field__label">{match.awayTeam?.name} odds</label>
            <input className="frh-input" value={teamBOdds} onChange={(e) => setTeamBOdds(e.target.value)} placeholder="+120" />
          </div>
        </div>
      )}

      <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, opacity: 0.55, marginBottom: 10 }}>
        American odds: -110 = bet 110 to win 100; +120 = bet 100 to win 120.
      </div>

      {err && <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#CC3300', marginBottom: 8 }}>{err}</div>}
      <button className="frh-btn frh-btn--primary" onClick={save} disabled={busy || !matchId}>
        {busy ? 'Opening…' : 'Open Line'}
      </button>
    </FrhModal>
  );
}
