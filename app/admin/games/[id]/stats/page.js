import prisma from '@/lib/db';
import { notFound } from 'next/navigation';
import StatsEntryClient from './StatsEntryClient';
import PasswordGate from '../../../PasswordGate';
import { isAdminFromCookies } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export default async function GameStatsPage({ params }) {
  let isAdmin = false;
  try { isAdmin = isAdminFromCookies(); } catch { /* cookies() may throw outside request context */ }
  if (!isAdmin) return <PasswordGate />;

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
