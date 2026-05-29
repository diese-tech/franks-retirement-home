'use client';

import { useMemo, useState } from 'react';
import { GOD_ROLES } from '@/lib/constants';
import { BAN_ORDER, currentBanTeam, TOTAL_BANS } from '@/lib/draftOrder';
import GodImage from '@/components/GodImage';
import RoleFilter from '@/components/RoleFilter';
import { BrutalButton, PixelBadge, RetroWindow } from '@/components/ui';

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
      {activeTeam && (
        <div className={`${activeTeam === 'A' ? 'bg-frh-xp-blue' : 'bg-frh-purple'} border-2 border-frh-ink px-4 py-3 shadow-[4px_4px_0px_rgba(0,0,0,0.6)]`}>
          <div className="font-ui text-sm uppercase tracking-widest text-white">
            Captain {activeTeam} is banning
          </div>
          <div className="font-mono text-xs text-white/80">
            {isMyTurn && myTeam ? 'Your turn - select a god to ban' : 'Waiting for the active captain'}
          </div>
        </div>
      )}

      <RetroWindow title="BAN ORDER">
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          {BAN_ORDER.map((team, index) => {
            const ban = bans.find((item) => item.banOrder === index);
            const isCurrent = index === banCount && banCount < TOTAL_BANS;
            const isA = team === 'A';

            return (
              <div key={index} className={`border-2 px-2 py-2 text-center ${isA ? 'border-frh-xp-blue bg-frh-xp-blue/10' : 'border-frh-purple bg-frh-purple/10'} ${isCurrent ? 'ring-2 ring-frh-yellow' : ''}`}>
                <div className={`text-[9px] font-ui uppercase tracking-widest mb-1 ${isA ? 'text-frh-xp-blue' : 'text-frh-purple'}`}>
                  Team {isA ? 'A' : 'B'}
                </div>
                {ban ? (
                  <div className="flex flex-col items-center gap-1">
                    <GodImage godId={ban.godId} name={ban.god?.name} size={32} />
                    <div className="text-[9px] font-display font-semibold text-gray-300 leading-tight truncate max-w-full">
                      {ban.god?.name ?? '-'}
                    </div>
                    {isAdmin && (
                      <BrutalButton onClick={() => undoBan(ban.id)} variant="ghost" size="sm">Undo</BrutalButton>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-700">{isCurrent ? '*' : '-'}</div>
                )}
              </div>
            );
          })}
        </div>
      </RetroWindow>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-mono">{error}</div>
      )}

      <RetroWindow title="GOD POOL">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <input
            placeholder="Search..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input-field text-sm flex-1 min-w-0 sm:flex-none sm:w-40"
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
                className={`relative flex flex-col items-center gap-1 p-2 border-2 transition-all min-h-[44px] ${
                  banned
                    ? 'bg-brand-900/30 border-brand-700 opacity-40 cursor-not-allowed'
                    : isSelected
                      ? 'bg-frh-orange/20 border-frh-orange ring-2 ring-frh-orange/50'
                      : isMyTurn
                        ? 'bg-brand-800/60 border-brand-700 hover:border-frh-yellow hover:shadow-[3px_3px_0px_rgba(0,0,0,0.6)] cursor-pointer'
                        : 'bg-brand-800/40 border-brand-700 cursor-default'
                }`}
              >
                <GodImage godId={god.id} name={god.name} size={48} className="w-full aspect-square" />
                <div className="font-display font-semibold text-gray-200 text-[10px] leading-tight truncate w-full text-center">{god.name}</div>
                {banned && (
                  <div className="absolute inset-0 flex items-center justify-center bg-brand-900/70">
                    <PixelBadge label="Banned" color="gray" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3 pt-3 border-t border-brand-600/30">
          {selectedGod ? (
            <>
              <GodImage godId={selected} name={selectedGod?.name} size={28} />
              <span className="font-display font-bold text-sm text-gray-200">{selectedGod?.name}</span>
              <BrutalButton onClick={() => setSelected(null)} variant="ghost" size="sm" className="sm:ml-auto">Cancel</BrutalButton>
            </>
          ) : (
            <span className="text-xs text-gray-600 font-mono">Select a god to unlock confirmation.</span>
          )}
          <BrutalButton onClick={submitBan} disabled={!selected || !isMyTurn || busy} variant="danger" className="sm:ml-0 min-h-[44px] w-full sm:w-auto">
            {busy ? 'Banning...' : 'Confirm Ban'}
          </BrutalButton>
        </div>
      </RetroWindow>
    </div>
  );
}
