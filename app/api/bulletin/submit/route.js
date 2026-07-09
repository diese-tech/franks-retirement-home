import { NextResponse } from 'next/server';
import { getDiscordSessionUser, hasDiscordPlayerRole, hasDiscordAdminRole } from '@/lib/discordAuth';
import {
  PLAYER_SUBMITTABLE_TYPES,
  createBulletinPostWithUniqueSlug,
} from '@/lib/bulletinHelpers';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// POST /api/bulletin/submit  — player-submitted post. Lands as a draft for
// admin review before it can be published.
export async function POST(request) {
  const session = getDiscordSessionUser(request);
  if (!session) {
    return NextResponse.json(
      { error: 'Are you an editor? Hmm, didn’t think so... log in to submit a post.' },
      { status: 401 },
    );
  }

  // Only league members (player or admin role) may submit.
  if (!hasDiscordPlayerRole(session.roles) && !hasDiscordAdminRole(session.roles)) {
    return NextResponse.json(
      { error: 'Only rostered league members can submit posts.' },
      { status: 403 },
    );
  }

  // 5 submissions per 10 minutes per Discord identity.
  const { allowed } = await checkRateLimit(`bulletin-submit:${session.discordId}`, 5, 600);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many submissions. Try again in a few minutes.' }, { status: 429 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, type, body: postBody, excerpt } = body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (!PLAYER_SUBMITTABLE_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${PLAYER_SUBMITTABLE_TYPES.join(', ')}` },
      { status: 400 },
    );
  }
  if (!postBody || typeof postBody !== 'string' || !postBody.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 });
  }

  try {
    const post = await createBulletinPostWithUniqueSlug({
      title: title.trim(),
      type,
      body: postBody.trim(),
      excerpt: excerpt?.trim() || null,
      status: 'draft', // always pending admin review
      pinned: false,
      createdById: session.username,
    });
    return NextResponse.json(
      { ok: true, message: 'Submitted! An editor will review it before it goes live.', id: post.id },
      { status: 201 },
    );
  } catch (err) {
    console.error('[bulletin submit POST]', err);
    return NextResponse.json({ error: 'Failed to submit post' }, { status: 500 });
  }
}
