'use client';

import { useState } from 'react';
import { ROLE_COLORS } from '@/lib/constants';
import GodImage from '@/components/GodImage';
import { RetroWindow } from '@/components/ui';

// Shown below CompleteView for match-bound drafts (draft.gameId != null).
// Captains assign a player to each of their team's pick slots.
// Role 'spectator' sees a read-only view. Admin can edit both teams.
export default function LineupConfirmView({ state, role, draftKey, draftId, rosterA = [], rosterB = [] }) {
  const { picks } = state;
  const teamA = picks.filter((p) => p.team === 'A').sort((a, b) => a.pickOrder - b.pickOrder);
  const teamB = picks.filter((p) => p.team === 'B').sort((a, b) => a.pickOrder - b.pickOrder);

  const canEditA = role === 'admin' || role === 'captainA';
  const canEditB = role === 'admin' || role === 'captainB';

  return (
    <RetroWindow title="LINEUP CONFIRMATION" titleBarColor="yellow">
      <p className="text-xs text-gray-500 mb-4">
        Assign each player to their god. Both teams must confirm before the match starts.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineupColumn
          team="A"
          picks={teamA}
          roster={rosterA}
          canEdit={canEditA}
          draftKey={draftKey}
          draftId={draftId}
        />
        <LineupColumn
          team="B"
          picks={teamB}
          roster={rosterB}
          canEdit={canEditB}
          draftKey={draftKey}
          draftId={draftId}
        />
      </div>
    </RetroWindow>
  );
}

function LineupColumn({ team, picks, roster, canEdit, draftKey, draftId }) {
  const [localPicks, setLocalPicks] = useState(picks);
  const [busy, setBusy] = useState({});
  const [err, setErr] = useState('');
  const isA = team === 'A';

  const assignPlayer = async (pickId, playerId) => {
    setBusy((b) => ({ ...b, [pickId]: true }));
    setErr('');
    const res = await fetch(`/api/drafts/${draftId}/picks/${pickId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: draftKey, playerId: playerId || null }),
    });
    const data = await res.json();
    setBusy((b) => ({ ...b, [pickId]: false }));
    if (!res.ok) { setErr(data.error ?? 'Failed to update'); return; }
    setLocalPicks((prev) => prev.map((p) => p.id === pickId ? { ...p, playerId: data.playerId, player: data.player } : p));
  };

  // Players already assigned to another slot (exclude from other selects)
  const assignedPlayerIds = new Set(localPicks.map((p) => p.playerId).filter(Boolean));

  const allConfirmed = localPicks.length > 0 && localPicks.every((p) => p.playerId);

  return (
    <div>
      <div className={`flex items-center gap-2 mb-3 font-ui text-xs uppercase tracking-widest ${isA ? 'text-blue-400' : 'text-purple-400'}`}>
        Team {team}
        {allConfirmed && <span className="text-green-400 ml-1">✓ Confirmed</span>}
      </div>

      {err && <p className="text-xs text-red-400 mb-2">{err}</p>}

      <div className="space-y-2">
        {localPicks.map((pick) => {
          const availablePlayers = roster.filter(
            (m) => !assignedPlayerIds.has(m.player.id) || m.player.id === pick.playerId
          );

          return (
            <div key={pick.id} className={`flex items-center gap-2 px-3 py-2 border min-h-[44px] ${pick.playerId ? 'border-green-600/40 bg-green-500/5' : 'border-brand-700 bg-brand-900/40'}`}>
              {/* God */}
              <div className="flex items-center gap-1.5 w-16 sm:w-28 shrink-0">
                {pick.god
                  ? <>
                      <GodImage godId={pick.god.id} name={pick.god.name} size={20} className="rounded-sm" />
                      <span className="text-xs text-gray-300 truncate">{pick.god.name}</span>
                    </>
                  : <span className="text-xs text-gray-600">No god</span>
                }
              </div>

              {/* Player selector */}
              {canEdit ? (
                <select
                  value={pick.playerId ?? ''}
                  onChange={(e) => assignPlayer(pick.id, e.target.value)}
                  disabled={busy[pick.id]}
                  className="select-field flex-1 text-sm py-1.5"
                >
                  <option value="">— assign player —</option>
                  {availablePlayers.map((m) => (
                    <option key={m.player.id} value={m.player.id}>
                      {m.player.name} ({m.player.role})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="flex-1 text-sm font-display font-medium text-gray-300">
                  {pick.player
                    ? <>
                        {pick.player.name}
                        <span className={`ml-1.5 text-[9px] font-bold uppercase px-1 py-0.5 rounded ${ROLE_COLORS[pick.player.role]}`}>{pick.player.role}</span>
                      </>
                    : <span className="text-gray-600 text-xs">Unassigned</span>
                  }
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
