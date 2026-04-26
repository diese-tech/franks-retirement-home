'use client';

import { useState, useMemo } from 'react';
import { ROLE_COLORS, PLAYER_ROLES } from '@/lib/constants';

export default function LobbyView({ state, role, callApi }) {
  const { draft, picks, players } = state;
  const [swapTarget, setSwapTarget] = useState(null); // { pickId, team, currentPlayerId }
  const [swapFilter, setSwapFilter] = useState('All');
  const [swapSearch, setSwapSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isAdmin = role === 'admin';
  const myTeam = role === 'captainA' ? 'A' : role === 'captainB' ? 'B' : null;

  const pickedIds = useMemo(() => new Set(picks.map((p) => p.playerId)), [picks]);
  const freeAgents = useMemo(() => {
    return players.filter((p) => {
      if (pickedIds.has(p.id)) return false;
      if (swapFilter !== 'All' && p.role !== swapFilter) return false;
      if (swapSearch && !p.name.toLowerCase().includes(swapSearch.toLowerCase())) return false;
      return true;
    });
  }, [players, pickedIds, swapFilter, swapSearch]);

  const teamA = picks.filter((p) => p.team === 'A').sort((a, b) => a.pickOrder - b.pickOrder);
  const teamB = picks.filter((p) => p.team === 'B').sort((a, b) => a.pickOrder - b.pickOrder);

  const handleReady = async () => {
    setBusy(true);
    setError(null);
    try {
      await callApi('ready', {});
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSwap = async (inPlayerId) => {
    if (!swapTarget) return;
    setBusy(true);
    setError(null);
    try {
      await callApi('swap', { outPlayerId: swapTarget.currentPlayerId, inPlayerId });
      setSwapTarget(null);
      setSwapFilter('All');
      setSwapSearch('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const imReady = role === 'captainA' ? draft.captainAReady : role === 'captainB' ? draft.captainBReady : false;

  return (
    <div>
      {/* Ready status bar */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-brand-800/60 border border-brand-600/30 rounded-xl">
        <ReadyBadge label="Captain Alpha" ready={draft.captainAReady} />
        <div className="flex-1 text-center text-xs text-gray-600 font-display uppercase tracking-wider">
          {draft.captainAReady && draft.captainBReady
            ? 'Both ready — starting draft…'
            : 'Waiting for both captains to ready up'}
        </div>
        <ReadyBadge label="Captain Bravo" ready={draft.captainBReady} />
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team A */}
        <TeamRoster
          team="A"
          picks={teamA}
          myTeam={myTeam}
          isAdmin={isAdmin}
          onSwap={(pick) => setSwapTarget({ pickId: pick.id, team: 'A', currentPlayerId: pick.playerId })}
        />
        {/* Team B */}
        <TeamRoster
          team="B"
          picks={teamB}
          myTeam={myTeam}
          isAdmin={isAdmin}
          onSwap={(pick) => setSwapTarget({ pickId: pick.id, team: 'B', currentPlayerId: pick.playerId })}
        />
      </div>

      {/* Ready button for captains */}
      {myTeam && (
        <div className="mt-6 text-center">
          {imReady
            ? <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-display font-bold text-sm uppercase tracking-wider text-green-400">Ready — Waiting for other captain</span>
              </div>
            : <button onClick={handleReady} disabled={busy} className="btn-primary px-8 py-3 text-sm">
                {busy ? 'Confirming…' : 'Ready Up'}
              </button>
          }
        </div>
      )}

      {/* Swap modal */}
      {swapTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-brand-800 border border-brand-600/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-base uppercase tracking-wider text-gray-200">
                Select Replacement Player
              </h3>
              <button onClick={() => setSwapTarget(null)} className="text-gray-500 hover:text-gray-300 text-xl leading-none">✕</button>
            </div>
            <input
              placeholder="Search…"
              value={swapSearch}
              onChange={(e) => setSwapSearch(e.target.value)}
              className="input-field mb-2 text-xs w-full"
            />
            <div className="flex flex-wrap gap-1 mb-3">
              {['All', ...PLAYER_ROLES].map((r) => (
                <button key={r} onClick={() => setSwapFilter(r)}
                  className={`px-2 py-0.5 rounded text-[10px] font-display font-semibold uppercase tracking-wider transition-colors ${
                    swapFilter === r ? 'bg-frost-500/20 text-frost-400 border border-frost-500/40' : 'bg-brand-700/50 text-gray-500 border border-transparent hover:text-gray-300'
                  }`}>{r}</button>
              ))}
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {freeAgents.length === 0
                ? <p className="text-xs text-gray-600 text-center py-6">No available free agents</p>
                : freeAgents.map((player) => (
                  <button key={player.id} onClick={() => handleSwap(player.id)} disabled={busy}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-950/40 border border-brand-600/20 hover:border-frost-500/40 hover:bg-frost-500/5 transition-all text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-medium text-sm text-gray-300">{player.name}</span>
                        <span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[player.role]}`}>{player.role}</span>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadyBadge({ label, ready }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${ready ? 'bg-green-500/10 border-green-500/30' : 'bg-brand-900 border-brand-600/30'}`}>
      <span className={`w-2 h-2 rounded-full ${ready ? 'bg-green-400' : 'bg-gray-600'}`} />
      <span className={`font-display font-bold text-xs uppercase tracking-wider ${ready ? 'text-green-400' : 'text-gray-500'}`}>
        {label}: {ready ? 'Ready' : 'Waiting'}
      </span>
    </div>
  );
}

function TeamRoster({ team, picks, myTeam, isAdmin, onSwap }) {
  const isA = team === 'A';
  const accent = isA ? 'text-blue-400' : 'text-red-400';
  const accentBg = isA ? 'bg-blue-500/15' : 'bg-red-500/15';
  const borderColor = isA ? 'border-blue-500/30' : 'border-red-500/30';
  const colBg = isA ? 'bg-[#0d1225]' : 'bg-[#1a0d0d]';
  const canSwap = isAdmin || myTeam === team;

  return (
    <div className={`rounded-xl border ${borderColor} ${colBg} overflow-hidden`}>
      <div className={`px-5 py-4 border-b ${borderColor}`}>
        <h2 className={`font-display font-bold text-lg uppercase tracking-wider ${accent}`}>
          Team {isA ? 'Alpha' : 'Bravo'}
        </h2>
        {canSwap && (
          <p className="text-[10px] text-gray-600 mt-0.5">Click Swap to replace a player before bans start</p>
        )}
      </div>
      <div className="p-4 space-y-2">
        {picks.map((pick, i) => (
          <div key={pick.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-800/60 border border-brand-600/20">
            <span className="w-5 h-5 rounded bg-brand-700 flex items-center justify-center text-[10px] font-mono text-gray-500 shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-semibold text-sm text-gray-200 truncate">{pick.player?.name}</span>
                <span className="text-[9px] font-mono text-gray-500 uppercase">{pick.player?.role}</span>
              </div>
            </div>
            {canSwap && (
              <button onClick={() => onSwap(pick)}
                className="shrink-0 px-2 py-0.5 rounded text-[10px] font-display font-semibold uppercase text-frost-400 border border-frost-500/30 hover:bg-frost-500/10 transition-colors">
                Swap
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
