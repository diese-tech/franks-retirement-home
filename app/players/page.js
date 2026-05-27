import prisma from '@/lib/db';
import { RetroWindow } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ROLE_COLORS = {
  Solo: 'text-orange-400', Jungle: 'text-green-400', Mid: 'text-purple-400',
  Support: 'text-blue-400', Carry: 'text-yellow-400', Fill: 'text-frh-text-muted',
};

export default async function PlayersPage({ searchParams }) {
  const roleFilter = searchParams?.role ?? '';
  const divisionFilter = searchParams?.division ?? '';

  const where = {};
  if (roleFilter) where.role = roleFilter;
  if (divisionFilter) where.division = divisionFilter;

  let players = null;
  let roles = [];
  let divisions = [];
  try {
    [players, roles, divisions] = await Promise.all([
      prisma.player.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          teamMemberships: {
            where: { leftAt: null },
            include: { team: { select: { id: true, name: true, tag: true } } },
          },
        },
      }),
      prisma.player.findMany({ distinct: ['role'], select: { role: true }, orderBy: { role: 'asc' } }),
      prisma.player.findMany({ distinct: ['division'], where: { division: { not: null } }, select: { division: true }, orderBy: { division: 'asc' } }),
    ]);
  } catch (err) { console.error('[players]', err); }

  if (players === null) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <RetroWindow title="PLAYERS.EXE" titleBarColor="yellow">
          <div className="text-center py-12">
            <p className="text-sm text-frh-text-muted mb-4">No player data available. Database may be unreachable.</p>
            <a href="/" className="text-xs font-ui text-frh-yellow hover:underline uppercase tracking-widest">&larr; Back to Home</a>
          </div>
        </RetroWindow>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <RetroWindow title="PLAYERS.EXE" titleBarColor="yellow">
        <div className="flex items-start justify-between gap-4 mb-6 border-b-2 border-frh-border pb-4">
          <div>
            <h1 className="font-ui text-xl uppercase tracking-widest text-frh-yellow mb-1">Players</h1>
            <p className="text-sm text-frh-text-muted">{players.length} player{players.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <a href="/players" className={`text-[10px] font-ui uppercase px-2 py-1 border transition-colors ${!roleFilter && !divisionFilter ? 'border-frh-yellow text-frh-yellow' : 'border-frh-border text-frh-text-muted hover:border-frh-text'}`}>All</a>
          {roles.map(({ role }) => (
            <a key={role} href={`/players?role=${role}`} className={`text-[10px] font-ui uppercase px-2 py-1 border transition-colors ${roleFilter === role ? 'border-frh-yellow text-frh-yellow' : 'border-frh-border text-frh-text-muted hover:border-frh-text'}`}>{role}</a>
          ))}
          {divisions.map(({ division }) => (
            <a key={division} href={`/players?division=${encodeURIComponent(division)}`} className={`text-[10px] font-ui uppercase px-2 py-1 border transition-colors ${divisionFilter === division ? 'border-frh-orange text-frh-orange' : 'border-frh-border text-frh-text-muted hover:border-frh-text'}`}>{division}</a>
          ))}
        </div>

        {players.length === 0 ? (
          <p className="text-sm text-frh-text-muted text-center py-8">No players match your filters.</p>
        ) : (
          <div className="space-y-1">
            {players.map((p) => {
              const team = p.teamMemberships[0]?.team;
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2 border border-frh-border bg-frh-base/30 hover:border-frh-border-strong transition-colors">
                  <span className={`w-14 shrink-0 text-[10px] font-mono ${ROLE_COLORS[p.role] ?? 'text-frh-text-muted'}`}>{p.role}</span>
                  <span className="font-display text-sm text-frh-text flex-1">{p.name}</span>
                  {p.division && (
                    <span className="text-[10px] text-frh-text-muted hidden sm:block">{p.division}</span>
                  )}
                  {team ? (
                    <span className="text-[10px] font-mono text-frh-text-muted border border-frh-border px-1">[{team.tag}]</span>
                  ) : (
                    <span className="text-[10px] text-frh-text-muted">—</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </RetroWindow>
    </div>
  );
}
