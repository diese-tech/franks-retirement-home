'use client';

import { useState, useMemo } from 'react';
import { evaluateDraft } from '@/lib/rules';
import { ROLE_COLORS, GOD_ROLES } from '@/lib/constants';
import { PICK_ORDER, currentPickTeam, TOTAL_PICKS } from '@/lib/draftOrder';

export default function PickView({ state, role, callApi }) {
  const { picks, bans, gods } = state;
  const [godPickFor, setGodPickFor] = useState(null); // pickId being assigned
  const [godFilter, setGodFilter] = useState('All');
  const [godSearch, setGodSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const completedCount = picks.filter((p) => p.godId !== null).length;
  const activeTeam = currentPickTeam(completedCount);
  const myTeam = role === 'captainA' ? 'A' : role === 'captainB' ? 'B' : null;
  const isMyTurn = role === 'admin' || (myTeam !== null && myTeam === activeTeam);

  const bannedIds = useMemo(() => new Set(bans.map((b) => b.godId)), [bans]);
  const pickedIds = useMemo(() => new Set(picks.map((p) => p.godId).filter(Boolean)), [picks]);
  const unavailableIds = useMemo(() => new Set([...bannedIds, ...pickedIds]), [bannedIds, pickedIds]);

  const evaluation = useMemo(() => evaluateDraft(picks), [picks]);

  const availableGods = useMemo(() => {
    return gods.filter((g) => {
      if (unavailableIds.has(g.id)) return false;
      if (godFilter !== 'All' && g.role !== godFilter) return false;
      if (godSearch && !g.name.toLowerCase().includes(godSearch.toLowerCase())) return false;
      return true;
    });
  }, [gods, unavailableIds, godFilter, godSearch]);

  const teamA = picks.filter((p) => p.team === 'A').sort((a, b) => a.pickOrder - b.pickOrder);
  const teamB = picks.filter((p) => p.team === 'B').sort((a, b) => a.pickOrder - b.pickOrder);

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

  const isDone = completedCount >= TOTAL_PICKS;

  return (
    <div className="space-y-4">
      {/* Snake order tracker */}
      <div className="card">
        <div className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Pick Order (Snake Draft)</div>
        <div className="flex gap-1.5 flex-wrap">
          {PICK_ORDER.map((team, idx) => {
            const done = idx < completedCount;
            const current = idx === completedCount && !isDone;
            const isA = team === 'A';
            return (
              <div key={idx} className={`w-8 h-8 rounded flex items-center justify-center font-display font-bold text-xs transition-all
                ${done ? (isA ? 'bg-blue-500/30 text-blue-300' : 'bg-red-500/30 text-red-300')
                  : current ? (isA ? 'bg-blue-500/50 text-blue-200 ring-2 ring-blue-400 animate-pulse' : 'bg-red-500/50 text-red-200 ring-2 ring-red-400 animate-pulse')
                  : 'bg-brand-800/40 text-gray-600'}`}>
                {isA ? 'A' : 'B'}
              </div>
            );
          })}
        </div>
      </div>

      {/* Turn indicator */}
      {activeTeam && !isDone && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
          activeTeam === 'A' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30'
        }`}>
          <span className={`w-2 h-2 rounded-full animate-pulse ${activeTeam === 'A' ? 'bg-blue-400' : 'bg-red-400'}`} />
          <span className={`font-display font-bold text-sm uppercase tracking-wider ${activeTeam === 'A' ? 'text-blue-400' : 'text-red-400'}`}>
            Team {activeTeam === 'A' ? 'Alpha' : 'Bravo'} is picking
          </span>
          {isMyTurn && myTeam && (
            <span className="ml-auto text-xs text-gray-400">Select a player to assign a god</span>
          )}
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">{error}</div>
      )}

      {/* Teams + scoreboard */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px_1fr] gap-4">
        <PickTeamColumn
          team="A"
          picks={teamA}
          isMyTurn={isMyTurn && activeTeam === 'A'}
          canInteract={role === 'admin' || role === 'captainA'}
          activeTeam={activeTeam}
          godPickFor={godPickFor}
          onSelectPick={(pickId) => setGodPickFor(pickId === godPickFor ? null : pickId)}
        />

        {/* Scoreboard */}
        <div className="flex flex-col gap-4">
          <div className="card text-center">
            <div className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-1">Point Diff</div>
            <div className={`font-mono text-4xl font-bold ${evaluation.diff >= 3 ? 'text-red-400' : evaluation.diff >= 2 ? 'text-yellow-400' : 'text-green-400'}`}>
              {evaluation.diff}
            </div>
            <div className="flex items-center justify-center gap-3 mt-3 text-xs font-mono">
              <span className="text-blue-400">{evaluation.teamA.points} A</span>
              <span className="text-gray-600">vs</span>
              <span className="text-red-400">{evaluation.teamB.points} B</span>
            </div>
          </div>
          <div className="card text-center">
            <div className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-1">Picks</div>
            <div className="font-mono text-2xl font-bold text-gray-300">{completedCount}<span className="text-gray-600 text-base">/{TOTAL_PICKS}</span></div>
          </div>
        </div>

        <PickTeamColumn
          team="B"
          picks={teamB}
          isMyTurn={isMyTurn && activeTeam === 'B'}
          canInteract={role === 'admin' || role === 'captainB'}
          activeTeam={activeTeam}
          godPickFor={godPickFor}
          onSelectPick={(pickId) => setGodPickFor(pickId === godPickFor ? null : pickId)}
        />
      </div>

      {/* God selector panel */}
      {godPickFor && isMyTurn && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-gray-300">
              Select God for {picks.find((p) => p.id === godPickFor)?.player?.name}
            </h3>
            <button onClick={() => setGodPickFor(null)} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
          </div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <input placeholder="Search…" value={godSearch} onChange={(e) => setGodSearch(e.target.value)} className="input-field text-xs w-40" />
            {['All', ...GOD_ROLES].map((r) => (
              <button key={r} onClick={() => setGodFilter(r)}
                className={`px-2 py-0.5 rounded text-[10px] font-display font-semibold uppercase tracking-wider transition-colors ${
                  godFilter === r ? 'bg-frost-500/20 text-frost-400 border border-frost-500/40' : 'bg-brand-700/50 text-gray-500 border border-transparent hover:text-gray-300'
                }`}>{r}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-1.5 max-h-[280px] overflow-y-auto pr-1">
            {availableGods.map((god) => (
              <button key={god.id} onClick={() => submitPick(godPickFor, god.id)} disabled={busy}
                className="px-2 py-2 rounded-lg border bg-brand-800/60 border-brand-600/20 hover:border-green-500/40 hover:bg-green-500/10 transition-all text-left">
                <div className="font-display font-semibold text-gray-200 text-[11px] leading-tight truncate">{god.name}</div>
                <div className="text-[9px] text-gray-600 mt-0.5">{god.role}</div>
              </button>
            ))}
            {availableGods.length === 0 && (
              <p className="col-span-full text-xs text-gray-600 text-center py-4">No available gods</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PickTeamColumn({ team, picks, isMyTurn, canInteract, activeTeam, godPickFor, onSelectPick }) {
  const isA = team === 'A';
  const accent = isA ? 'text-blue-400' : 'text-red-400';
  const accentBg = isA ? 'bg-blue-500/15' : 'bg-red-500/15';
  const borderColor = isA ? 'border-blue-500/30' : 'border-red-500/30';
  const colBg = isA ? 'bg-[#0d1225]' : 'bg-[#1a0d0d]';

  const pendingPicks = picks.filter((p) => !p.godId);
  const isActive = activeTeam === team;

  return (
    <div className={`rounded-xl border ${borderColor} ${colBg} overflow-hidden ${isActive ? 'ring-1 ring-offset-1 ring-offset-brand-900 ' + (isA ? 'ring-blue-500/30' : 'ring-red-500/30') : ''}`}>
      <div className={`px-5 py-4 border-b ${borderColor} flex items-center justify-between`}>
        <h2 className={`font-display font-bold text-lg uppercase tracking-wider ${accent}`}>
          Team {isA ? 'Alpha' : 'Bravo'}
        </h2>
        <div className={`font-mono text-xs ${accent}`}>{picks.filter((p) => p.godId).length}/{picks.length} gods</div>
      </div>
      <div className="p-4 space-y-2">
        {picks.map((pick, i) => {
          const isPending = !pick.godId;
          const isSelected = godPickFor === pick.id;
          const clickable = canInteract && isMyTurn && isPending && isActive;

          return (
            <div key={pick.id}
              onClick={() => clickable && onSelectPick(pick.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
                ${isSelected ? 'bg-frost-500/15 border-frost-500/40 ring-1 ring-frost-500/30'
                  : clickable ? 'bg-brand-800/60 border-brand-600/20 hover:border-frost-500/30 hover:bg-frost-500/5 cursor-pointer'
                  : 'bg-brand-800/60 border-brand-600/20'
                }`}>
              <span className="w-5 h-5 rounded bg-brand-700 flex items-center justify-center text-[10px] font-mono text-gray-500 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-semibold text-sm text-gray-200 truncate">{pick.player?.name}</span>
                  <span className={`text-[9px] font-display font-bold uppercase px-1 py-0.5 rounded ${ROLE_COLORS[pick.player?.role]}`}>{pick.player?.role}</span>
                </div>
                {pick.god
                  ? <div className="text-xs text-gray-400 mt-0.5">{pick.god.name} <span className="text-gray-600">({pick.god.role})</span></div>
                  : isPending && isActive && canInteract && isMyTurn
                    ? <div className="text-[10px] text-frost-400 mt-0.5">Click to select god…</div>
                    : <div className="text-[10px] text-gray-600 mt-0.5">—</div>
                }
              </div>
              <span className={`shrink-0 w-7 h-7 rounded flex items-center justify-center font-mono font-bold text-xs ${accentBg} ${accent}`}>
                {pick.player?.pointValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
