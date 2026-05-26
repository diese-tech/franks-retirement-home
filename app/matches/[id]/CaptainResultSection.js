'use client';

import { useState, useCallback } from 'react';

async function apiResult(matchId, gameId, method, body, captainKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (captainKey) {
    headers['X-Captain-Key'] = captainKey;
  }
  const res = await fetch(`/api/matches/${matchId}/games/${gameId}/result`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// ─── Individual game result card ─────────────────────────────────────────────

function GameResultCard({ matchId, captainKey, captainSide, game, homeTeam, awayTeam, onUpdate }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const myTeam = captainSide === 'home' ? homeTeam : awayTeam;
  const opposingTeam = captainSide === 'home' ? awayTeam : homeTeam;

  // Which team reported (if any)
  const iReported = game.reportedByTeamId === myTeam.id;
  const theyReported = game.reportedByTeamId === opposingTeam.id;

  const report = async (winnerTeamId) => {
    setBusy(true);
    setError('');
    const { ok, data } = await apiResult(matchId, game.id, 'POST', { winnerTeamId }, captainKey);
    setBusy(false);
    if (!ok) { setError(data.error ?? 'Failed to report result'); return; }
    onUpdate();
  };

  const respond = async (action) => {
    setBusy(true);
    setError('');
    const { ok, data } = await apiResult(matchId, game.id, 'PATCH', { action }, captainKey);
    setBusy(false);
    if (!ok) { setError(data.error ?? 'Failed to respond'); return; }
    onUpdate();
  };

  // Only show this card for games that have a completed draft and no confirmed result
  if (!game.draft || game.draft.status !== 'complete') return null;
  if (game.resultStatus === 'confirmed') return null;

  const reportedWinnerName = game.reportedWinnerTeamId === homeTeam.id ? homeTeam.name : awayTeam.name;

  return (
    <div className="border-2 border-frh-border bg-frh-base/40 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-ui text-xs uppercase tracking-widest text-gray-400">Game {game.gameNumber} — Report Result</span>
        {game.resultStatus === 'reported' && (
          <span className="font-mono text-[10px] text-orange-400 uppercase">
            {iReported ? 'Awaiting opposing captain' : 'Your confirmation needed'}
          </span>
        )}
        {game.resultStatus === 'disputed' && (
          <span className="font-mono text-[10px] text-red-400 uppercase">Disputed — admin resolving</span>
        )}
      </div>

      {/* No result yet — show report buttons */}
      {!game.resultStatus && (
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 font-mono">Who won Game {game.gameNumber}?</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => report(homeTeam.id)}
              disabled={busy}
              className="flex-1 py-1.5 font-ui text-xs uppercase tracking-wide border-2 border-frh-yellow text-frh-yellow hover:bg-frh-yellow/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? '…' : `${homeTeam.name} won`}
            </button>
            <button
              onClick={() => report(awayTeam.id)}
              disabled={busy}
              className="flex-1 py-1.5 font-ui text-xs uppercase tracking-wide border-2 border-frh-yellow text-frh-yellow hover:bg-frh-yellow/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? '…' : `${awayTeam.name} won`}
            </button>
          </div>
        </div>
      )}

      {/* Result reported — waiting captain reported it, or opposing captain needs to respond */}
      {game.resultStatus === 'reported' && iReported && (
        <p className="text-[10px] font-mono text-gray-500">
          You reported <span className="text-frh-yellow">{reportedWinnerName}</span> won.
          Waiting for the opposing captain to confirm.
        </p>
      )}

      {game.resultStatus === 'reported' && theyReported && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-gray-400">
            Opposing captain reported: <span className="text-frh-yellow">{reportedWinnerName}</span> won. Correct?
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => respond('confirm')}
              disabled={busy}
              className="flex-1 py-1.5 font-ui text-xs uppercase tracking-wide border-2 border-frh-lime text-frh-lime hover:bg-frh-lime/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? '…' : 'Confirm'}
            </button>
            <button
              onClick={() => respond('dispute')}
              disabled={busy}
              className="flex-1 py-1.5 font-ui text-xs uppercase tracking-wide border-2 border-red-500 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? '…' : 'Dispute'}
            </button>
          </div>
        </div>
      )}

      {game.resultStatus === 'disputed' && (
        <p className="text-[10px] font-mono text-gray-500">
          This result is disputed and requires admin resolution before the series can continue.
        </p>
      )}

      {error && <p className="font-mono text-[10px] text-red-400">{error}</p>}
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export default function CaptainResultSection({
  matchId,
  captainKey,
  captainSide,
  games,
  homeTeam,
  awayTeam,
}) {
  const refresh = useCallback(() => {
    // Full page re-fetch via router is cleaner than local state here;
    // for now a simple window reload keeps the server-rendered page fresh.
    if (typeof window !== 'undefined') window.location.reload();
  }, []);

  // Only show games that need captain result action
  const actionableGames = games.filter(
    (g) => g.draft?.status === 'complete' && g.resultStatus !== 'confirmed',
  );

  if (actionableGames.length === 0) return null;

  return (
    <div className="border-t-2 border-frh-border pt-6 mt-6 space-y-4">
      <h2 className="font-ui text-xs uppercase tracking-widest text-frh-text-muted">Report Game Results</h2>
      <p className="font-mono text-[10px] text-gray-600">
        After each game, report the winner. The opposing captain must confirm before the series score updates and the next draft unlocks.
        Screenshots for stats can be uploaded after the full set is complete.
      </p>
      {actionableGames.map((game) => (
        <GameResultCard
          key={game.id}
          matchId={matchId}
          captainKey={captainKey}
          captainSide={captainSide}
          game={game}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          onUpdate={refresh}
        />
      ))}
    </div>
  );
}
