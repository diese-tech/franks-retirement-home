import prisma from '@/lib/db';
import { computeStandings } from '@/lib/standings';
import { RetroWindow, PixelBadge } from '@/components/ui';
import Link from 'next/link';

export const revalidate = 60;

const DIVISION_COLORS = { Hospice: 'purple', Rehabilitation: 'blue' };

function WinLoss({ wins, losses }) {
  return (
    <span className="font-mono text-sm">
      <span className="text-green-700 dark:text-green-400 font-bold">{wins}</span>
      <span className="text-frh-text-muted">–</span>
      <span className="text-red-600 dark:text-red-400 font-bold">{losses}</span>
    </span>
  );
}

function StandingsTable({ rows, divisionName }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-frh-text-muted text-center py-6">
        No completed matches in {divisionName} yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] font-ui uppercase tracking-widest text-frh-text-muted border-b-2 border-frh-border">
            <th className="text-left py-2 px-3 w-8">#</th>
            <th className="text-left py-2 px-3">Team</th>
            <th className="text-center py-2 px-3">W–L</th>
            <th className="text-center py-2 px-3">GP</th>
            <th className="text-center py-2 px-3">GW–GL</th>
            <th className="text-center py-2 px-3 hidden sm:table-cell">+/–</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.teamId}
              className={`border-b border-frh-border/60 hover:bg-frh-surface-alt/60 transition-colors ${i === 0 ? 'bg-frh-yellow/5' : ''}`}
            >
              <td className="py-3 px-3">
                <span className={`font-ui text-xs ${i === 0 ? 'text-frh-yellow font-bold' : 'text-frh-text-muted'}`}>
                  {i + 1}
                </span>
              </td>
              <td className="py-3 px-3">
                <Link href={`/teams/${row.teamId}`} className="hover:text-frh-yellow transition-colors">
                  <span className="font-display font-bold text-frh-text">{row.teamName}</span>
                  <span className="ml-2 font-mono text-[10px] text-frh-text-muted border border-frh-border px-1">[{row.teamTag}]</span>
                </Link>
              </td>
              <td className="py-3 px-3 text-center">
                <WinLoss wins={row.wins} losses={row.losses} />
              </td>
              <td className="py-3 px-3 text-center font-mono text-xs text-frh-text-muted">{row.played}</td>
              <td className="py-3 px-3 text-center">
                <span className="font-mono text-xs">
                  <span className="text-green-700 dark:text-green-400">{row.gameWins}</span>
                  <span className="text-frh-text-muted">–</span>
                  <span className="text-red-600 dark:text-red-400">{row.gameLosses}</span>
                </span>
              </td>
              <td className="py-3 px-3 text-center hidden sm:table-cell">
                <span className={`font-mono text-xs font-bold ${row.gameDiff > 0 ? 'text-green-700 dark:text-green-400' : row.gameDiff < 0 ? 'text-red-600 dark:text-red-400' : 'text-frh-text-muted'}`}>
                  {row.gameDiff > 0 ? '+' : ''}{row.gameDiff}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function StandingsPage() {
  let activeSeason = null;
  let divisionStandings = null;
  try {
    activeSeason = await prisma.season.findFirst({
      where: { status: 'active' },
      include: { divisions: { orderBy: { tier: 'desc' } } },
    }) ?? await prisma.season.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { divisions: { orderBy: { tier: 'desc' } } },
    });

    if (!activeSeason) {
      return (
        <div className="max-w-3xl mx-auto px-4 py-8">
          <RetroWindow title="STANDINGS.EXE" titleBarColor="yellow">
            <div className="text-center py-12">
              <PixelBadge label="No Season" color="orange" />
              <p className="mt-4 text-xs text-frh-text-muted">No season data yet.</p>
            </div>
          </RetroWindow>
        </div>
      );
    }

    divisionStandings = await Promise.all(
      activeSeason.divisions.map(async (div) => ({
        division: div,
        rows: await computeStandings(div.id),
      }))
    );
  } catch (err) { console.error('[standings]', err); }

  if (divisionStandings === null) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <RetroWindow title="STANDINGS.EXE" titleBarColor="yellow">
          <div className="text-center py-12">
            <p className="text-sm text-frh-text-muted mb-4">Standings data unavailable. Database may be unreachable.</p>
            <a href="/" className="text-xs font-ui text-frh-yellow hover:underline uppercase tracking-widest">&larr; Back to Home</a>
          </div>
        </RetroWindow>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h1 className="font-ui text-xl uppercase tracking-widest text-frh-yellow">Standings</h1>
        <PixelBadge label={activeSeason.name} color="cream" />
      </div>

      {divisionStandings.map(({ division, rows }) => (
        <RetroWindow key={division.id} title={`${division.name.toUpperCase()} DIVISION`} titleBarColor={DIVISION_COLORS[division.name] ?? 'blue'}>
          <div className="flex items-center justify-between mb-4">
            <span className="font-ui text-xs uppercase tracking-widest text-frh-text-muted">{division.name}</span>
            <PixelBadge label={`${rows.length} team${rows.length !== 1 ? 's' : ''}`} color="cream" />
          </div>
          <StandingsTable rows={rows} divisionName={division.name} />
        </RetroWindow>
      ))}

      {divisionStandings.length === 0 && (
        <RetroWindow title="STANDINGS.EXE" titleBarColor="yellow">
          <div className="text-center py-8">
            <p className="text-sm text-frh-text-muted">No divisions configured for {activeSeason.name}.</p>
          </div>
        </RetroWindow>
      )}

      <p className="text-[10px] text-frh-text-muted text-center">
        Only completed matches count toward standings · Game diff used as tiebreaker
      </p>
    </div>
  );
}
