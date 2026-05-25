import prisma from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RetroWindow, PixelBadge, BrutalButton } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ROLE_COLORS = {
  Solo: 'bg-orange-900/40 text-orange-300 border-orange-700',
  Jungle: 'bg-green-900/40 text-green-300 border-green-700',
  Mid: 'bg-purple-900/40 text-purple-300 border-purple-700',
  Support: 'bg-blue-900/40 text-blue-300 border-blue-700',
  Carry: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  Fill: 'bg-gray-800 text-gray-400 border-gray-600',
};

export default async function TeamDetailPage({ params }) {
  const team = await prisma.team.findUnique({
    where: { id: params.id },
    include: {
      division: { include: { season: { select: { id: true, name: true } } } },
      org: true,
      members: {
        where: { leftAt: null },
        orderBy: [{ isCaptain: 'desc' }, { isSub: 'asc' }, { joinedAt: 'asc' }],
        include: { player: { select: { id: true, name: true, role: true, discordUsername: true } } },
      },
    },
  });

  if (!team) notFound();

  const starters = team.members.filter((m) => !m.isSub);
  const subs = team.members.filter((m) => m.isSub);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-4">
        <Link href="/teams" className="text-xs font-ui text-gray-600 hover:text-frh-yellow transition-colors uppercase tracking-widest">
          &#8592; All Teams
        </Link>
      </div>

      <RetroWindow title={`[${team.tag}] TEAM FILE`} titleBarColor="yellow">
        {/* Team header */}
        <div className="flex items-start justify-between gap-4 mb-6 border-b-2 border-brand-700 pb-4">
          <div>
            <h1 className="font-ui text-xl uppercase tracking-widest text-frh-yellow mb-1">{team.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              {team.division && (
                <PixelBadge label={team.division.name} color={team.division.name === 'Hospice' ? 'orange' : 'blue'} />
              )}
              {team.division?.season && (
                <span className="text-[10px] text-gray-600">{team.division.season.name}</span>
              )}
              {team.org && (
                <span className="text-[10px] text-gray-500 border border-brand-600 px-1.5 py-0.5">{team.org.name}</span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-gray-600 uppercase font-ui">Record</p>
            <p className="font-mono text-sm text-gray-500">—</p>
            <p className="text-[10px] text-gray-700">pending matches</p>
          </div>
        </div>

        {/* Starters */}
        <h2 className="font-ui text-xs uppercase tracking-widest text-gray-500 mb-3">Roster</h2>
        {starters.length === 0 ? (
          <p className="text-sm text-gray-600 mb-6">No starters assigned yet.</p>
        ) : (
          <div className="space-y-2 mb-6">
            {starters.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 border-2 border-brand-700 bg-brand-950/40">
                <span className={`text-[9px] font-ui font-bold uppercase border px-1.5 py-0.5 rounded ${ROLE_COLORS[m.player.role] ?? ROLE_COLORS.Fill}`}>
                  {m.player.role}
                </span>
                <span className="font-display font-medium text-sm text-gray-200 flex-1">{m.player.name}</span>
                {m.isCaptain && (
                  <PixelBadge label="Captain" color="yellow" />
                )}
                {m.player.discordUsername && (
                  <span className="text-[10px] text-gray-600 font-mono hidden sm:block">{m.player.discordUsername}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Subs */}
        {subs.length > 0 && (
          <>
            <h2 className="font-ui text-xs uppercase tracking-widest text-gray-500 mb-3">Substitutes</h2>
            <div className="space-y-2 mb-6">
              {subs.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2 border border-brand-700 border-dashed bg-brand-950/20 opacity-75">
                  <span className={`text-[9px] font-ui font-bold uppercase border px-1.5 py-0.5 rounded ${ROLE_COLORS[m.player.role] ?? ROLE_COLORS.Fill}`}>
                    {m.player.role}
                  </span>
                  <span className="font-display font-medium text-sm text-gray-400 flex-1">{m.player.name}</span>
                  <PixelBadge label="Sub" color="gray" />
                </div>
              ))}
            </div>
          </>
        )}

        <div className="border-t-2 border-brand-700 pt-4">
          <Link href="/teams">
            <BrutalButton variant="secondary" size="sm">&#8592; Back to Teams</BrutalButton>
          </Link>
        </div>
      </RetroWindow>
    </div>
  );
}
