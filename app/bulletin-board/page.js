import prisma from '@/lib/db';
import BulletinBoardClient from './BulletinBoardClient';

export const dynamic = 'force-dynamic';

export default async function BulletinBoardPage() {
  let posts = null;
  let totalCount = 0;

  try {
    [posts, totalCount] = await Promise.all([
      prisma.bulletinPost.findMany({
        where: { status: 'published' },
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
        include: {
          relatedTeam: { select: { id: true, name: true, tag: true } },
          relatedPlayer: { select: { id: true, name: true } },
        },
        take: 50,
      }),
      prisma.bulletinPost.count(),
    ]);
  } catch (err) {
    console.error('[bulletin-board]', err);
  }

  const serialized = posts ? JSON.parse(JSON.stringify(posts)) : null;

  return <BulletinBoardClient posts={serialized} totalCount={totalCount} />;
}
