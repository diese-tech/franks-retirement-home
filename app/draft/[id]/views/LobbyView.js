'use client';

import { useState, useMemo } from 'react';
import { ROLE_COLORS, PLAYER_ROLES } from '@/lib/constants';
import RoleFilter from '@/components/RoleFilter';
import { BrutalButton, PixelBadge, RetroWindow } from '@/components/ui';

export default function LobbyView({ state, role, callApi }) {
  const { draft, picks, players } = state;
  const [swapTarget, setSwapTarget] = useState(null);
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
  const bothReady = draft.captainAReady && draft.captainBReady;

  return (
    <div className="space-y-6">
      <RetroWindow title="CAPTAIN READY CHECK">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
          <CeremonySlot team="A" ready={draft.captainAReady} highlight={myTeam === 'A' || isAdmin} />
          <div className="flex items-center justify-center">
            <div className="font-display text-5xl font-black text-frh-yellow">VS</div>
          </div>
          <CeremonySlot team="B" ready={draft.captainBReady} highlight={myTeam === 'B' || isAdmin} />
        </div>
        <div className={`mt-4 text-center font-mono text-xs ${bothReady ? 'text-frh-lime animate-pulse' : 'text-gray-600'}`}>
          {bothReady ? 'Both ready - starting draft...' : 'Waiting for both captains to ready up'}
        </div>
      </RetroWindow>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-mono">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6">
        <TeamRoster
          team="A"
          picks={teamA}
          myTeam={myTeam}
          isAdmin={isAdmin}
          onSwap={(pick) => setSwapTarget({ pickId: pick.id, team: 'A', currentPlayerId: pick.playerId })}
        />
        <div className="hidden lg:flex items-center justify-center">
          <div className="font-display text-6xl font-black text-frh-yellow">VS</div>
        </div>
        <TeamRoster
          team="B"
          picks={teamB}
          myTeam={myTeam}
          isAdmin={isAdmin}
          onSwap={(pick) => setSwapTarget({ pickId: pick.id, team: 'B', currentPlayerId: pick.playerId })}
        />
      </div>

      {myTeam && (
        <div className="text-center">
          {imReady
            ? <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-500/10 border border-green-500/30">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-ui text-sm uppercase tracking-wider text-green-400">Ready - waiting for other captain</span>
              </div>
            : <BrutalButton onClick={handleReady} disabled={busy} size="lg">
                {busy ? 'Confirming...' : 'Ready Up'}
              </BrutalButton>
          }
        </div>
      )}

      {swapTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <RetroWindow title="SELECT REPLACEMENT PLAYER" className="w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-ui text-sm uppercase tracking-widest text-frh-yellow">Free Agents</h3>
              <BrutalButton onClick={() => setSwapTarget(null)} variant="ghost" size="sm">Close</BrutalButton>
            </div>
            <input
              placeholder="Search..."
              value={swapSearch}
              onChange={(e) => setSwapSearch(e.target.value)}
              className="input-field mb-2 text-xs w-full"
            />
            <div className="mb-3">
              <RoleFilter options={['All', ...PLAYER_ROLES]} value={swapFilter} onChange={setSwapFilter} />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {freeAgents.length === 0
                ? <p className="text-xs text-gray-600 text-center py-6">No available free agents</p>
                : freeAgents.map((player) => (
                  <button key={player.id} onClick={() => handleSwap(player.id)} disabled={busy}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-brand-950/40 border border-brand-600/20 hover:border-frost-500/40 hover:bg-frost-500/5 transition-all text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-medium text-sm text-gray-300">{player.name}</span>
                        <span className={`text-[9px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[player.role]}`}>{player.role}</span>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </RetroWindow>
        </div>
      )}
    </div>
  );
}

function CeremonySlot({ team, ready, highlight }) {
  const isA = team === 'A';
  const color = isA ? 'blue' : 'purple';

  return (
    <div className={`border-2 ${isA ? 'border-frh-xp-blue bg-frh-xp-blue/10' : 'border-frh-purple bg-frh-purple/10'} px-6 py-5 ${highlight ? '' : 'opacity-70'}`}>
      <div className={`font-ui text-xl uppercase tracking-widest ${isA ? 'text-frh-xp-blue' : 'text-frh-purple'}`}>
        Team {isA ? 'Alpha' : 'Bravo'}
      </div>
      <div className="mt-3">
        <PixelBadge label={ready ? 'Ready' : 'Waiting'} color={ready ? 'lime' : color} />
      </div>
    </div>
  );
}

function TeamRoster({ team, picks, myTeam, isAdmin, onSwap }) {
  const isA = team === 'A';
  const canSwap = isAdmin || myTeam === team;

  return (
    <RetroWindow title={`TEAM ${isA ? 'A' : 'B'} BUDDY LIST`} titleBarColor={isA ? 'blue' : 'purple'}>
      <div className="mb-3">
        <h2 className={`font-ui text-lg uppercase tracking-widest ${isA ? 'text-frh-xp-blue' : 'text-frh-purple'}`}>
          Team {isA ? 'Alpha' : 'Bravo'}
        </h2>
        {canSwap && (
          <p className="text-[10px] text-gray-600 mt-0.5 font-mono">Click Swap to replace a player before bans start</p>
        )}
      </div>
      <div className="space-y-2">
        {picks.map((pick, i) => (
          <div key={pick.id} className="flex items-center gap-2 px-3 py-2 bg-brand-900/70 border border-brand-700">
            <span className="w-5 h-5 bg-brand-700 flex items-center justify-center text-[10px] font-mono text-gray-500 shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-semibold text-sm text-gray-200 truncate">{pick.player?.name}</span>
                <span className="text-[9px] font-mono text-gray-500 uppercase">{pick.player?.role}</span>
              </div>
            </div>
            {canSwap && (
              <BrutalButton onClick={() => onSwap(pick)} variant="secondary" size="sm">Swap</BrutalButton>
            )}
          </div>
        ))}
      </div>
    </RetroWindow>
  );
}
