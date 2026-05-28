import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getDiscordSessionUser } from '@/lib/discordAuth';
import { REACTION_EMOJI } from '@/lib/bulletinHelpers';

// POST /api/bulletin/[id]/reactions  — toggle a reaction emoji on a post
// Body: { emoji: 'beer' | 'fire' | 'skull' | 'goat' | 'clown' }
export async function POST(request, { params }) {
  const session = getDiscordSessionUser(request);
  if (!session) {
    return NextResponse.json(
      { error: 'Are you an editor? Hmm, didn’t think so... log in to react.' },
      { status: 401 },
    );
  }

  const { id: postId } = params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { emoji } = body;
  if (!REACTION_EMOJI.includes(emoji)) {
    return NextResponse.json({ error: 'invalid emoji' }, { status: 400 });
  }

  // Post must exist and be published to receive reactions.
  const post = await prisma.bulletinPost.findUnique({ where: { id: postId }, select: { id: true, status: true } });
  if (!post || post.status !== 'published') {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  try {
    const existing = await prisma.bulletinReaction.findUnique({
      where: { postId_discordId_emoji: { postId, discordId: session.discordId, emoji } },
    });

    let reacted;
    if (existing) {
      await prisma.bulletinReaction.delete({ where: { id: existing.id } });
      reacted = false;
    } else {
      await prisma.bulletinReaction.create({
        data: { postId, discordId: session.discordId, emoji },
      });
      reacted = true;
    }

    // Return fresh counts for this post grouped by emoji.
    const grouped = await prisma.bulletinReaction.groupBy({
      by: ['emoji'],
      where: { postId },
      _count: { emoji: true },
    });
    const counts = {};
    for (const g of grouped) counts[g.emoji] = g._count.emoji;

    return NextResponse.json({ reacted, emoji, counts });
  } catch (err) {
    console.error('[bulletin reactions POST]', err);
    return NextResponse.json({ error: 'Failed to react' }, { status: 500 });
  }
}
