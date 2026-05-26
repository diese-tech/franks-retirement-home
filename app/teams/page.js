import prisma from '@/lib/db';
import Link from 'next/link';
import { RetroWindow, PixelBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

const DIVISION_COLOR = { Hospice: 'orange', Rehabilitation: 'blue' };
const ROLE_COLORS = {
  Solo: 'text-orange-400', Jungle: 'text-green-400', Mid: 'text-purple-400',
  Support: 'text-blue-400', Carry: 'text-yellow-400', Fill: 'text-frh-text-muted',
};

export default async function TeamsPage() {
  const activeSeason = await prisma.season.findFirst({
    where: { status: 'active' },
    include: { divisions: { orderBy: { tier: 'asc' } } },
  }) ?? await prisma.season.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { divisions: { orderBy: { tier: 'asc' } } },
  });

  const teams = activeSeason
    ? await prisma.team.findMany({
        where: { division: { seasonId: activeSeason.id } },
        orderBy: { name: 'asc' },
        include: {
          division: { select: { id: true, name: true } },
          org: { select: { name: true, tag: true, accentColor: true } },
          members: {
            where: { leftAt: null },
            orderBy: { isCaptain: 'desc' },
            include: { player: { select: { id: true, name: true, role: true } } },
          },
        },
      })
    : [];

  const byDivision = teams.reduce((acc, t) => {
    const div = t.division?.name ?? 'Unassigned';
    if (!acc[div]) acc[div] = [];
    acc[div].push(t);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <RetroWindow title="TEAMS.EXE" titleBarColor="yellow">
        <div className="flex items-start justify-between gap-4 mb-6 border-b-2 border-frh-border pb-4">
          <div>
            <h1 className="font-ui text-xl uppercase tracking-widest text-frh-yellow mb-1">Teams</h1>
            {activeSeason && (
              <p className="text-sm text-frh-text-muted">{activeSeason.name} — {teams.length} team{teams.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          {activeSeason && (
            <PixelBadge label={activeSeason.status} color={activeSeason.status === 'active' ? 'lime' : 'gray'} />
          )}
        </div>

        {teams.length === 0 ? (
          <p className="text-sm text-frh-text-muted text-center py-8">No teams yet. Check back once the season kicks off.</p>
        ) : (
          Object.entries(byDivision).sort(([a], [b]) => a.localeCompare(b)).map(([divName, divTeams]) => (
            <div key={divName} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-ui text-xs uppercase tracking-widest text-frh-text-muted">Division</span>
                <PixelBadge label={divName} color={DIVISION_COLOR[divName] ?? 'gray'} />
                <span className="text-[10px] text-frh-text-muted">{divTeams.length} team{divTeams.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {divTeams.map((team) => {
                  const captain = team.members.find((m) => m.isCaptain);
                  return (
                    <Link key={team.id} href={`/teams/${team.id}`} className="block group">
                      <div className="border-2 border-frh-border group-hover:border-frh-yellow/50 transition-colors p-3 bg-frh-base/40">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-ui text-sm text-frh-text group-hover:text-frh-yellow transition-colors">{team.name}</span>
                            <span className="ml-2 font-mono text-[10px] text-frh-text-muted border border-frh-border px-1">[{team.tag}]</span>
                          </div>
                          <span className="text-[10px] text-frh-text-muted">{team.members.length} players</span>
                        </div>
                        {captain && (
                          <p className="text-[10px] text-frh-yellow mb-1">&#9733; {captain.player.name}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {team.members.slice(0, 5).map((m) => (
                            <span key={m.id} className={`text-[9px] font-mono ${ROLE_COLORS[m.player.role] ?? 'text-frh-text-muted'}`}>
                              {m.player.role[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </RetroWindow>
    </div>
  );
}
