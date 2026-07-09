import prisma from '@/lib/db';
import MatchReportClient from './MatchReportClient';
import PasswordGate from '../PasswordGate';
import { isAdminFromCookies } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Match Report — FRH Admin' };

export default async function MatchReportPage() {
  let isAdmin = false;
  try { isAdmin = isAdminFromCookies(); } catch { /* cookies() may throw outside request context */ }
  if (!isAdmin) return <PasswordGate />;

  const [matches, gods, recentExtractions] = await Promise.all([
    prisma.match.findMany({
      orderBy: [{ week: 'asc' }, { scheduledAt: 'asc' }],
      include: {
        homeTeam: {
          select: {
            id: true, name: true, tag: true,
            members: {
              where: { leftAt: null },
              include: { player: { select: { id: true, name: true, discordUsername: true, role: true, aliases: { select: { alias: true } } } } },
            },
          },
        },
        awayTeam: {
          select: {
            id: true, name: true, tag: true,
            members: {
              where: { leftAt: null },
              include: { player: { select: { id: true, name: true, discordUsername: true, role: true, aliases: { select: { alias: true } } } } },
            },
          },
        },
        games: { orderBy: { gameNumber: 'asc' }, select: { id: true, gameNumber: true, winnerTeamId: true } },
        season: { select: { name: true } },
        division: { select: { name: true } },
      },
    }),
    prisma.god.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.ocrExtraction.findMany({
      orderBy: { requestedAt: 'desc' },
      take: 30,
      include: {
        game: {
          select: {
            gameNumber: true,
            match: { select: { week: true, homeTeam: { select: { tag: true } }, awayTeam: { select: { tag: true } } } },
          },
        },
        rows: { select: { id: true, status: true, ignRaw: true, resolvedPlayerId: true } },
      },
    }),
  ]);

  return (
    <MatchReportClient
      initialMatches={JSON.parse(JSON.stringify(matches))}
      gods={JSON.parse(JSON.stringify(gods))}
      recentExtractions={JSON.parse(JSON.stringify(recentExtractions))}
    />
  );
}
