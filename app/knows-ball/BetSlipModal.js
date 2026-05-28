'use client';

import { useState } from 'react';
import FrhModal from '@/components/ui/FrhModal';

function formatOdds(n) {
  if (!n && n !== 0) return 'EVEN';
  return n >= 0 ? `+${n}` : `${n}`;
}

function computePayout(stake, odds) {
  if (!stake || Number.isNaN(stake)) return 0;
  const profit = odds >= 0 ? stake * (odds / 100) : stake * (100 / Math.abs(odds));
  return Math.round(stake + profit);
}

// Player bet slip. Places a bet against an open line; wallet opens on first bet.
export default function BetSlipModal({ line, balance, onClose, onPlaced }) {
  const teamA = line.teamA;
  const teamB = line.teamB;
  const [pick, setPick] = useState(teamA?.id || '');
  const [stake, setStake] = useState('100');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);

  const odds = pick === line.teamAId ? line.teamAOdds : line.teamBOdds;
  const stakeNum = parseInt(stake, 10);
  const payout = computePayout(stakeNum, odds);

  const place = async () => {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineId: line.id, selectedTeamId: pick, stake: stakeNum }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'Bet failed');
      else { setDone(data); onPlaced?.(data.balance); }
    } catch {
      setErr('Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FrhModal title="Place a Bet" accent="lime" onClose={onClose}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontFamily: 'Boogaloo, cursive', fontSize: 22, marginBottom: 8 }}>🎟️ Bet Placed!</div>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
            Potential return: {done.bet?.potentialPayout} pts
          </div>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, opacity: 0.7, marginBottom: 16 }}>
            New balance: {done.balance} pts
          </div>
          <button className="frh-btn frh-btn--primary" onClick={onClose}>Done</button>
        </div>
      ) : (
        <>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, opacity: 0.65, marginBottom: 12 }}>
            {teamA?.name} vs {teamB?.name}
            {typeof balance === 'number' && <span> · Balance: {balance} pts</span>}
          </div>

          <div className="frh-field">
            <label className="frh-field__label">Your Pick</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[teamA, teamB].map((t, i) => {
                const tid = t?.id;
                const o = i === 0 ? line.teamAOdds : line.teamBOdds;
                return (
                  <button
                    key={tid}
                    type="button"
                    className={`filter-chip${pick === tid ? ' is-active' : ''}`}
                    style={{ flex: 1, textAlign: 'center' }}
                    onClick={() => setPick(tid)}
                  >
                    {t?.tag} {formatOdds(o)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="frh-field">
            <label className="frh-field__label">Stake (points)</label>
            <input className="frh-input" value={stake} onChange={(e) => setStake(e.target.value)} inputMode="numeric" />
          </div>

          <div style={{ fontFamily: 'Boogaloo, cursive', fontSize: 16, marginBottom: 12 }}>
            Potential return: <span style={{ color: 'var(--frh-deep-blue)' }}>{payout} pts</span>
          </div>

          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, opacity: 0.5, marginBottom: 10 }}>
            First bet opens your wallet with 1,500 starter points. FRH fantasy points only — no real money.
          </div>

          {err && <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#CC3300', marginBottom: 8 }}>{err}</div>}
          <button className="frh-btn frh-btn--primary" onClick={place} disabled={busy || !pick || !(stakeNum >= 10)}>
            {busy ? 'Placing…' : 'Place Bet'}
          </button>
        </>
      )}
    </FrhModal>
  );
}
