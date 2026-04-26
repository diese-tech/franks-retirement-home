'use client';

import { useState, useMemo } from 'react';
import { ROLE_COLORS, PLAYER_ROLES } from '@/lib/constants';

export default function PendingView({ state, role, draftId }) {
  const [roleFilter, setRoleFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const { picks, players } = state;
  const isAdmin = role === 'admin';

  const draftedIds = useMemo(() => new Set(picks.map((p) => p.playerId)), [picks]);

  const available = useMemo(() => {
    return players.filter((p) => {
      if (draftedIds.has(p.id)) return false;
      if (roleFilter !== 'All' && p.role !== roleFilter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [players, draftedIds, roleFilter, search]);

  const teamACount = picks.filter((p) => p.team === 'A').length;
  const teamBCount = picks.filter((p) => p.team === 'B').length;
  const canOpenLobby = teamACount === 5 && teamBCount === 5;

  const addPlayer = async (playerId, team) => {
    await fetch('/api/draft-picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, playerId, team, pickOrder: picks.length + 1 }),
    });
  };

  const removePlayer = async (pickId) => {
    await fetch(`/api/draft-picks?id=${pickId}`, { method: 'DELETE' });
  };

  const openLobby = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draftId, status: 'lobby' }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || 'Failed to open lobby');
    setBusy(false);
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-24 card">
        <div className="font-display font-bold text-5xl text-brand-600 mb-4">⏳</div>
        <h2 className="font-display font-bold text-lg uppercase tracking-wider text-gray-400 mb-2">Lobby Not Open Yet</h2>
        <p className="text-sm text-gray-600">The admin is assembling teams. You'll be able to join once the lobby opens.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <span className="text-xs text-gray-500 font-mono">
          Team A: {teamACount}/5 &nbsp;·&nbsp; Team B: {teamBCount}/5
        </span>
        <div className="ml-auto flex items-center gap-2">
          {error && <span className="text-xs text-red-400">{error}</span>}
          <button
            onClick={openLobby}
            disabled={!canOpenLobby || busy}
            className={`btn-primary text-xs ${!canOpenLobby ? 'opacity-40 cursor-not-allowed' : ''}`}
            title={!canOpenLobby ? 'Both teams need exactly 5 players' : 'Open lobby for captains'}
          >
            {busy ? 'Opening…' : 'Open Lobby'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_1fr] gap-4">
        {/* Player Pool */}
        <div className="card max-h-[75vh] flex flex-col overflow-hidden">
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-gray-400 mb-2">Player Pool</h3>
          <input
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field mb-2 text-xs"
          />
          <div className="flex flex-wrap gap-1 mb-2">
            {['All', ...PLAYER_ROLES].map((r) => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-2 py-0.5 rounded text-[10px] font-display font-semibold uppercase tracking-wider transition-colors ${
                  roleFilter === r ? 'bg-frost-500/20 text-frost-400 border border-frost-500/40' : 'bg-brand-700/50 text-gray-500 border border-transparent hover:text-gray-300'
                }`}>{r}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {available.length === 0
              ? <p className="text-xs text-gray-600 text-center py-6">No available players</p>
              : available.map((player) => (
                <div key={player.id} className="group flex items-center gap-2 px-2 py-1.5 rounded bg-brand-950/40 border border-brand-600/20 hover:border-brand-600/40 transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display font-medium text-sm text-gray-300 truncate">{player.name}</span>
                      <span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[player.role]}`}>{player.role}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => addPlayer(player.id, 'A')} className="px-1.5 py-0.5 text-[10px] font-display font-bold uppercase rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25">A</button>
                    <button onClick={() => addPlayer(player.id, 'B')} className="px-1.5 py-0.5 text-[10px] font-display font-bold uppercase rounded bg-red-500/15 text-red-400 hover:bg-red-500/25">B</button>
                  </div>
                </div>
              ))}
          </div>
          <div className="mt-2 pt-2 border-t border-brand-600/30 text-[10px] text-gray-600 font-mono text-center">
            {available.length} available · {draftedIds.size} drafted
          </div>
        </div>

        {/* Team A */}
        <TeamColumn team="A" picks={picks.filter((p) => p.team === 'A')} onRemove={removePlayer} />

        {/* Team B */}
        <TeamColumn team="B" picks={picks.filter((p) => p.team === 'B')} onRemove={removePlayer} />
      </div>
    </div>
  );
}

function TeamColumn({ team, picks, onRemove }) {
  const isA = team === 'A';
  const accent = isA ? 'text-blue-400' : 'text-red-400';
  const accentBg = isA ? 'bg-blue-500/15' : 'bg-red-500/15';
  const borderColor = isA ? 'border-blue-500/30' : 'border-red-500/30';
  const colBg = isA ? 'bg-[#0d1225]' : 'bg-[#1a0d0d]';

  return (
    <div className={`rounded-xl border ${borderColor} ${colBg} overflow-hidden`}>
      <div className={`px-5 py-4 border-b ${borderColor} flex items-center justify-between`}>
        <h2 className={`font-display font-bold text-lg uppercase tracking-wider ${accent}`}>
          Team {isA ? 'Alpha' : 'Bravo'}
        </h2>
        <span className={`font-mono text-sm ${picks.length === 5 ? 'text-green-400' : accent}`}>{picks.length}/5</span>
      </div>
      <div className="p-4 space-y-2 min-h-[200px]">
        {picks.length === 0
          ? <div className="text-center py-10 text-gray-600 text-sm">No players drafted</div>
          : picks.map((pick, i) => (
            <div key={pick.id} className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-800/60 border border-brand-600/20 hover:border-brand-600/40 transition-all">
              <span className="w-5 h-5 rounded bg-brand-700 flex items-center justify-center text-[10px] font-mono text-gray-500 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-semibold text-sm text-gray-200 truncate">{pick.player?.name}</span>
                  <span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[pick.player?.role] ?? ''}`}>{pick.player?.role}</span>
                </div>
              </div>
              <button onClick={() => onRemove(pick.id)}
                className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all">
                ✕
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
