import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getBulletinAdmin, requireBulletinAdmin } from '@/lib/bulletinAuth';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['announcement', 'match_hype', 'player_spotlight', 'team_roast', 'weekly_recap'];
const VALID_STATUSES = ['draft', 'published', 'archived'];

// GET /api/bulletin-board/[id]
// Public for published posts, admin-only for draft/archived.
export async function GET(request, { params }) {
  const { id } = params;

  try {
    const post = await prisma.bulletinPost.findUnique({
      where: { id },
      include: {
        relatedTeam: { select: { id: true, name: true, tag: true } },
        relatedPlayer: { select: { id: true, name: true } },
        relatedMatch: { select: { id: true, week: true, status: true } },
        relatedDivision: { select: { id: true, name: true } },
        relatedSeason: { select: { id: true, name: true } },
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.status !== 'published') {
      const admin = getBulletinAdmin(request);
      if (!admin) {
        return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
      }
    }

    return NextResponse.json(post);
  } catch (err) {
    console.error('[bulletin-board] GET [id] error:', err);
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 });
  }
}

// PATCH /api/bulletin-board/[id]
// Admin-only: updates a bulletin post.
export async function PATCH(request, { params }) {
  const authError = requireBulletinAdmin(request);
  if (authError) return authError;

  const admin = getBulletinAdmin(request);
  const { id } = params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Fetch existing post
  const existing = await prisma.bulletinPost.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const data = {};

  if (body.title !== undefined) {
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }
    data.title = body.title.trim();
    // Slug is only generated on creation; never regenerated on title edit to preserve existing URLs
  }

  if (body.type !== undefined) {
    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json({ error: `Type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }
    data.type = body.type;
  }

  if (body.body !== undefined) data.body = body.body;
  if (body.excerpt !== undefined) data.excerpt = body.excerpt || null;
  if (body.pinned !== undefined) data.pinned = Boolean(body.pinned);
  if (body.displayOrder !== undefined) data.displayOrder = parseInt(body.displayOrder, 10) || 0;
  if (body.relatedPlayerId !== undefined) data.relatedPlayerId = body.relatedPlayerId || null;
  if (body.relatedTeamId !== undefined) data.relatedTeamId = body.relatedTeamId || null;
  if (body.relatedMatchId !== undefined) data.relatedMatchId = body.relatedMatchId || null;
  if (body.relatedDivisionId !== undefined) data.relatedDivisionId = body.relatedDivisionId || null;
  if (body.relatedSeasonId !== undefined) data.relatedSeasonId = body.relatedSeasonId || null;

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }
    data.status = body.status;
    // If transitioning to published and publishedAt not yet set
    if (body.status === 'published' && !existing.publishedAt) {
      data.publishedAt = new Date();
    }
  }

  data.updatedBy = admin?.username || null;

  try {
    const post = await prisma.bulletinPost.update({
      where: { id },
      data,
      include: {
        relatedTeam: { select: { id: true, name: true, tag: true } },
        relatedPlayer: { select: { id: true, name: true } },
        relatedMatch: { select: { id: true, week: true, status: true } },
        relatedDivision: { select: { id: true, name: true } },
        relatedSeason: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(post);
  } catch (err) {
    console.error('[bulletin-board] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}

// DELETE /api/bulletin-board/[id]
// Admin-only: deletes a bulletin post.
export async function DELETE(request, { params }) {
  const authError = requireBulletinAdmin(request);
  if (authError) return authError;

  const { id } = params;

  try {
    await prisma.bulletinPost.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    console.error('[bulletin-board] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
