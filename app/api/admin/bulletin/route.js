import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { getDiscordSessionUser } from '@/lib/discordAuth';
import {
  BULLETIN_TYPES,
  createBulletinPostWithUniqueSlug,
} from '@/lib/bulletinHelpers';

// GET /api/admin/bulletin?status=draft  — admin listing (all statuses)
export async function GET(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  try {
    const posts = await prisma.bulletinPost.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        relatedTeam: { select: { id: true, name: true, tag: true } },
        relatedPlayer: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(posts);
  } catch (err) {
    console.error('[admin/bulletin GET]', err);
    return NextResponse.json({ error: 'Failed to load posts' }, { status: 500 });
  }
}

// POST /api/admin/bulletin  — create a post
export async function POST(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const session = getDiscordSessionUser(request);

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, type, body: postBody, excerpt, status, pinned, relatedTeamId, relatedPlayerId, relatedMatchId } = body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (!BULLETIN_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of: ${BULLETIN_TYPES.join(', ')}` }, { status: 400 });
  }
  if (!postBody || typeof postBody !== 'string' || !postBody.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 });
  }

  const newStatus = status === 'published' ? 'published' : 'draft';

  try {
    const post = await createBulletinPostWithUniqueSlug({
      title: title.trim(),
      type,
      body: postBody.trim(),
      excerpt: excerpt?.trim() || null,
      status: newStatus,
      pinned: Boolean(pinned),
      relatedTeamId: relatedTeamId || null,
      relatedPlayerId: relatedPlayerId || null,
      relatedMatchId: relatedMatchId || null,
      createdById: session?.username ?? 'FRH Staff',
      publishedAt: newStatus === 'published' ? new Date() : null,
    });
    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    console.error('[admin/bulletin POST]', err);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
