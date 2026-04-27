'use client';

import { useMemo, useState } from 'react';
import { GOD_ROLES, ROLE_COLORS } from '@/lib/constants';
import { currentPickTeam, PICK_ORDER, TOTAL_PICKS } from '@/lib/draftOrder';
import ArenaBanner from '@/components/ArenaBanner';
import GodImage from '@/components/GodImage';
import RoleFilter from '@/components/RoleFilter';

export default function PickView({ state, role, callApi }) {
  const { picks, bans, gods, previouslyUsedGodIds = [] } = state;
  const [godPickFor, setGodPickFor] = useState(null);
  const [godFilter, setGodFilter] = useState('All');
  const [godSearch, setGodSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const completedCount = picks.filter((pick) => pick.godId !== null).length;
  const activeTeam = currentPickTeam(completedCount);
  const myTeam = role === 'captainA' ? 'A' : role === 'captainB' ? 'B' : null;
  const isMyTurn = role === 'admin' || (myTeam !== null && myTeam === activeTeam);
  const isAdmin = role === 'admin';

  const bannedIds = useMemo(() => new Set(bans.map((ban) => ban.godId)), [bans]);
  const pickedIds = useMemo(() => new Set(picks.map((pick) => pick.godId).filter(Boolean)), [picks]);
  const previouslyUsedIds = useMemo(() => new Set(previouslyUsedGodIds), [previouslyUsedGodIds]);

  const filteredGods = useMemo(() => {
    return gods.filter((god) => {
      if (godFilter !== 'All' && god.role !== godFilter) return false;
      if (godSearch && !god.name.toLowerCase().includes(godSearch.toLowerCase())) return false;
      return true;
    });
  }, [gods, godFilter, godSearch]);

  const teamA = picks.filter((pick) => pick.team === 'A').sort((a, b) => a.pickOrder - b.pickOrder);
  const teamB = picks.filter((pick) => pick.team === 'B').sort((a, b) => a.pickOrder - b.pickOrder);
  const vaultedGods = gods.filter((god) => previouslyUsedIds.has(god.id));

  const submitPick = async (pickId, godId) => {
    setBusy(true);
    setError(null);
    try {
      await callApi('pick', { pickId, godId });
      setGodPickFor(null);
      setGodFilter('All');
      setGodSearch('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const undoPick = async (pickId) => {
    if (!isAdmin || busy) return;
    setBusy(true);
    setError(null);
    try {
      await callApi('pick', { pickId }, 'DELETE');
      setGodPickFor(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const isDone = completedCount >= TOTAL_PICKS;
  const previouslyUsedCount = previouslyUsedGodIds.length;

  return (
    <div className="space-y-4">
      {activeTeam && !isDone && (
        <ArenaBanner
          team={activeTeam}
          subtext={isMyTurn && myTeam ? 'Your turn - select a player slot' : 'is picking'}
        />
      )}
      {isDone && <ArenaBanner gold subtext="Draft Complete" />}

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
        <div>
          {godPickFor && isMyTurn ? (
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display font-bold text-xs uppercase tracking-wider text-gray-300">
                    Select God for {picks.find((pick) => pick.id === godPickFor)?.player?.name}
                  </h3>
                  {previouslyUsedCount > 0 && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      {previouslyUsedCount} gods are locked because they were used earlier in this set.
                    </p>
                  )}
                </div>
                <button onClick={() => setGodPickFor(null)} className="text-gray-500 hover:text-gray-300 text-sm">x</button>
              </div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <input
                  placeholder="Search..."
                  value={godSearch}
                  onChange={(event) => setGodSearch(event.target.value)}
                  className="input-field text-xs w-40"
                />
                <RoleFilter options={['All', ...GOD_ROLES]} value={godFilter} onChange={setGodFilter} />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 max-h-[480px] overflow-y-auto pr-1">
                {filteredGods.map((god) => {
                  const isBanned = bannedIds.has(god.id);
                  const isPicked = pickedIds.has(god.id);
                  const isPreviouslyUsed = previouslyUsedIds.has(god.id);
                  const isDisabled = isBanned || isPicked || isPreviouslyUsed || busy;
                  const reason = isBanned
                    ? 'Banned'
                    : isPicked
                      ? 'Picked'
                      : isPreviouslyUsed
                        ? 'Used in set'
                        : null;

                  return (
                    <button
                      key={god.id}
                      onClick={() => !isDisabled && submitPick(godPickFor, god.id)}
                      disabled={isDisabled}
                      className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                        isDisabled
                          ? 'bg-brand-900/30 border-brand-700/20 opacity-50 cursor-not-allowed'
                          : 'bg-brand-800/60 border-brand-600/20 hover:border-green-500/40 hover:bg-green-500/10'
                      }`}
                    >
                      <GodImage godId={god.id} name={god.name} size={48} className="w-full aspect-square" />
                      <div className="font-display font-semibold text-gray-200 text-[10px] leading-tight truncate w-full text-center">
                        {god.name}
                      </div>
                      {reason && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-brand-900/70 px-2">
                          <span className="text-[9px] font-display font-bold uppercase text-gray-300">{reason}</span>
                          {isPreviouslyUsed && (
                            <span className="text-[8px] text-gold-300 text-center mt-1">Previously used in set</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
                {filteredGods.length === 0 && (
                  <p className="col-span-full text-xs text-gray-600 text-center py-4">No gods match this filter</p>
                )}
              </div>
            </div>
          ) : (
            !isDone && (
              <div className="card flex items-center justify-center py-16 text-gray-700 text-sm font-display uppercase tracking-wider">
                {isMyTurn ? 'Select a player slot ->' : 'Waiting for opponent...'}
              </div>
            )
          )}
        </div>

        <div className="space-y-3">
          <div className="card">
            <div className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">
              Pick Order | <span className="font-mono text-gray-400">{completedCount}/{TOTAL_PICKS}</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {PICK_ORDER.map((team, index) => {
                const done = index < completedCount;
                const current = index === completedCount && !isDone;
                const isA = team === 'A';
                return (
                  <div
                    key={index}
                    className={`w-7 h-7 rounded flex items-center justify-center font-display font-bold text-[10px] transition-all ${
                      done
                        ? (isA ? 'bg-blue-500/30 text-blue-300' : 'bg-red-500/30 text-red-300')
                        : current
                          ? (isA ? 'bg-blue-500/60 text-blue-100 ring-2 ring-blue-400 animate-pulse' : 'bg-red-500/60 text-red-100 ring-2 ring-red-400 animate-pulse')
                          : 'bg-brand-800/40 text-gray-600'
                    }`}
                  >
                    {isA ? 'A' : 'B'}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">
              Vaulted Gods | <span className="font-mono text-gray-400">{vaultedGods.length}</span>
            </div>
            {vaultedGods.length === 0 ? (
              <p className="text-xs text-gray-600">No gods have been vaulted yet in this draft session.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {vaultedGods.map((god) => (
                  <div key={god.id} className="flex items-center gap-2 rounded-lg border border-gold-500/20 bg-gold-500/10 px-3 py-2">
                    <GodImage godId={god.id} name={god.name} size={24} className="rounded-sm" />
                    <div className="min-w-0">
                      <div className="text-xs text-gray-200 truncate">{god.name}</div>
                      <div className="text-[10px] text-gold-300 uppercase tracking-wider">Previously used in set</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <PickTeamColumn
            team="A"
            picks={teamA}
            isMyTurn={isMyTurn && activeTeam === 'A'}
            canInteract={role === 'admin' || role === 'captainA'}
            activeTeam={activeTeam}
            godPickFor={godPickFor}
            onSelectPick={(pickId) => setGodPickFor(pickId === godPickFor ? null : pickId)}
            isAdmin={isAdmin}
            onUndoPick={undoPick}
          />
          <PickTeamColumn
            team="B"
            picks={teamB}
            isMyTurn={isMyTurn && activeTeam === 'B'}
            canInteract={role === 'admin' || role === 'captainB'}
            activeTeam={activeTeam}
            godPickFor={godPickFor}
            onSelectPick={(pickId) => setGodPickFor(pickId === godPickFor ? null : pickId)}
            isAdmin={isAdmin}
            onUndoPick={undoPick}
          />
        </div>
      </div>
    </div>
  );
}

function PickTeamColumn({ team, picks, isMyTurn, canInteract, activeTeam, godPickFor, onSelectPick, isAdmin, onUndoPick }) {
  const isA = team === 'A';
  const accent = isA ? 'text-blue-400' : 'text-red-400';
  const borderColor = isA ? 'border-blue-500/30' : 'border-red-500/30';
  const colBg = isA ? 'bg-blue-950/60' : 'bg-red-950/60';
  const isActive = activeTeam === team;

  return (
    <div className={`rounded-xl border ${borderColor} ${colBg} overflow-hidden ${isActive ? `ring-1 ring-offset-1 ring-offset-brand-900 ${isA ? 'ring-blue-500/30' : 'ring-red-500/30'}` : ''}`}>
      <div className={`px-5 py-4 border-b ${borderColor} flex items-center justify-between`}>
        <h2 className={`font-display font-bold text-lg uppercase tracking-wider ${accent}`}>
          Team {isA ? 'Alpha' : 'Bravo'}
        </h2>
        <div className={`font-mono text-xs ${accent}`}>{picks.filter((pick) => pick.godId).length}/{picks.length} gods</div>
      </div>
      <div className="p-4 space-y-2">
        {picks.map((pick, index) => {
          const isPending = !pick.godId;
          const isSelected = godPickFor === pick.id;
          const clickable = canInteract && isMyTurn && isPending && isActive;

          return (
            <div
              key={pick.id}
              onClick={() => clickable && onSelectPick(pick.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                isSelected
                  ? 'bg-frost-500/15 border-frost-500/40 ring-1 ring-frost-500/30'
                  : clickable
                    ? 'bg-brand-800/60 border-brand-600/20 hover:border-frost-500/30 hover:bg-frost-500/5 cursor-pointer'
                    : 'bg-brand-800/60 border-brand-600/20'
              }`}
            >
              <span className="w-5 h-5 rounded bg-brand-700 flex items-center justify-center text-[10px] font-mono text-gray-500 shrink-0">{index + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-semibold text-sm text-gray-200 truncate">{pick.player?.name}</span>
                  <span className={`text-[9px] font-display font-bold uppercase px-1 py-0.5 rounded ${ROLE_COLORS[pick.player?.role]}`}>
                    {pick.player?.role}
                  </span>
                </div>
                {pick.god ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <GodImage godId={pick.god.id} name={pick.god.name} size={20} className="rounded-sm" />
                    <span className="text-xs text-gray-400">
                      {pick.god.name} <span className="text-gray-600">({pick.god.role})</span>
                    </span>
                    {isAdmin && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onUndoPick(pick.id);
                        }}
                        className="ml-auto text-[10px] text-gold-300 hover:text-gold-200 uppercase tracking-wider"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                ) : isPending && isActive && canInteract && isMyTurn ? (
                  <div className="text-[10px] text-frost-400 mt-0.5">Click to select god...</div>
                ) : (
                  <div className="text-[10px] text-gray-600 mt-0.5">-</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
