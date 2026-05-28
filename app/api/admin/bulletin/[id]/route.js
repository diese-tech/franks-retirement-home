import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { getDiscordSessionUser } from '@/lib/discordAuth';
import { BULLETIN_TYPES } from '@/lib/bulletinHelpers';

// PATCH /api/admin/bulletin/[id]  — update a post (slug is immutable)
export async function PATCH(request, { params }) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const session = getDiscordSessionUser(request);
  const { id } = params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const existing = await prisma.bulletinPost.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const data = { updatedById: session?.username ?? 'FRH Staff' };

  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
  if (body.type !== undefined) {
    if (!BULLETIN_TYPES.includes(body.type)) {
      return NextResponse.json({ error: 'invalid type' }, { status: 400 });
    }
    data.type = body.type;
  }
  if (typeof body.body === 'string') data.body = body.body.trim();
  if (body.excerpt !== undefined) data.excerpt = body.excerpt?.trim() || null;
  if (body.pinned !== undefined) data.pinned = Boolean(body.pinned);
  if (body.relatedTeamId !== undefined) data.relatedTeamId = body.relatedTeamId || null;
  if (body.relatedPlayerId !== undefined) data.relatedPlayerId = body.relatedPlayerId || null;
  if (body.relatedMatchId !== undefined) data.relatedMatchId = body.relatedMatchId || null;

  // Status transitions; publishing for the first time stamps publishedAt.
  if (body.status !== undefined) {
    if (!['draft', 'published', 'archived'].includes(body.status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }
    data.status = body.status;
    if (body.status === 'published' && !existing.publishedAt) {
      data.publishedAt = new Date();
    }
  }

  try {
    const post = await prisma.bulletinPost.update({ where: { id }, data });
    return NextResponse.json(post);
  } catch (err) {
    console.error('[admin/bulletin PATCH]', err);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}

// DELETE /api/admin/bulletin/[id]
export async function DELETE(request, { params }) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  try {
    await prisma.bulletinPost.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/bulletin DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
