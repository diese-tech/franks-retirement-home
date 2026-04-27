'use client';

import { useMemo, useState } from 'react';
import { GOD_ROLES } from '@/lib/constants';
import { BAN_ORDER, currentBanTeam, TOTAL_BANS } from '@/lib/draftOrder';
import ArenaBanner from '@/components/ArenaBanner';
import GodImage from '@/components/GodImage';
import RoleFilter from '@/components/RoleFilter';

export default function BanView({ state, role, callApi }) {
  const { bans, gods } = state;
  const [selected, setSelected] = useState(null);
  const [roleFilter, setRoleFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const banCount = bans.length;
  const activeTeam = currentBanTeam(banCount);
  const myTeam = role === 'captainA' ? 'A' : role === 'captainB' ? 'B' : null;
  const isAdmin = role === 'admin';
  const isMyTurn = isAdmin || (myTeam !== null && myTeam === activeTeam);
  const bannedIds = useMemo(() => new Set(bans.map((ban) => ban.godId)), [bans]);

  const filteredGods = useMemo(() => {
    return gods.filter((god) => {
      if (roleFilter !== 'All' && god.role !== roleFilter) return false;
      if (search && !god.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [gods, roleFilter, search]);

  const selectedGod = selected ? gods.find((god) => god.id === selected) : null;

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

  const undoBan = async (banId) => {
    if (!isAdmin || busy) return;
    setBusy(true);
    setError(null);
    try {
      await callApi('ban', { banId }, 'DELETE');
      setSelected(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-3">Ban Phase - 3 bans per team</div>
        <div className="grid grid-cols-6 gap-2">
          {BAN_ORDER.map((team, index) => {
            const ban = bans.find((item) => item.banOrder === index);
            const isCurrent = index === banCount && banCount < TOTAL_BANS;
            const isA = team === 'A';
            const accentBg = isA ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30';
            const accentText = isA ? 'text-blue-400' : 'text-red-400';
            const currentGlow = isCurrent ? (isA ? 'ring-2 ring-blue-500/50 animate-pulse' : 'ring-2 ring-red-500/50 animate-pulse') : '';

            return (
              <div key={index} className={`rounded-lg border px-2 py-2 text-center ${ban ? accentBg : 'bg-brand-900 border-brand-600/20'} ${currentGlow} transition-all`}>
                <div className={`text-[9px] font-display font-bold uppercase tracking-wider mb-1 ${accentText}`}>
                  Team {isA ? 'A' : 'B'}
                </div>
                {ban ? (
                  <div className="flex flex-col items-center gap-1">
                    <GodImage godId={ban.godId} name={ban.god?.name} size={32} />
                    <div className="text-[9px] font-display font-semibold text-gray-300 leading-tight truncate max-w-full">
                      {ban.god?.name ?? '-'}
                    </div>
                    {isAdmin && (
                      <button onClick={() => undoBan(ban.id)} className="text-[9px] text-gold-300 hover:text-gold-200 uppercase tracking-wider">
                        Undo
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-700">{isCurrent ? '*' : '-'}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {activeTeam && (
        <ArenaBanner
          team={activeTeam}
          subtext={isMyTurn && myTeam ? 'Your turn - select a god to ban' : 'is banning'}
        />
      )}

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">{error}</div>
      )}

      <div className="card">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-gray-400">God Pool</h3>
          <input
            placeholder="Search..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input-field text-xs w-40"
          />
          <RoleFilter options={['All', ...GOD_ROLES]} value={roleFilter} onChange={setRoleFilter} />
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
                className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                  banned
                    ? 'bg-brand-900/30 border-brand-700/20 opacity-40 cursor-not-allowed'
                    : isSelected
                      ? 'bg-orange-500/20 border-orange-500/50 ring-1 ring-orange-500/50'
                      : isMyTurn
                        ? 'bg-brand-800/60 border-brand-600/20 hover:border-brand-500/50 hover:bg-brand-700/60 cursor-pointer'
                        : 'bg-brand-800/40 border-brand-600/20 cursor-default'
                }`}
              >
                <GodImage godId={god.id} name={god.name} size={48} className="w-full aspect-square" />
                <div className="font-display font-semibold text-gray-200 text-[10px] leading-tight truncate w-full text-center">{god.name}</div>
                {banned && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-brand-900/60">
                    <span className="text-[9px] font-display font-bold uppercase text-gray-500">Banned</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {selected && isMyTurn && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-brand-600/30">
            <GodImage godId={selected} name={selectedGod?.name} size={28} />
            <span className="font-display font-bold text-sm text-gray-200">{selectedGod?.name}</span>
            <button onClick={() => setSelected(null)} className="ml-auto text-xs text-gray-500 hover:text-gray-300">Cancel</button>
            <button onClick={submitBan} disabled={busy} className="btn-danger text-xs px-4">
              {busy ? 'Banning...' : 'Confirm Ban'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
