import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getBulletinAdmin, requireBulletinAdmin } from '@/lib/bulletinAuth';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['announcement', 'match_hype', 'player_spotlight', 'team_roast', 'weekly_recap'];

function generateSlug(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

// GET /api/bulletin-board
// Public: returns published posts. Admins can filter by status.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get('type');
  const statusFilter = searchParams.get('status');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50);

  const admin = getBulletinAdmin(request);

  const where = {};

  // Only admins can filter by non-published statuses.
  // Non-admin requests with a status param are silently downgraded to published
  // (fail-closed): this prevents information disclosure while still returning a
  // useful 200 response for public clients that accidentally pass the param.
  if (statusFilter && admin) {
    where.status = statusFilter;
  } else {
    where.status = 'published';
  }

  if (typeFilter && VALID_TYPES.includes(typeFilter)) {
    where.type = typeFilter;
  }

  try {
    const posts = await prisma.bulletinPost.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
      take: limit,
      include: {
        relatedTeam: { select: { id: true, name: true, tag: true } },
        relatedPlayer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(posts);
  } catch (err) {
    console.error('[bulletin-board] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

// POST /api/bulletin-board
// Admin-only: creates a new bulletin post.
export async function POST(request) {
  const authError = requireBulletinAdmin(request);
  if (authError) return authError;

  const admin = getBulletinAdmin(request);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { title, type, body: postBody, excerpt, pinned, status, relatedPlayerId, relatedTeamId, relatedMatchId, relatedDivisionId, relatedSeasonId } = body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `Type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
  }

  const postStatus = status || 'draft';
  const publishedAt = postStatus === 'published' ? new Date() : null;

  // Retry up to 3 times on slug collision (Prisma P2002 unique constraint error)
  const MAX_SLUG_ATTEMPTS = 3;
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = generateSlug(title);
    try {
      const post = await prisma.bulletinPost.create({
        data: {
          title: title.trim(),
          slug,
          type,
          body: postBody || '',
          excerpt: excerpt || null,
          pinned: pinned || false,
          status: postStatus,
          publishedAt,
          relatedPlayerId: relatedPlayerId || null,
          relatedTeamId: relatedTeamId || null,
          relatedMatchId: relatedMatchId || null,
          relatedDivisionId: relatedDivisionId || null,
          relatedSeasonId: relatedSeasonId || null,
          createdBy: admin?.username || null,
        },
        include: {
          relatedTeam: { select: { id: true, name: true, tag: true } },
          relatedPlayer: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json(post, { status: 201 });
    } catch (err) {
      // P2002 = unique constraint violation (slug collision) — retry with new slug
      if (err.code === 'P2002' && attempt < MAX_SLUG_ATTEMPTS - 1) {
        continue;
      }
      if (err.code === 'P2002') {
        return NextResponse.json(
          { error: 'Unable to generate a unique slug after multiple attempts. Please try again.' },
          { status: 409 }
        );
      }
      console.error('[bulletin-board] POST error:', err);
      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
    }
  }
}
