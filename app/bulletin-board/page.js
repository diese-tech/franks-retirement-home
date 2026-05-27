import prisma from '@/lib/db';
import { cookies } from 'next/headers';
import { getAdminStatusFromCookies } from '@/lib/discordAuth';
import BulletinBoardClient from './BulletinBoardClient';

export const dynamic = 'force-dynamic';

export default async function BulletinBoardPage() {
  let posts = [];
  const cookieStore = cookies();
  const { isAdmin } = getAdminStatusFromCookies(cookieStore);

  try {
    if (isAdmin) {
      posts = await prisma.bulletinPost.findMany({
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        include: {
          relatedTeam: { select: { id: true, name: true, tag: true } },
          relatedPlayer: { select: { id: true, name: true } },
        },
      });
    } else {
      posts = await prisma.bulletinPost.findMany({
        where: { status: 'published' },
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
        include: {
          relatedTeam: { select: { id: true, name: true, tag: true } },
          relatedPlayer: { select: { id: true, name: true } },
        },
      });
    }
  } catch (err) {
    console.error('[bulletin-board] fetch error:', err);
  }

  return (
    <BulletinBoardClient
      initialPosts={JSON.parse(JSON.stringify(posts))}
      isAdmin={isAdmin}
    />
  );
}
