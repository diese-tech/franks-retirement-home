'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RetroWindow, BrutalButton, PixelBadge } from '@/components/ui';
import { ROLE_COLORS } from '@/lib/constants';
import { flattenFormat } from '@/lib/playerDraftOrder';

function RoleBadge({ role }) {
  const colors = ROLE_COLORS[role] ?? 'bg-gray-500/15 text-gray-400';
  return (
    <span className={`${colors} font-mono text-[10px] uppercase px-1.5 py-0.5 shrink-0`}>
      {role ?? '?'}
    </span>
  );
}

// Pick order strip — shows the full snake sequence with current pick highlighted
function PickOrderStrip({ format, currentPickIndex, divisionTeams }) {
  const teamById = Object.fromEntries((divisionTeams ?? []).map(t => [t.id, t]));
  const flat = flattenFormat(format ?? []);
  const stripRef = useRef(null);

  // Scroll current pick into view
  useEffect(() => {
    const el = stripRef.current?.querySelector('[data-current="true"]');
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [currentPickIndex]);

  if (!flat.length) return null;

  return (
    <div className="border-t border-brand-700 pt-2 pb-1">
      <p className="font-ui text-[9px] uppercase tracking-widest text-gray-600 mb-1 px-1">Pick Order</p>
      <div ref={stripRef} className="flex gap-1 overflow-x-auto pb-1 px-1">
        {flat.map((teamId, i) => {
          const t = teamById[teamId];
          const isCurrent = i === currentPickIndex;
          const isPast = i < currentPickIndex;
          return (
            <div
              key={i}
              data-current={isCurrent ? 'true' : undefined}
              title={`Pick ${i + 1}: ${t?.name ?? teamId}`}
              className={`shrink-0 w-9 h-9 flex flex-col items-center justify-center border-2 transition-all ${
                isCurrent
                  ? 'border-frh-yellow bg-frh-yellow/10 text-frh-yellow'
                  : isPast
                  ? 'border-brand-700 bg-transparent text-gray-700 opacity-40'
                  : 'border-brand-700 text-gray-500 hover:border-brand-500'
              }`}
            >
              <span className="font-mono text-[9px] leading-none">{t?.tag?.slice(0, 4) ?? '?'}</span>
              <span className="font-mono text-[8px] leading-none text-gray-600 mt-0.5">{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Team column showing picks so far
function TeamColumn({ team, picks, isActive }) {
  return (
    <div className={`border-2 p-2 min-h-[80px] ${isActive ? 'border-frh-yellow' : 'border-brand-700'}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <p className={`font-ui text-[10px] uppercase tracking-wider ${isActive ? 'text-frh-yellow' : 'text-gray-500'}`}>
          {team.tag}
        </p>
        {isActive && (
          <span className="font-mono text-[8px] text-frh-yellow animate-pulse">ON THE CLOCK</span>
        )}
      </div>
      <div className="space-y-1">
        {picks.map(p => (
          <div key={p.id} className="flex items-center gap-1">
            <RoleBadge role={p.player.role} />
            <span className="font-mono text-[10px] text-gray-300 truncate">{p.player.name}</span>
          </div>
        ))}
        {picks.length === 0 && (
          <p className="text-[9px] text-gray-700">No picks yet</p>
        )}
      </div>
    </div>
  );
}

// Available player row — clickable if it's your turn
function PlayerRow({ player, onSelect, disabled, isSelected }) {
  return (
    <button
      onClick={() => !disabled && onSelect(player)}
      disabled={disabled}
      className={`text-left w-full flex items-center gap-2 px-2 py-2 border transition-all min-h-[44px] ${
        isSelected
          ? 'border-frh-yellow bg-frh-yellow/10'
          : disabled
          ? 'border-brand-800 bg-transparent opacity-40 cursor-not-allowed'
          : 'border-brand-700 hover:border-frh-yellow bg-brand-950/40 hover:bg-brand-900/60'
      }`}
    >
      <RoleBadge role={player.role} />
      <span className="font-mono text-xs text-gray-200 flex-1 truncate">{player.name}</span>
      {player.discordUsername && (
        <span className="font-mono text-[9px] text-gray-600 truncate hidden sm:block">{player.discordUsername}</span>
      )}
    </button>
  );
}

// Draft log entry
function PickLogEntry({ pick, teams }) {
  const team = teams.find(t => t.id === pick.teamId);
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 border-b border-brand-800 text-[10px]">
      <span className="font-mono text-gray-600 shrink-0 w-8">#{pick.pickNumber}</span>
      <span className="font-ui text-gray-500 truncate shrink-0 w-10">{team?.tag ?? '?'}</span>
      <RoleBadge role={pick.player.role} />
      <span className="font-mono text-gray-300 truncate">{pick.player.name}</span>
    </div>
  );
}

const STATUS_COLOR = { pending: 'blue', active: 'lime', paused: 'purple', complete: 'cream' };

export default function PlayerDraftClient({
  draftId,
  initialState,
  isAdmin,
  captainTeamId,
  divisionTeams,
  isAuthenticated,
}) {
  const pathname = usePathname();
  const [state, setState] = useState(initialState);
  const [connected, setConnected] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [pickError, setPickError] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const { draft, format, currentTeamId, secondsRemaining, picks, eligiblePlayers } = state;

  // SSE connection for live state
  useEffect(() => {
    const es = new EventSource(`/api/player-drafts/${draftId}/stream`);
    es.addEventListener('state', (e) => {
      setState(JSON.parse(e.data));
      setConnected(true);
    });
    es.addEventListener('error', () => setConnected(false));
    es.addEventListener('open', () => setConnected(true));
    return () => es.close();
  }, [draftId]);

  // Countdown timer
  const [countdown, setCountdown] = useState(secondsRemaining);
  useEffect(() => {
    setCountdown(state.secondsRemaining);
  }, [state.secondsRemaining]);
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => Math.max(0, (c ?? 0) - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Determine if current viewer can pick
  const myTeamId = captainTeamId;
  const isMyTurn = draft.status === 'active' && currentTeamId && (
    isAdmin ? true : myTeamId === currentTeamId
  );

  const picksByTeam = {};
  for (const p of picks) {
    if (!picksByTeam[p.teamId]) picksByTeam[p.teamId] = [];
    picksByTeam[p.teamId].push(p);
  }

  const ROLES = ['Solo', 'Jungle', 'Mid', 'Support', 'Carry', 'Fill'];
  const filteredPlayers = (eligiblePlayers ?? []).filter(p => {
    if (roleFilter !== 'ALL' && p.role !== roleFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const submitPick = async () => {
    if (!selectedPlayer || !currentTeamId) return;
    setConfirming(true);
    setPickError('');
    try {
      const res = await fetch(`/api/player-drafts/${draftId}/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: currentTeamId, playerId: selectedPlayer.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPickError(data.error ?? 'Pick failed');
      } else {
        setSelectedPlayer(null);
      }
    } catch {
      setPickError('Network error — try again');
    } finally {
      setConfirming(false);
    }
  };

  const currentTeam = divisionTeams.find(t => t.id === currentTeamId);
  const myTeam = divisionTeams.find(t => t.id === myTeamId);

  return (
    <div className="min-h-screen bg-frh-base text-frh-text">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4">

        {/* Header */}
        <RetroWindow
          title={`PLAYER DRAFT — ${draft.season?.name ?? ''}`}
          titleBarColor="yellow"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-ui text-sm text-frh-text">{draft.name}</span>
                <PixelBadge label={draft.status} color={STATUS_COLOR[draft.status] ?? 'blue'} />
                <span className="font-mono text-[10px] text-gray-500">{draft.division?.name}</span>
                {isAdmin && <PixelBadge label="Admin" color="orange" />}
                {myTeam && !isAdmin && (
                  <PixelBadge label={`Capt: ${myTeam.tag}`} color="purple" />
                )}
              </div>
              <p className="font-mono text-[10px] text-gray-600 mt-0.5">
                {draft.rounds} rounds · {divisionTeams.length} teams · {picks.length} picks made
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-600'}`} />
              <span className="font-mono text-[9px] text-gray-600">{connected ? 'LIVE' : 'connecting…'}</span>
            </div>
          </div>

          {/* Pick order strip */}
          {format && (
            <PickOrderStrip
              format={format}
              currentPickIndex={draft.currentPickIndex}
              divisionTeams={divisionTeams}
            />
          )}
        </RetroWindow>

        {/* Status banners */}
        {draft.status === 'pending' && (
          <div className="border-2 border-brand-700 px-4 py-3 bg-brand-900/30 text-center">
            <p className="font-mono text-xs text-gray-500">Draft has not started yet. Waiting for admin to begin.</p>
            {!Array.isArray(draft.currentOrder) || draft.currentOrder.length === 0 ? (
              <p className="font-mono text-[10px] text-yellow-600 mt-1">Pick order not set — admin must set order before starting.</p>
            ) : (
              <p className="font-mono text-[10px] text-green-600 mt-1">Pick order is set. Ready to start.</p>
            )}
          </div>
        )}

        {draft.status === 'paused' && (
          <div className="border-2 border-purple-700 px-4 py-3 bg-purple-900/10 text-center">
            <p className="font-mono text-xs text-purple-400">Draft is paused — waiting for admin to resume.</p>
          </div>
        )}

        {draft.status === 'complete' && (
          <div className="border-2 border-green-700 px-4 py-3 bg-green-900/10 text-center">
            <p className="font-mono text-xs text-green-400">Draft is complete! All picks are final.</p>
          </div>
        )}

        {/* Access banner: shown when viewer has no captain rights for this draft */}
        {!isAdmin && !captainTeamId && (
          <div className="border-2 border-yellow-700 px-4 py-3 bg-yellow-900/10 text-center space-y-2">
            {!isAuthenticated ? (
              <>
                <p className="font-mono text-xs text-yellow-400">
                  Log in with Discord to participate as a captain.
                </p>
                <Link
                  href={`/api/auth/discord?returnUrl=${encodeURIComponent(pathname)}`}
                  prefetch={false}
                  className="inline-block font-mono text-[11px] px-3 py-1.5 border border-yellow-600 text-yellow-400 hover:bg-yellow-900/30"
                >
                  Login with Discord
                </Link>
              </>
            ) : (
              <p className="font-mono text-xs text-yellow-400">
                You are not a captain for the <strong>{draft.division?.name}</strong> division.
                {' '}Viewing as spectator.
              </p>
            )}
          </div>
        )}

        {/* Active turn banner */}
        {draft.status === 'active' && currentTeam && (
          <div className={`border-2 px-4 py-3 ${isMyTurn && !isAdmin ? 'border-frh-yellow bg-frh-yellow/5' : 'border-brand-700 bg-brand-900/20'}`}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1">
                <p className="font-ui text-xs uppercase tracking-widest text-gray-500">On the Clock</p>
                <p className="font-mono text-sm text-frh-yellow font-bold">{currentTeam.name}</p>
                <p className="font-mono text-[10px] text-gray-500">{currentTeam.tag} · Pick {draft.currentPickIndex + 1}</p>
              </div>
              {countdown !== null && countdown > 0 && (
                <div className={`text-right ${countdown <= 30 ? 'text-red-400' : 'text-gray-400'}`}>
                  <p className="font-mono text-2xl font-bold">{countdown}s</p>
                  <p className="font-mono text-[9px] uppercase text-gray-600">remaining</p>
                </div>
              )}
            </div>
            {isMyTurn && !isAdmin && (
              <p className="font-mono text-[11px] text-frh-yellow mt-2 animate-pulse">Your turn — select a player below</p>
            )}
          </div>
        )}

        {/* Main layout: team columns + player pool */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">

          {/* Left: team columns */}
          <div className="space-y-3">
            <p className="font-ui text-[10px] uppercase tracking-widest text-gray-600">Team Picks</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-3 gap-2">
              {divisionTeams.map(team => (
                <TeamColumn
                  key={team.id}
                  team={team}
                  picks={picksByTeam[team.id] ?? []}
                  isActive={team.id === currentTeamId && draft.status === 'active'}
                />
              ))}
            </div>
          </div>

          {/* Right: available players */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-ui text-[10px] uppercase tracking-widest text-gray-600 flex-1">
                Available Players <span className="text-gray-700 normal-case tracking-normal">({filteredPlayers.length})</span>
              </p>
              {!isMyTurn && draft.status === 'active' && (
                <span className="font-mono text-[9px] text-gray-700">Waiting for {currentTeam?.name ?? '…'}</span>
              )}
            </div>

            {/* Filters */}
            <div className="flex gap-1.5 flex-wrap">
              {['ALL', ...ROLES].map(r => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`font-mono text-[10px] px-2 py-1 min-h-[32px] border transition-colors ${
                    roleFilter === r
                      ? 'border-frh-yellow text-frh-yellow bg-frh-yellow/10'
                      : 'border-brand-700 text-gray-500 hover:border-brand-500'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search players…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-brand-950 border-2 border-brand-700 focus:border-frh-yellow outline-none px-2 py-2 font-mono text-sm text-gray-200 placeholder-gray-700"
            />

            {/* Confirm pick overlay */}
            {selectedPlayer && (
              <div className="border-2 border-frh-yellow bg-frh-yellow/5 px-3 py-3 space-y-2">
                <p className="font-ui text-[10px] uppercase tracking-widest text-frh-yellow">Confirm Pick</p>
                <div className="flex items-center gap-2">
                  <RoleBadge role={selectedPlayer.role} />
                  <span className="font-mono text-sm text-frh-yellow font-bold">{selectedPlayer.name}</span>
                </div>
                {pickError && <p className="font-mono text-[10px] text-red-400">{pickError}</p>}
                <div className="flex gap-2">
                  <BrutalButton
                    size="sm"
                    variant="primary"
                    onClick={submitPick}
                    disabled={confirming}
                    className="min-h-[44px]"
                  >
                    {confirming ? 'Picking…' : `Draft ${selectedPlayer.name}`}
                  </BrutalButton>
                  <BrutalButton
                    size="sm"
                    variant="secondary"
                    onClick={() => { setSelectedPlayer(null); setPickError(''); }}
                    className="min-h-[44px]"
                  >
                    Cancel
                  </BrutalButton>
                </div>
              </div>
            )}

            {/* Player list */}
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {filteredPlayers.length === 0 ? (
                <p className="font-mono text-[10px] text-gray-700 text-center py-4">
                  {eligiblePlayers?.length === 0 ? 'All players have been drafted.' : 'No players match filter.'}
                </p>
              ) : (
                filteredPlayers.map(p => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    onSelect={setSelectedPlayer}
                    disabled={!isMyTurn || confirming}
                    isSelected={selectedPlayer?.id === p.id}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Draft log */}
        {picks.length > 0 && (
          <RetroWindow title="DRAFT LOG">
            <div className="divide-y divide-brand-800 max-h-64 overflow-y-auto">
              {[...picks].reverse().map(p => (
                <PickLogEntry key={p.id} pick={p} teams={divisionTeams} />
              ))}
            </div>
          </RetroWindow>
        )}

        {/* Admin back link */}
        {isAdmin && (
          <p className="text-center">
            <Link href="/admin" className="font-mono text-[10px] text-gray-600 hover:text-frh-yellow underline">
              ← Back to Admin
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
