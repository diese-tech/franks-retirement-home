'use client';

import { useMemo, useState } from 'react';
import { PLAYER_ROLES, ROLE_COLORS } from '@/lib/constants';
import RoleFilter from '@/components/RoleFilter';
import { BrutalButton, PixelBadge, RetroWindow } from '@/components/ui';

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
  const canAutoStart = teamACount === 5 && teamBCount === 5;

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
      <RetroWindow title="LOBBY NOT OPEN YET">
        <div className="text-center py-16">
          <div className="font-ui text-5xl text-brand-600 mb-4">...</div>
          <h2 className="font-ui text-lg uppercase tracking-widest text-gray-400 mb-2">Stand By</h2>
          <p className="text-sm text-gray-600">The admin is assembling teams. You can join when the lobby opens.</p>
        </div>
      </RetroWindow>
    );
  }

  return (
    <div className="space-y-4">
      <RetroWindow title="PENDING SETUP">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <span className="text-xs text-gray-500 font-mono">
            Team A: {teamACount}/5 | Team B: {teamBCount}/5
          </span>
          <div className="lg:ml-auto">
            <div className={`text-xs font-ui uppercase tracking-wider ${canAutoStart ? 'text-frh-lime' : 'text-gray-500'}`}>
              {canAutoStart ? 'Lobby opens automatically at 5v5' : 'Both teams must be exactly 5 players'}
            </div>
            <div className="text-[10px] text-gray-600">
              Draft moves to lobby only when both rosters are full.
            </div>
          </div>
        </div>
      </RetroWindow>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_1fr] gap-4">
        <RetroWindow title="PLAYER POOL" className="max-h-[75vh] flex flex-col overflow-hidden">
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
              <p className="text-xs text-gray-600 text-center py-6">No available players. Very exclusive.</p>
            ) : (
              available.map((player) => (
                <div key={player.id} className="group flex items-center gap-2 px-2 py-1.5 bg-brand-950/40 border border-brand-600/20 hover:border-brand-600/40 transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display font-medium text-sm text-gray-300 truncate">{player.name}</span>
                      <span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[player.role]}`}>
                        {player.role}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <BrutalButton onClick={() => addPlayer(player.id, 'A')} size="sm" variant="secondary">A</BrutalButton>
                    <BrutalButton onClick={() => addPlayer(player.id, 'B')} size="sm" variant="secondary">B</BrutalButton>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-brand-600/30 text-[10px] text-gray-600 font-mono text-center">
            {available.length} available | {draftedIds.size} drafted
          </div>
        </RetroWindow>

        <TeamColumn team="A" picks={picks.filter((pick) => pick.team === 'A')} onRemove={removePlayer} />
        <TeamColumn team="B" picks={picks.filter((pick) => pick.team === 'B')} onRemove={removePlayer} />
      </div>
    </div>
  );
}

function TeamColumn({ team, picks, onRemove }) {
  const isA = team === 'A';
  const titleColor = isA ? 'blue' : 'purple';

  return (
    <RetroWindow title={`TEAM ${isA ? 'A' : 'B'} STUB`} titleBarColor={titleColor}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={`font-ui text-lg uppercase tracking-widest ${isA ? 'text-frh-xp-blue' : 'text-frh-purple'}`}>
          Team {isA ? 'Alpha' : 'Bravo'}
        </h2>
        <PixelBadge label={`${picks.length}/5`} color={picks.length === 5 ? 'lime' : titleColor} />
      </div>
      <div className="space-y-2 min-h-[200px]">
        {picks.length === 0 ? (
          <div className="text-center py-10 text-gray-600 text-sm">No players drafted.</div>
        ) : (
          picks.map((pick, index) => (
            <div key={pick.id} className="group flex items-center gap-2 px-3 py-2 bg-brand-900/70 border border-brand-700">
              <span className="w-5 h-5 bg-brand-700 flex items-center justify-center text-[10px] font-mono text-gray-500 shrink-0">{index + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-semibold text-sm text-gray-200 truncate">{pick.player?.name}</span>
                  <span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[pick.player?.role] ?? ''}`}>
                    {pick.player?.role}
                  </span>
                </div>
              </div>
              <BrutalButton onClick={() => onRemove(pick.id)} variant="danger" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">X</BrutalButton>
            </div>
          ))
        )}
      </div>
    </RetroWindow>
  );
}
