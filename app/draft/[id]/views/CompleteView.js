'use client';

import { ROLE_COLORS } from '@/lib/constants';
import GodImage from '@/components/GodImage';
import { BrutalButton, PixelBadge, RetroWindow } from '@/components/ui';

export default function CompleteView({ state, role, onAdminAction }) {
  const { picks, bans, gods, usedGodIds = [] } = state;

  const teamA = picks.filter((p) => p.team === 'A').sort((a, b) => a.pickOrder - b.pickOrder);
  const teamB = picks.filter((p) => p.team === 'B').sort((a, b) => a.pickOrder - b.pickOrder);
  const vaultedGods = gods.filter((god) => usedGodIds.includes(god.id));

  return (
    <div className="space-y-4">
      <RetroWindow title="DRAFT COMPLETE" titleBarColor="yellow">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="font-ui text-sm uppercase tracking-widest text-frh-yellow">Final Rosters Locked</div>
          <div className="sm:ml-auto flex gap-2 flex-wrap">
            <BrutalButton href="/" variant="secondary">Back To Home</BrutalButton>
            {role === 'admin' && (
              <BrutalButton onClick={() => onAdminAction?.('reopenLastPick')} variant="danger">Reopen Draft</BrutalButton>
            )}
          </div>
        </div>
      </RetroWindow>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinalTeam team="A" picks={teamA} />
        <FinalTeam team="B" picks={teamB} />
      </div>

      {bans.length > 0 && (
        <RetroWindow title="BANNED GODS STRIP">
          <div className="flex flex-wrap gap-2">
            {bans.map((ban) => (
              <span key={ban.id} className="inline-flex items-center gap-2 px-2 py-1 bg-brand-900 border border-brand-700 text-xs text-gray-400 font-display">
                <PixelBadge label="Banned" color={ban.team === 'A' ? 'blue' : 'purple'} />
                {ban.god?.name ?? '-'}
              </span>
            ))}
          </div>
        </RetroWindow>
      )}

      {vaultedGods.length > 0 && (
        <RetroWindow title="VAULTED GODS">
          <div className="flex flex-wrap gap-2">
            {vaultedGods.map((god) => (
              <span key={god.id} className="inline-flex items-center gap-2 px-2 py-1 bg-gold-500/10 border border-gold-500/20 text-xs text-gray-300 font-display">
                <GodImage godId={god.id} name={god.name} size={18} className="rounded-sm" />
                {god.name}
              </span>
            ))}
          </div>
        </RetroWindow>
      )}
    </div>
  );
}

function FinalTeam({ team, picks }) {
  const isA = team === 'A';

  return (
    <RetroWindow title={`TEAM ${isA ? 'A' : 'B'} FINAL ROSTER`} titleBarColor={isA ? 'blue' : 'purple'}>
      <div className="space-y-2">
        {picks.map((pick, i) => (
          <div key={pick.id} className="flex items-center gap-2 px-3 py-2 bg-brand-900/70 border border-brand-700">
            <span className="w-5 h-5 bg-brand-700 flex items-center justify-center text-[10px] font-mono text-gray-500 shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-semibold text-sm text-gray-200 truncate">{pick.player?.name}</span>
                <span className={`text-[9px] font-display font-bold uppercase px-1 py-0.5 rounded ${ROLE_COLORS[pick.player?.role]}`}>{pick.player?.role}</span>
              </div>
              {pick.god
                ? <div className="flex items-center gap-1.5 mt-0.5">
                    <GodImage godId={pick.god.id} name={pick.god.name} size={20} className="rounded-sm" />
                    <span className="text-xs text-gray-400">{pick.god.name} <span className="text-gray-600">({pick.god.role})</span></span>
                  </div>
                : <div className="text-xs text-gray-600 mt-0.5">No god selected</div>
              }
            </div>
          </div>
        ))}
      </div>
    </RetroWindow>
  );
}
