import prisma from '@/lib/db';
import RosterClient from './RosterClient';

export const revalidate = 300;

export default async function RosterPage() {
  let activeSeason = null;
  let teams = null;
  let freeAgents = null;

  try {
    activeSeason = await prisma.season.findFirst({
      where: { status: 'active' },
      include: { divisions: { orderBy: { tier: 'desc' } } },
    }) ?? await prisma.season.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { divisions: { orderBy: { tier: 'desc' } } },
    });
  } catch (err) {
    console.error('[roster season]', err);
  }

  try {
    if (activeSeason) {
      [teams, freeAgents] = await Promise.all([
        prisma.team.findMany({
          where: { division: { seasonId: activeSeason.id } },
          orderBy: { name: 'asc' },
          include: {
            division: { select: { id: true, name: true } },
            org: { select: { name: true, tag: true, logoInitials: true, accentColor: true } },
            members: {
              where: { leftAt: null },
              orderBy: [{ isCaptain: 'desc' }, { role: 'asc' }],
              include: {
                player: { select: { id: true, name: true, role: true, avatarUrl: true } },
              },
            },
          },
        }),
        prisma.player.findMany({
          where: { teamMemberships: { none: { leftAt: null } } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, role: true, avatarUrl: true, discordUsername: true },
        }),
      ]);
    }
  } catch (err) {
    console.error('[roster teams]', err);
  }

  const serialized = {
    activeSeason: activeSeason ? JSON.parse(JSON.stringify(activeSeason)) : null,
    teams: teams ? JSON.parse(JSON.stringify(teams)) : null,
    freeAgents: freeAgents ? JSON.parse(JSON.stringify(freeAgents)) : null,
  };

  return <RosterClient {...serialized} />;
}
