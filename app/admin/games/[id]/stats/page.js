import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import StatsEntryClient from './StatsEntryClient';

export const dynamic = 'force-dynamic';

export default async function GameStatsPage({ params }) {
  const game = await prisma.game.findUnique({
    where: { id: params.id },
    include: {
      match: {
        include: {
          homeTeam: {
            include: {
              members: {
                where: { leftAt: null },
                include: { player: { select: { id: true, name: true, role: true } } },
              },
            },
          },
          awayTeam: {
            include: {
              members: {
                where: { leftAt: null },
                include: { player: { select: { id: true, name: true, role: true } } },
              },
            },
          },
        },
      },
      statLines: {
        include: {
          player: { select: { id: true, name: true } },
          god: { select: { id: true, name: true } },
          team: { select: { id: true, name: true, tag: true } },
        },
      },
    },
  });

  if (!game) notFound();

  const gods = await prisma.god.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, role: true } });

  return (
    <StatsEntryClient
      game={JSON.parse(JSON.stringify(game))}
      gods={JSON.parse(JSON.stringify(gods))}
    />
  );
}
