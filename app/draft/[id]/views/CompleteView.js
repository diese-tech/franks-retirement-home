'use client';

import { useMemo } from 'react';
import { evaluateDraft } from '@/lib/rules';
import { ROLE_COLORS } from '@/lib/constants';

export default function CompleteView({ state }) {
  const { picks, bans } = state;
  const evaluation = useMemo(() => evaluateDraft(picks), [picks]);

  const teamA = picks.filter((p) => p.team === 'A').sort((a, b) => a.pickOrder - b.pickOrder);
  const teamB = picks.filter((p) => p.team === 'B').sort((a, b) => a.pickOrder - b.pickOrder);

  const ratingCfg = {
    balanced:  { label: 'BALANCED', color: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/10' },
    caution:   { label: 'CAUTION',  color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
    penalized: { label: 'PENALTY',  color: 'text-red-400',   border: 'border-red-500/30',   bg: 'bg-red-500/10' },
  }[evaluation.rating];

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className={`flex items-center justify-center gap-6 px-6 py-4 rounded-xl border ${ratingCfg.bg} ${ratingCfg.border}`}>
        <div className="text-center">
          <div className="font-mono text-2xl font-bold text-blue-400">{evaluation.teamA.points}</div>
          <div className="text-[10px] font-display uppercase tracking-wider text-gray-500">Alpha pts</div>
        </div>
        <div className="text-center">
          <div className={`font-display font-bold text-lg uppercase tracking-wider ${ratingCfg.color}`}>{ratingCfg.label}</div>
          <div className="text-[10px] text-gray-600">diff: {evaluation.diff}</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-2xl font-bold text-red-400">{evaluation.teamB.points}</div>
          <div className="text-[10px] font-display uppercase tracking-wider text-gray-500">Bravo pts</div>
        </div>
      </div>

      {/* Banned gods */}
      {bans.length > 0 && (
        <div className="card">
          <div className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Banned Gods</div>
          <div className="flex flex-wrap gap-2">
            {bans.map((ban) => (
              <span key={ban.id} className="px-2 py-1 rounded bg-brand-800 border border-brand-600/30 text-xs text-gray-400 font-display">
                {ban.god?.name ?? '—'}
                <span className={`ml-1.5 text-[9px] font-bold ${ban.team === 'A' ? 'text-blue-500' : 'text-red-500'}`}>
                  {ban.team === 'A' ? 'α' : 'β'}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Final teams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinalTeam team="A" picks={teamA} />
        <FinalTeam team="B" picks={teamB} />
      </div>
    </div>
  );
}

function FinalTeam({ team, picks }) {
  const isA = team === 'A';
  const accent = isA ? 'text-blue-400' : 'text-red-400';
  const accentBg = isA ? 'bg-blue-500/15' : 'bg-red-500/15';
  const borderColor = isA ? 'border-blue-500/30' : 'border-red-500/30';
  const colBg = isA ? 'bg-[#0d1225]' : 'bg-[#1a0d0d]';

  return (
    <div className={`rounded-xl border ${borderColor} ${colBg} overflow-hidden`}>
      <div className={`px-5 py-4 border-b ${borderColor} flex items-center justify-between`}>
        <h2 className={`font-display font-bold text-lg uppercase tracking-wider ${accent}`}>
          Team {isA ? 'Alpha' : 'Bravo'}
        </h2>
        <div className={`font-mono text-sm ${accent}`}>{picks.reduce((s, p) => s + (p.player?.pointValue ?? 0), 0)} pts</div>
      </div>
      <div className="p-4 space-y-2">
        {picks.map((pick, i) => (
          <div key={pick.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-800/60 border border-brand-600/20">
            <span className="w-5 h-5 rounded bg-brand-700 flex items-center justify-center text-[10px] font-mono text-gray-500 shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-semibold text-sm text-gray-200 truncate">{pick.player?.name}</span>
                <span className={`text-[9px] font-display font-bold uppercase px-1 py-0.5 rounded ${ROLE_COLORS[pick.player?.role]}`}>{pick.player?.role}</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {pick.god ? <>{pick.god.name} <span className="text-gray-600">({pick.god.role})</span></> : <span className="text-gray-600">No god selected</span>}
              </div>
            </div>
            <span className={`shrink-0 w-7 h-7 rounded flex items-center justify-center font-mono font-bold text-xs ${accentBg} ${accent}`}>
              {pick.player?.pointValue}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
