import prisma from '@/lib/db';
import { cookies } from 'next/headers';
import { getAdminStatusFromCookies } from '@/lib/discordAuth';
import BulletinPostClient from './BulletinPostClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function BulletinPostPage({ params }) {
  const { slug } = params;
  const cookieStore = cookies();
  const { isAdmin } = getAdminStatusFromCookies(cookieStore);

  let post = null;
  try {
    post = await prisma.bulletinPost.findUnique({
      where: { slug },
      include: {
        relatedTeam: { select: { id: true, name: true, tag: true } },
        relatedPlayer: { select: { id: true, name: true } },
        relatedMatch: { select: { id: true, week: true, status: true } },
        relatedDivision: { select: { id: true, name: true } },
        relatedSeason: { select: { id: true, name: true } },
      },
    });
  } catch (err) {
    console.error('[bulletin-board] fetch post error:', err);
  }

  if (!post) {
    notFound();
  }

  // Non-admins cannot view non-published posts
  if (post.status !== 'published' && !isAdmin) {
    notFound();
  }

  return (
    <BulletinPostClient
      post={JSON.parse(JSON.stringify(post))}
      isAdmin={isAdmin}
    />
  );
}
