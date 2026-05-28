import prisma from '@/lib/db';
import FraudWatchClient from './FraudWatchClient';

export const dynamic = 'force-dynamic';

export default async function FraudWatchPage() {
  let fraudCases = null;
  let washedCases = null;
  let totalCount = 0;
  let activeCount = 0;

  try {
    [fraudCases, washedCases, totalCount, activeCount] = await Promise.all([
      prisma.editorialCase.findMany({
        where: { type: 'fraud_watch', status: 'published' },
        orderBy: { publishedAt: 'desc' },
        include: {
          relatedPlayer: { select: { id: true, name: true, avatarUrl: true } },
          relatedTeam: { select: { id: true, name: true, tag: true } },
        },
      }),
      prisma.editorialCase.findMany({
        where: { type: 'washed_report', status: 'published' },
        orderBy: { publishedAt: 'desc' },
        include: {
          relatedPlayer: { select: { id: true, name: true, avatarUrl: true } },
          relatedTeam: { select: { id: true, name: true, tag: true } },
        },
      }),
      prisma.editorialCase.count({ where: { status: { not: 'draft' } } }),
      prisma.editorialCase.count({ where: { status: 'published', type: 'fraud_watch' } }),
    ]);
  } catch (err) {
    console.error('[fraud-watch]', err);
  }

  const serialized = {
    fraudCases: fraudCases ? JSON.parse(JSON.stringify(fraudCases)) : null,
    washedCases: washedCases ? JSON.parse(JSON.stringify(washedCases)) : null,
    totalCount,
    activeCount,
  };

  return <FraudWatchClient {...serialized} />;
}
