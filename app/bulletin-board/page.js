import prisma from '@/lib/db';
import { cookies } from 'next/headers';
import { DISCORD_SESSION_COOKIE, getDiscordSessionUser, hasDiscordAdminRole } from '@/lib/discordAuth';
import BulletinBoardClient from './BulletinBoardClient';

export const dynamic = 'force-dynamic';

/**
 * Attempts to verify Discord admin session from server-side cookies.
 * Returns { isAdmin, username } or { isAdmin: false }.
 */
function checkAdminFromCookies(cookieStore) {
  try {
    const sessionCookie = cookieStore.get(DISCORD_SESSION_COOKIE);
    if (!sessionCookie?.value) return { isAdmin: false };

    // Create a minimal request-like object for getDiscordSessionUser compatibility
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

export default async function BulletinBoardPage() {
  let posts = [];
  const cookieStore = cookies();
  const { isAdmin } = checkAdminFromCookies(cookieStore);

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
