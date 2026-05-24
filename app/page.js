import prisma from '@/lib/db';
import { PUBLIC_DRAFT_SELECT } from '@/lib/draftSelect';
import HomepageClient from './HomepageClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [featuredDrafts, totalCount, activeDrafts, completedDrafts, playerCount, godCount] =
    await Promise.all([
      prisma.draft.findMany({
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: PUBLIC_DRAFT_SELECT,
      }),
      prisma.draft.count(),
      prisma.draft.count({ where: { status: { in: ['lobby', 'banning', 'picking'] } } }),
      prisma.draft.count({ where: { status: 'complete' } }),
      prisma.player.count(),
      prisma.god.count(),
    ]);

  return (
    <HomepageClient
      featuredDrafts={featuredDrafts}
      totalCount={totalCount}
      activeDrafts={activeDrafts}
      completedDrafts={completedDrafts}
      playerCount={playerCount}
      godCount={godCount}
    />
  );
}
