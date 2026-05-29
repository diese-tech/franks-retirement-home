'use client';

import { useMemo, useState } from 'react';
import { GOD_ROLES, ROLE_COLORS } from '@/lib/constants';
import { currentPickTeam, PICK_ORDER, TOTAL_PICKS } from '@/lib/draftOrder';
import GodImage from '@/components/GodImage';
import GodWideArt from '@/components/GodWideArt';
import RoleFilter from '@/components/RoleFilter';
import { BrutalButton, PixelBadge, RetroWindow } from '@/components/ui';

export default function PickView({ state, role, callApi }) {
  const { picks, bans, gods, previouslyUsedGodIds = [] } = state;
  const [godFilter, setGodFilter] = useState('All');
  const [godSearch, setGodSearch] = useState('');
  const [selectedGodId, setSelectedGodId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const completedCount = picks.filter((pick) => pick.godId !== null).length;
  const activeTeam = currentPickTeam(completedCount);
  const myTeam = role === 'captainA' ? 'A' : role === 'captainB' ? 'B' : null;
  const isMyTurn = role === 'admin' || (myTeam !== null && myTeam === activeTeam);
  const isAdmin = role === 'admin';
  const isDone = completedCount >= TOTAL_PICKS;

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

  const teamA = useMemo(
    () => picks.filter((pick) => pick.team === 'A').sort((a, b) => a.pickOrder - b.pickOrder),
    [picks]
  );
  const teamB = useMemo(
    () => picks.filter((pick) => pick.team === 'B').sort((a, b) => a.pickOrder - b.pickOrder),
    [picks]
  );

  const godMap = useMemo(() => new Map(gods.map((god) => [god.id, god])), [gods]);
  const selectedGod = selectedGodId ? godMap.get(selectedGodId) ?? null : null;
  const vaultedGods = gods.filter((god) => previouslyUsedIds.has(god.id));
  const activePendingPick = (activeTeam === 'A' ? teamA : teamB).find((pick) => pick.godId === null) ?? null;

  const submitPick = async () => {
    if (!selectedGodId || !isMyTurn || isDone || busy) return;
    setBusy(true);
    setError(null);
    try {
      await callApi('pick', { godId: selectedGodId });
      setSelectedGodId(null);
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
      setSelectedGodId(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {!isDone && (
        <div className={`${activeTeam === 'A' ? 'bg-frh-xp-blue' : 'bg-frh-purple'} border-2 border-frh-ink px-4 py-3 shadow-[4px_4px_0px_rgba(0,0,0,0.6)]`}>
          <div className="font-ui text-sm uppercase tracking-widest text-white">
            Captain {activeTeam} is picking
          </div>
          <div className="font-mono text-xs text-white/80">
            {isMyTurn ? 'Your turn - select and confirm a god' : 'Waiting for the active captain'}
          </div>
        </div>
      )}

      <DraftHeader
        completedCount={completedCount}
        totalPicks={TOTAL_PICKS}
        activeTeam={activeTeam}
        isMyTurn={isMyTurn}
        isDone={isDone}
      />

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">{error}</div>
      )}

      <div className="space-y-5 xl:grid xl:space-y-0 xl:grid-cols-[320px_1fr_320px] xl:gap-5 xl:items-start">
        <div className="hidden xl:block">
          <TeamDraftColumn
            team="A"
            picks={teamA}
            isActive={activeTeam === 'A'}
            activePendingPickId={activePendingPick?.id ?? null}
            selectedGod={activeTeam === 'A' ? selectedGod : null}
            isAdmin={isAdmin}
            onUndoPick={undoPick}
          />
        </div>

        <div className="space-y-5">
          {/* Mobile-only compact team strips (sidebars are hidden below xl) */}
          <MobileTeamStrips teamA={teamA} teamB={teamB} activeTeam={activeTeam} />

          <RetroWindow title="GOD SELECTION GRID" className="overflow-hidden">
            <div className="relative min-h-[620px] bg-[linear-gradient(135deg,#1572a1_0%,#31539d_44%,#3f238d_100%)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.2),transparent_28%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_32%)]" />
              <div className="relative p-5">
                <div className="flex items-start gap-4 flex-wrap justify-between mb-4">
                  <div>
                    <div className="text-[10px] font-display uppercase tracking-[0.25em] text-gray-300/70">Pick Phase</div>
                    <div className="mt-2 font-display text-2xl font-bold uppercase tracking-[0.08em] text-white">
                      {isDone ? 'Draft Locked' : activeTeam === 'A' ? 'Team Alpha On The Clock' : 'Team Bravo On The Clock'}
                    </div>
                    <div className="mt-2 text-sm text-gray-200/80 max-w-2xl">
                      {isDone
                        ? 'All ten picks are locked for this game.'
                        : isMyTurn
                          ? 'Choose a god from the pool below. Your next open player slot will preview the selection until you lock it in.'
                          : 'Waiting for the other side to choose and lock in their next god.'}
                    </div>
                  </div>

                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {PICK_ORDER.map((team, index) => {
                      const done = index < completedCount;
                      const current = index === completedCount && !isDone;
                      const isA = team === 'A';
                      return (
                        <div
                          key={index}
                          className={`w-8 h-8 rounded-md flex items-center justify-center font-display font-bold text-[11px] border ${
                            done
                              ? isA
                                ? 'bg-cyan-400/20 border-cyan-300/30 text-cyan-100'
                                : 'bg-amber-400/20 border-amber-300/30 text-amber-100'
                              : current
                                ? isA
                                  ? 'bg-cyan-300/40 border-cyan-200/60 text-white ring-2 ring-cyan-200/40'
                                  : 'bg-amber-300/40 border-amber-200/60 text-white ring-2 ring-amber-200/40'
                                : 'bg-white/5 border-white/10 text-white/40'
                          }`}
                        >
                          {team}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-brand-950/35 backdrop-blur-sm p-4">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <input
                      placeholder="Search gods..."
                      value={godSearch}
                      onChange={(event) => setGodSearch(event.target.value)}
                      className="input-field text-sm flex-1 min-w-0 sm:flex-none sm:w-44"
                    />
                    <RoleFilter options={['All', ...GOD_ROLES]} value={godFilter} onChange={setGodFilter} />
                    <div className="ml-auto text-[10px] uppercase tracking-widest text-gray-400">
                      Vaulted: {vaultedGods.length}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[430px] overflow-y-auto pr-1">
                    {filteredGods.map((god) => {
                      const isBanned = bannedIds.has(god.id);
                      const isPicked = pickedIds.has(god.id);
                      const isPreviouslyUsed = previouslyUsedIds.has(god.id);
                      const isSelected = selectedGodId === god.id;
                      const isDisabled = isBanned || isPicked || isPreviouslyUsed || busy || !isMyTurn || isDone;
                      const reason = isBanned
                        ? 'Banned'
                        : isPicked
                          ? 'Picked'
                          : isPreviouslyUsed
                            ? 'Vaulted'
                            : !isMyTurn || isDone
                              ? 'Locked'
                              : null;

                      return (
                        <button
                          key={god.id}
                          onClick={() => !isDisabled && setSelectedGodId(isSelected ? null : god.id)}
                          disabled={isDisabled}
                          className={`relative overflow-hidden rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-frost-400/70 ring-2 ring-frost-400/30 shadow-lg shadow-frost-500/10'
                              : isDisabled
                                ? 'border-white/10 opacity-55 cursor-not-allowed'
                                : 'border-white/10 hover:border-white/30 hover:-translate-y-0.5'
                          }`}
                        >
                          <GodWideArt god={god} className="aspect-[1.1/1]">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 p-2">
                              <div className="font-display text-xs font-bold uppercase tracking-wide text-white truncate">{god.name}</div>
                              <div className="text-[10px] text-white/70 uppercase tracking-wider">{god.role}</div>
                            </div>
                            {reason && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/58 px-2">
                                <PixelBadge label={isPicked ? pickedTeamLabel(picks, god.id) : reason} color={isPicked ? pickedTeamColor(picks, god.id) : 'gray'} />
                                {isPreviouslyUsed && (
                                  <span className="text-[9px] text-gold-300 mt-1">Used earlier in set</span>
                                )}
                              </div>
                            )}
                          </GodWideArt>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-brand-950/35 backdrop-blur-sm p-4">
                  <div className="flex items-center gap-3">
                    {selectedGod ? (
                      <>
                        <GodWideArt god={selectedGod} className="w-28 h-16 rounded-xl shrink-0" opacity={0.65}>
                          <div className="absolute inset-0 bg-black/30" />
                        </GodWideArt>
                        <div className="min-w-0">
                          <div className="font-display text-sm font-bold uppercase tracking-wide text-white">{selectedGod.name}</div>
                          <div className="text-[11px] text-gray-300">
                            Previewing for {activePendingPick?.player?.name ?? 'next slot'} on Team {activeTeam === 'A' ? 'Alpha' : 'Bravo'}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-400">Select a god to preview it in the next open slot before lock-in.</div>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      {selectedGod && (
                        <BrutalButton onClick={() => setSelectedGodId(null)} variant="secondary" size="sm">Clear</BrutalButton>
                      )}
                      <BrutalButton
                        onClick={submitPick}
                        disabled={!selectedGod || !isMyTurn || isDone || busy}
                        className="min-h-[44px]"
                      >
                        {busy ? 'Locking...' : 'Confirm Pick'}
                      </BrutalButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </RetroWindow>

          <RetroWindow title="AIM EVENT LOG">
            <div className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Vaulted Gods</div>
            {vaultedGods.length === 0 ? (
              <p className="text-xs text-gray-600">No gods have been vaulted yet in this draft session.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {vaultedGods.map((god) => (
                  <div key={god.id} className="rounded-lg border border-gold-500/20 bg-gold-500/10 px-2 py-2 flex items-center gap-2">
                    <GodImage god={god} godId={god.id} name={god.name} size={22} className="rounded-md" />
                    <div className="min-w-0">
                      <div className="text-xs text-gray-200 truncate">{god.name}</div>
                      <div className="text-[9px] text-gold-300 uppercase tracking-wider">Vaulted</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </RetroWindow>
        </div>

        <div className="hidden xl:block">
          <TeamDraftColumn
            team="B"
            picks={teamB}
            isActive={activeTeam === 'B'}
            activePendingPickId={activePendingPick?.id ?? null}
            selectedGod={activeTeam === 'B' ? selectedGod : null}
            isAdmin={isAdmin}
            onUndoPick={undoPick}
            mirrored
          />
        </div>
      </div>
    </div>
  );
}

function MobileTeamStrips({ teamA, teamB, activeTeam }) {
  return (
    <div className="xl:hidden grid grid-cols-2 gap-2">
      {[{ picks: teamA, team: 'A' }, { picks: teamB, team: 'B' }].map(({ picks, team }) => {
        const isA = team === 'A';
        const isActive = activeTeam === team;
        return (
          <div key={team} className={`rounded-lg border p-2 ${isA ? 'border-cyan-300/30 bg-cyan-400/5' : 'border-amber-300/30 bg-amber-400/5'} ${isActive ? 'ring-1 ring-yellow-300/40' : ''}`}>
            <div className={`text-[9px] font-ui uppercase tracking-widest mb-1.5 ${isA ? 'text-cyan-300' : 'text-amber-300'}`}>
              Team {isA ? 'A' : 'B'}{isActive ? ' ▶' : ''}
            </div>
            <div className="space-y-0.5">
              {picks.map((pick) => (
                <div key={pick.id} className="flex items-center gap-1 min-h-[20px]">
                  {pick.god
                    ? <GodImage god={pick.god} godId={pick.god.id} name={pick.god.name} size={14} className="rounded shrink-0" />
                    : <div className="w-3.5 h-3.5 rounded bg-white/10 shrink-0" />
                  }
                  <span className="text-[10px] text-gray-300 truncate">
                    {pick.god?.name ?? pick.player?.name ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function pickedTeamLabel(picks, godId) {
  const pick = picks.find((item) => item.godId === godId);
  if (!pick) return 'Picked';
  return pick.team === 'A' ? 'Team A' : 'Team B';
}

function pickedTeamColor(picks, godId) {
  const pick = picks.find((item) => item.godId === godId);
  if (!pick) return 'gray';
  return pick.team === 'A' ? 'blue' : 'purple';
}

function DraftHeader({ completedCount, totalPicks: _totalPicks, activeTeam, isMyTurn, isDone }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ScorePanel
        team="A"
        picksLocked={Math.ceil(completedCount / 2)}
        active={activeTeam === 'A' && !isDone}
        helper={activeTeam === 'A' && !isDone ? (isMyTurn ? 'Your turn to lock a god' : 'Preparing next lock-in') : 'Waiting'}
      />
      <ScorePanel
        team="B"
        picksLocked={Math.floor(completedCount / 2)}
        active={activeTeam === 'B' && !isDone}
        helper={activeTeam === 'B' && !isDone ? (isMyTurn ? 'Your turn to lock a god' : 'Preparing next lock-in') : 'Waiting'}
      />
    </div>
  );
}

function ScorePanel({ team, picksLocked, active, helper }) {
  const isA = team === 'A';
  const shell = isA
    ? 'from-cyan-400/90 via-sky-500/55 to-sky-900/35 border-cyan-300/40'
    : 'from-violet-500/30 via-amber-500/55 to-amber-400/95 border-amber-300/40';

  return (
    <div className={`rounded-[28px] border bg-gradient-to-r ${shell} px-8 py-6 relative overflow-hidden`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_30%)]" />
      <div className="relative flex items-end justify-between">
        <div>
          <div className="text-[11px] font-display uppercase tracking-[0.25em] text-black/60">Team {isA ? 'Alpha' : 'Bravo'}</div>
          <div className="mt-2 text-xs uppercase tracking-widest text-black/50">{helper}</div>
        </div>
        <div className={`font-display text-7xl leading-none font-bold ${active ? 'text-black/90' : 'text-black/70'}`}>
          {picksLocked}
        </div>
      </div>
    </div>
  );
}

function TeamDraftColumn({ team, picks, isActive: _isActive, activePendingPickId, selectedGod, isAdmin, onUndoPick, mirrored = false }) {
  const isA = team === 'A';
  const borderColor = isA ? 'border-cyan-300/30' : 'border-amber-300/30';
  const lockedShell = isA ? 'from-cyan-300/10 to-sky-500/10' : 'from-violet-500/10 to-amber-400/10';

  return (
    <div className="space-y-3">
      {picks.map((pick, index) => {
        const assignedGod = pick.god;
        const previewGod = !assignedGod && pick.id === activePendingPickId ? selectedGod : null;
        const showWideArt = assignedGod || previewGod;
        const opacity = assignedGod ? 1 : 0.42;

        return (
          <div
            key={pick.id}
            className={`relative rounded-[22px] border ${borderColor} overflow-hidden min-h-[106px] ${showWideArt ? '' : `bg-gradient-to-r ${lockedShell}`}`}
          >
            {showWideArt ? (
              <GodWideArt god={assignedGod ?? previewGod} className="absolute inset-0" opacity={opacity}>
                <div className={`absolute inset-0 ${assignedGod ? 'bg-black/15' : 'bg-black/45'}`} />
              </GodWideArt>
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_30%)]" />
            )}

            <div className={`relative h-full flex items-end justify-between gap-3 p-4 ${mirrored ? 'text-right' : ''}`}>
              <div className={`flex-1 min-w-0 ${mirrored ? 'order-2' : ''}`}>
                <div className={`flex items-center gap-2 ${mirrored ? 'justify-end' : ''}`}>
                  <span className="w-6 h-6 rounded-md bg-black/45 backdrop-blur-sm flex items-center justify-center text-[10px] font-mono text-white/70 shrink-0">
                    {index + 1}
                  </span>
                  <span className="font-display font-bold text-2xl uppercase tracking-wide text-white drop-shadow-sm truncate">
                    {assignedGod?.name ?? previewGod?.name ?? pick.player?.name}
                  </span>
                </div>

                <div className={`mt-2 flex items-center gap-2 ${mirrored ? 'justify-end' : ''}`}>
                  {!assignedGod && !previewGod && (
                    <>
                      <span className={`text-[10px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[pick.player?.role]}`}>
                        {pick.player?.role}
                      </span>
                      <span className="text-sm text-gray-200/80 truncate">{pick.player?.name}</span>
                    </>
                  )}

                  {previewGod && !assignedGod && (
                    <span className="text-[11px] uppercase tracking-widest text-white/70">Selected - waiting for lock in</span>
                  )}

                  {assignedGod && (
                    <>
                      <span className="text-[11px] uppercase tracking-widest text-white/75">{pick.player?.name}</span>
                      <span className={`text-[10px] font-display font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_COLORS[pick.player?.role]}`}>
                        {pick.player?.role}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className={`shrink-0 ${mirrored ? 'order-1' : ''}`}>
                {assignedGod ? (
                  <div className="flex items-center gap-2">
                    <GodImage god={assignedGod} godId={assignedGod.id} name={assignedGod.name} size={36} className="rounded-lg border border-white/20" />
                    {isAdmin && (
                      <button
                        onClick={() => onUndoPick(pick.id)}
                        className="px-2 py-1 rounded-md bg-black/45 text-[10px] uppercase tracking-widest text-gold-300 hover:text-gold-200"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] uppercase tracking-widest text-white/55">
                    {pick.id === activePendingPickId ? 'Active Slot' : 'Queued'}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div className={`grid grid-cols-5 gap-1.5 rounded-2xl border ${borderColor} bg-brand-900/70 p-2`}>
        {picks.map((pick) => (
          <div
            key={`${pick.id}-mini`}
            className={`aspect-square rounded-lg border ${
              pick.god
                ? isA
                  ? 'border-cyan-300/50 bg-cyan-400/20'
                  : 'border-amber-300/50 bg-amber-400/20'
                : 'border-white/10 bg-white/5'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
