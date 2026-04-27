'use client';

import { useMemo, useState } from 'react';
import { PLAYER_ROLES, ROLE_COLORS } from '@/lib/constants';
import RoleFilter from '@/components/RoleFilter';

export default function PendingView({ state, role, draftId }) {
  const [roleFilter, setRoleFilter] = useState('All');
  const [search, setSearch] = useState('');

  const { picks, players } = state;
  const isAdmin = role === 'admin';

  const draftedIds = useMemo(() => new Set(picks.map((pick) => pick.playerId)), [picks]);

  const available = useMemo(() => {
    return players.filter((player) => {
      if (draftedIds.has(player.id)) return false;
      if (roleFilter !== 'All' && player.role !== roleFilter) return false;
      if (search && !player.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [players, draftedIds, roleFilter, search]);

  const teamACount = picks.filter((pick) => pick.team === 'A').length;
  const teamBCount = picks.filter((pick) => pick.team === 'B').length;
  const canAutoStart = teamACount > 0 && teamBCount > 0;

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

  if (!isAdmin) {
    return (
      <div className="text-center py-24 card">
        <div className="font-display font-bold text-5xl text-brand-600 mb-4">...</div>
        <h2 className="font-display font-bold text-lg uppercase tracking-wider text-gray-400 mb-2">Lobby Not Open Yet</h2>
        <p className="text-sm text-gray-600">The admin is assembling teams. You will be able to join once the lobby opens.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <span className="text-xs text-gray-500 font-mono">
          Team A: {teamACount}/5 | Team B: {teamBCount}/5
        </span>
        <div className="ml-auto text-right">
          <div className={`text-xs font-display font-semibold uppercase tracking-wider ${canAutoStart ? 'text-green-400' : 'text-gray-500'}`}>
            {canAutoStart ? 'Lobby opens automatically' : 'Add at least one player to both teams'}
          </div>
          <div className="text-[10px] text-gray-600">
            The draft moves to the lobby as soon as both rosters are loaded.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_1fr] gap-4">
        <div className="card max-h-[75vh] flex flex-col overflow-hidden">
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-gray-400 mb-2">Player Pool</h3>
          <input
            placeholder="Search..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input-field mb-2 text-xs"
          />
          <div className="mb-2">
            <RoleFilter options={['All', ...PLAYER_ROLES]} value={roleFilter} onChange={setRoleFilter} />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {available.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6">No available players</p>
            ) : (
              available.map((player) => (
                <div key={player.id} className="group flex items-center gap-2 px-2 py-1.5 rounded bg-brand-950/40 border border-brand-600/20 hover:border-brand-600/40 transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display font-medium text-sm text-gray-300 truncate">{player.name}</span>
                      <span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[player.role]}`}>
                        {player.role}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => addPlayer(player.id, 'A')} className="px-1.5 py-0.5 text-[10px] font-display font-bold uppercase rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25">A</button>
                    <button onClick={() => addPlayer(player.id, 'B')} className="px-1.5 py-0.5 text-[10px] font-display font-bold uppercase rounded bg-red-500/15 text-red-400 hover:bg-red-500/25">B</button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-brand-600/30 text-[10px] text-gray-600 font-mono text-center">
            {available.length} available | {draftedIds.size} drafted
          </div>
        </div>

        <TeamColumn team="A" picks={picks.filter((pick) => pick.team === 'A')} onRemove={removePlayer} />
        <TeamColumn team="B" picks={picks.filter((pick) => pick.team === 'B')} onRemove={removePlayer} />
      </div>
    </div>
  );
}

function TeamColumn({ team, picks, onRemove }) {
  const isA = team === 'A';
  const accent = isA ? 'text-blue-400' : 'text-red-400';
  const borderColor = isA ? 'border-blue-500/30' : 'border-red-500/30';
  const colBg = isA ? 'bg-blue-950/60' : 'bg-red-950/60';

  return (
    <div className={`rounded-xl border ${borderColor} ${colBg} overflow-hidden`}>
      <div className={`px-5 py-4 border-b ${borderColor} flex items-center justify-between`}>
        <h2 className={`font-display font-bold text-lg uppercase tracking-wider ${accent}`}>
          Team {isA ? 'Alpha' : 'Bravo'}
        </h2>
        <span className={`font-mono text-sm ${picks.length === 5 ? 'text-green-400' : accent}`}>{picks.length}/5</span>
      </div>
      <div className="p-4 space-y-2 min-h-[200px]">
        {picks.length === 0 ? (
          <div className="text-center py-10 text-gray-600 text-sm">No players drafted</div>
        ) : (
          picks.map((pick, index) => (
            <div key={pick.id} className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-800/60 border border-brand-600/20 hover:border-brand-600/40 transition-all">
              <span className="w-5 h-5 rounded bg-brand-700 flex items-center justify-center text-[10px] font-mono text-gray-500 shrink-0">{index + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-semibold text-sm text-gray-200 truncate">{pick.player?.name}</span>
                  <span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[pick.player?.role] ?? ''}`}>
                    {pick.player?.role}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onRemove(pick.id)}
                className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                x
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
