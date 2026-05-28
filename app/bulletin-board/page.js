import prisma from '@/lib/db';
import BulletinBoardClient from './BulletinBoardClient';

export const dynamic = 'force-dynamic';

export default async function BulletinBoardPage() {
  let posts = null;
  let totalCount = 0;
  const reactionCounts = {};
  const commentCounts = {};
  let superlatives = [];

  try {
    const published = await prisma.bulletinPost.findMany({
      where: { status: 'published' },
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
      include: {
        relatedTeam: { select: { id: true, name: true, tag: true } },
        relatedPlayer: { select: { id: true, name: true } },
      },
      take: 50,
    });
    posts = published;
    totalCount = await prisma.bulletinPost.count();

    const postIds = published.map((p) => p.id);
    if (postIds.length > 0) {
      const [reactions, comments] = await Promise.all([
        prisma.bulletinReaction.groupBy({
          by: ['postId', 'emoji'],
          where: { postId: { in: postIds } },
          _count: { emoji: true },
        }),
        prisma.bulletinComment.groupBy({
          by: ['postId'],
          where: { postId: { in: postIds } },
          _count: { postId: true },
        }),
      ]);
      for (const r of reactions) {
        reactionCounts[r.postId] ??= {};
        reactionCounts[r.postId][r.emoji] = r._count.emoji;
      }
      for (const c of comments) {
        commentCounts[c.postId] = c._count.postId;
      }
    }
  } catch (err) {
    console.error('[bulletin-board]', err);
  }

  try {
    superlatives = await prisma.superlative.findMany({
      where: { status: 'active' },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
  } catch (err) {
    console.error('[bulletin-board superlatives]', err);
  }

  return (
    <BulletinBoardClient
      posts={posts ? JSON.parse(JSON.stringify(posts)) : null}
      totalCount={totalCount}
      reactionCounts={reactionCounts}
      commentCounts={commentCounts}
      superlatives={JSON.parse(JSON.stringify(superlatives))}
    />
  );
}
