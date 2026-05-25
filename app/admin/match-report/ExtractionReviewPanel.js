'use client';

import RetroWindow from '@/components/ui/RetroWindow';
import BrutalButton from '@/components/ui/BrutalButton';

const STAT_COLS = [
  { key: 'kills',           label: 'K',   width: 'w-12' },
  { key: 'deaths',          label: 'D',   width: 'w-12' },
  { key: 'assists',         label: 'A',   width: 'w-12' },
  { key: 'damage',          label: 'Dmg', width: 'w-20' },
  { key: 'damageMitigated', label: 'Mit', width: 'w-20' },
  { key: 'healing',         label: 'Heal',width: 'w-20' },
  { key: 'structureDamage', label: 'Str', width: 'w-16' },
];

function confidenceBadge(confidence) {
  if (confidence === 'exact') return <span className="text-[9px] font-ui text-green-400 uppercase">matched</span>;
  if (confidence === 'fuzzy') return <span className="text-[9px] font-ui text-frh-yellow uppercase">fuzzy</span>;
  return <span className="text-[9px] font-ui text-ember-400 uppercase">unmatched</span>;
}

function PlayerRow({ row, index, match, orderTeamId, gods, onChange }) {
  const orderMembers = orderTeamId === match.homeTeam.id ? match.homeTeam.members : match.awayTeam.members;
  const chaosMembers = orderTeamId === match.homeTeam.id ? match.awayTeam.members : match.homeTeam.members;
  const members = row.side === 'order' ? orderMembers : chaosMembers;

  const updateField = (field, value) => onChange(index, { ...row, [field]: value });

  return (
    <tr className={`border-b border-gray-700 ${!row.include ? 'opacity-40' : ''}`}>
      <td className="px-2 py-1">
        <input
          type="checkbox"
          checked={row.include}
          onChange={e => updateField('include', e.target.checked)}
          className="accent-frh-yellow"
        />
      </td>
      <td className="px-2 py-1 min-w-[160px]">
        <div className="font-mono text-[11px] text-gray-400 leading-none mb-0.5">{row.ignRaw}</div>
        <div className="flex items-center gap-1">
          <select
            value={row.resolvedPlayerId ?? ''}
            onChange={e => updateField('resolvedPlayerId', e.target.value || null)}
            className="bg-brand-700 border border-gray-600 text-gray-200 font-mono text-[10px] px-1 py-0.5 rounded w-full"
          >
            <option value="">Unassigned</option>
            {members.map(m => (
              <option key={m.player.id} value={m.player.id}>{m.player.name}</option>
            ))}
          </select>
          {row.resolvedPlayerId && confidenceBadge(row.playerConfidence)}
        </div>
      </td>
      <td className="px-2 py-1 min-w-[130px]">
        <div className="font-mono text-[11px] text-gray-400 leading-none mb-0.5">{row.godRaw}</div>
        <select
          value={row.resolvedGodId ?? ''}
          onChange={e => updateField('resolvedGodId', e.target.value || null)}
          className="bg-brand-700 border border-gray-600 text-gray-200 font-mono text-[10px] px-1 py-0.5 rounded w-full"
        >
          <option value="">Unknown</option>
          {gods.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </td>
      {STAT_COLS.map(col => (
        <td key={col.key} className={`px-1 py-1 ${col.width}`}>
          <input
            type="number"
            value={row[col.key] ?? 0}
            onChange={e => updateField(col.key, parseInt(e.target.value, 10) || 0)}
            className="bg-brand-700 border border-gray-600 text-gray-200 font-mono text-[10px] px-1 py-0.5 rounded w-full text-right"
          />
        </td>
      ))}
    </tr>
  );
}

export default function ExtractionReviewPanel({
  match, game, gods,
  rows, onRowsChange,
  orderTeamId, onOrderTeamChange,
  winnerTeamId, onWinnerChange,
  onSubmit, submitting, error,
}) {
  const updateRow = (index, updated) => {
    onRowsChange(rows.map((r, i) => i === index ? updated : r));
  };

  const orderRows = rows?.filter(r => r.side === 'order') ?? [];
  const chaosRows = rows?.filter(r => r.side === 'chaos') ?? [];
  const orderTeam = orderTeamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;
  const chaosTeam = orderTeamId === match.homeTeam.id ? match.awayTeam : match.homeTeam;

  const canSubmit = orderTeamId && winnerTeamId && rows?.length > 0;

  return (
    <RetroWindow
      title={`Review: Wk${game?.gameNumber ? `${match.season?.name ?? ''} Game ${game.gameNumber}` : 'Game'} — ${match.homeTeam.tag} vs ${match.awayTeam.tag}`}
      titleBarColor="purple"
    >
      <div className="space-y-5">
        {/* Step 1: assign Order/Chaos */}
        <div>
          <p className="font-ui text-[10px] uppercase tracking-widest text-gray-400 mb-2">
            Which team was Order? (blue side)
          </p>
          <div className="flex gap-2">
            {[match.homeTeam, match.awayTeam].map(team => (
              <button
                key={team.id}
                onClick={() => onOrderTeamChange(team.id)}
                className={[
                  'px-4 py-2 font-ui text-xs uppercase tracking-wide rounded border-2 transition-colors',
                  orderTeamId === team.id
                    ? 'bg-frh-xp-blue border-frh-xp-blue text-white'
                    : 'bg-transparent border-gray-600 text-gray-300 hover:border-frh-xp-blue',
                ].join(' ')}
              >
                {team.tag}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: winner */}
        {orderTeamId && (
          <div>
            <p className="font-ui text-[10px] uppercase tracking-widest text-gray-400 mb-2">Winner</p>
            <div className="flex gap-2">
              {[match.homeTeam, match.awayTeam].map(team => (
                <button
                  key={team.id}
                  onClick={() => onWinnerChange(team.id)}
                  className={[
                    'px-4 py-2 font-ui text-xs uppercase tracking-wide rounded border-2 transition-colors',
                    winnerTeamId === team.id
                      ? 'bg-frh-yellow border-frh-yellow text-frh-ink'
                      : 'bg-transparent border-gray-600 text-gray-300 hover:border-frh-yellow',
                  ].join(' ')}
                >
                  {team.tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: stat table */}
        {orderTeamId && rows && (
          <div className="overflow-x-auto">
            {[
              { label: `ORDER — ${orderTeam?.tag ?? ''}`, side: 'order', sideRows: orderRows },
              { label: `CHAOS — ${chaosTeam?.tag ?? ''}`, side: 'chaos', sideRows: chaosRows },
            ].map(({ label, side, sideRows }) => (
              <div key={side} className="mb-4">
                <div className="font-ui text-[10px] uppercase tracking-widest text-gray-400 mb-1">{label}</div>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-600 text-gray-500 font-ui text-[9px] uppercase tracking-widest">
                      <th className="px-2 py-1 text-left w-6"></th>
                      <th className="px-2 py-1 text-left min-w-[160px]">Player</th>
                      <th className="px-2 py-1 text-left min-w-[130px]">God</th>
                      {STAT_COLS.map(c => <th key={c.key} className={`px-1 py-1 text-right ${c.width}`}>{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {sideRows.map(row => {
                      const index = rows.indexOf(row);
                      return (
                        <PlayerRow
                          key={row.id}
                          row={row}
                          index={index}
                          match={match}
                          orderTeamId={orderTeamId}
                          gods={gods}
                          onChange={updateRow}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="font-mono text-xs text-ember-400 border border-ember-600 bg-ember-900/30 px-3 py-2 rounded">
            {error}
          </p>
        )}

        {canSubmit && (
          <BrutalButton onClick={onSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Game Stats'}
          </BrutalButton>
        )}
      </div>
    </RetroWindow>
  );
}
