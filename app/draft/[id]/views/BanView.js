'use client';

import { useState, useMemo } from 'react';
import { GOD_ROLES } from '@/lib/constants';
import { BAN_ORDER, currentBanTeam, TOTAL_BANS } from '@/lib/draftOrder';

export default function BanView({ state, role, callApi }) {
  const { bans, gods } = state;
  const [selected, setSelected] = useState(null); // godId
  const [roleFilter, setRoleFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const banCount = bans.length;
  const activeTeam = currentBanTeam(banCount);
  const myTeam = role === 'captainA' ? 'A' : role === 'captainB' ? 'B' : null;
  const isMyTurn = role === 'admin' || (myTeam !== null && myTeam === activeTeam);
  const bannedIds = useMemo(() => new Set(bans.map((b) => b.godId)), [bans]);

  const filteredGods = useMemo(() => {
    return gods.filter((g) => {
      if (roleFilter !== 'All' && g.role !== roleFilter) return false;
      if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [gods, roleFilter, search]);

  const submitBan = async () => {
    if (!selected || !isMyTurn || busy) return;
    setBusy(true);
    setError(null);
    try {
      await callApi('ban', { godId: selected });
      setSelected(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const teamABans = bans.filter((b) => b.team === 'A').sort((a, b) => a.banOrder - b.banOrder);
  const teamBBans = bans.filter((b) => b.team === 'B').sort((a, b) => a.banOrder - b.banOrder);

  return (
    <div className="space-y-4">
      {/* Ban slots */}
      <div className="card">
        <div className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-3">Ban Phase — 3 bans per team</div>
        <div className="grid grid-cols-6 gap-2">
          {BAN_ORDER.map((team, idx) => {
            const ban = bans.find((b) => b.banOrder === idx);
            const isCurrent = idx === banCount && banCount < TOTAL_BANS;
            const isA = team === 'A';
            const accentBg = isA ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30';
            const accentText = isA ? 'text-blue-400' : 'text-red-400';
            const currentGlow = isCurrent ? (isA ? 'ring-2 ring-blue-500/50 animate-pulse' : 'ring-2 ring-red-500/50 animate-pulse') : '';

            return (
              <div key={idx} className={`rounded-lg border px-2 py-2 text-center ${ban ? accentBg : 'bg-brand-900 border-brand-600/20'} ${currentGlow} transition-all`}>
                <div className={`text-[9px] font-display font-bold uppercase tracking-wider mb-1 ${accentText}`}>
                  Team {isA ? 'α' : 'β'}
                </div>
                {ban
                  ? <div className="text-xs font-display font-semibold text-gray-300 leading-tight">{ban.god?.name ?? '—'}</div>
                  : <div className="text-[10px] text-gray-700">{isCurrent ? '◈' : '—'}</div>
                }
              </div>
            );
          })}
        </div>
      </div>

      {/* Turn indicator */}
      {activeTeam && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
          activeTeam === 'A' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30'
        }`}>
          <span className={`w-2 h-2 rounded-full animate-pulse ${activeTeam === 'A' ? 'bg-blue-400' : 'bg-red-400'}`} />
          <span className={`font-display font-bold text-sm uppercase tracking-wider ${activeTeam === 'A' ? 'text-blue-400' : 'text-red-400'}`}>
            Team {activeTeam === 'A' ? 'Alpha' : 'Bravo'} is banning
          </span>
          {isMyTurn && myTeam && (
            <span className="ml-auto text-xs text-gray-400">Select a god to ban</span>
          )}
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">{error}</div>
      )}

      {/* Selected god confirm bar */}
      {selected && isMyTurn && (
        <div className="flex items-center gap-3 px-4 py-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
          <span className="font-display font-bold text-sm text-gray-200">
            Banning: {gods.find((g) => g.id === selected)?.name}
          </span>
          <button onClick={() => setSelected(null)} className="ml-auto text-xs text-gray-500 hover:text-gray-300">Cancel</button>
          <button onClick={submitBan} disabled={busy}
            className="btn-danger text-xs px-4">
            {busy ? 'Banning…' : 'Confirm Ban'}
          </button>
        </div>
      )}

      {/* God grid */}
      <div className="card">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-gray-400">God Pool</h3>
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="input-field text-xs w-40" />
          <div className="flex flex-wrap gap-1">
            {['All', ...GOD_ROLES].map((r) => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-2 py-0.5 rounded text-[10px] font-display font-semibold uppercase tracking-wider transition-colors ${
                  roleFilter === r ? 'bg-frost-500/20 text-frost-400 border border-frost-500/40' : 'bg-brand-700/50 text-gray-500 border border-transparent hover:text-gray-300'
                }`}>{r}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5 max-h-[420px] overflow-y-auto pr-1">
          {filteredGods.map((god) => {
            const banned = bannedIds.has(god.id);
            const isSelected = selected === god.id;
            return (
              <button
                key={god.id}
                onClick={() => { if (!banned && isMyTurn) setSelected(isSelected ? null : god.id); }}
                disabled={banned || !isMyTurn}
                className={`relative px-2 py-2 rounded-lg border text-left transition-all text-xs
                  ${banned
                    ? 'bg-brand-900/30 border-brand-700/20 opacity-40 cursor-not-allowed'
                    : isSelected
                      ? 'bg-orange-500/20 border-orange-500/50 ring-1 ring-orange-500/50'
                      : isMyTurn
                        ? 'bg-brand-800/60 border-brand-600/20 hover:border-brand-500/50 hover:bg-brand-700/60 cursor-pointer'
                        : 'bg-brand-800/40 border-brand-600/20 cursor-default'
                  }`}
              >
                <div className="font-display font-semibold text-gray-200 text-[11px] leading-tight truncate">{god.name}</div>
                <div className="text-[9px] text-gray-600 mt-0.5">{god.role}</div>
                {banned && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                    <span className="text-[9px] font-display font-bold uppercase text-gray-600">Banned</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
