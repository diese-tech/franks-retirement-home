import prisma from '@/lib/db';
import { cookies } from 'next/headers';
import { DISCORD_SESSION_COOKIE, getDiscordSessionUser, hasDiscordAdminRole } from '@/lib/discordAuth';
import BulletinPostClient from './BulletinPostClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

function checkAdminFromCookies(cookieStore) {
  try {
    const sessionCookie = cookieStore.get(DISCORD_SESSION_COOKIE);
    if (!sessionCookie?.value) return { isAdmin: false };

    const fakeReq = {
      headers: {
        get: (name) => {
          if (name === 'cookie') return `${DISCORD_SESSION_COOKIE}=${sessionCookie.value}`;
          return null;
        },
      },
    };

    const session = getDiscordSessionUser(fakeReq);
    if (session && hasDiscordAdminRole(session.roles)) {
      return { isAdmin: true, username: session.username };
    }
  } catch (err) {
    console.error('[bulletin-board] admin check error:', err);
  }
  return { isAdmin: false };
}

export default async function BulletinPostPage({ params }) {
  const { slug } = params;
  const cookieStore = cookies();
  const { isAdmin } = checkAdminFromCookies(cookieStore);

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
