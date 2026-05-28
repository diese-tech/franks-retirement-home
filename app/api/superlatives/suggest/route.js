import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getDiscordSessionUser, hasDiscordPlayerRole, hasDiscordAdminRole } from '@/lib/discordAuth';

// POST /api/superlatives/suggest  — player suggests a new superlative.
// Lands as `suggested` for admin review.
export async function POST(request) {
  const session = getDiscordSessionUser(request);
  if (!session) {
    return NextResponse.json(
      { error: 'Are you an editor? Hmm, didn’t think so... log in to suggest one.' },
      { status: 401 },
    );
  }
  if (!hasDiscordPlayerRole(session.roles) && !hasDiscordAdminRole(session.roles)) {
    return NextResponse.json(
      { error: 'Only rostered league members can suggest superlatives.' },
      { status: 403 },
    );
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, description, nominee } = body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  try {
    const item = await prisma.superlative.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        nominee: nominee?.trim() || null,
        status: 'suggested',
        suggestedBy: session.username,
      },
    });
    return NextResponse.json(
      { ok: true, message: 'Suggestion sent! An editor will review it.', id: item.id },
      { status: 201 },
    );
  } catch (err) {
    console.error('[superlatives/suggest POST]', err);
    return NextResponse.json({ error: 'Failed to submit suggestion' }, { status: 500 });
  }
}
