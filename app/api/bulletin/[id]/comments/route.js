import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getDiscordSessionUser } from '@/lib/discordAuth';

export const dynamic = 'force-dynamic';

const MAX_COMMENT_LEN = 1000;

// GET /api/bulletin/[id]/comments  — public list of comments on a post
export async function GET(request, { params }) {
  const { id: postId } = params;
  try {
    const comments = await prisma.bulletinComment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
    });
    // Expose the caller's own discordId so the client can show delete controls.
    const session = getDiscordSessionUser(request);
    return NextResponse.json({
      comments: comments.map((c) => ({
        id: c.id,
        authorName: c.authorName,
        body: c.body,
        createdAt: c.createdAt,
        isOwn: session ? c.discordId === session.discordId : false,
      })),
    });
  } catch (err) {
    console.error('[bulletin comments GET]', err);
    return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 });
  }
}

// POST /api/bulletin/[id]/comments  — add a comment (logged-in users)
export async function POST(request, { params }) {
  const session = getDiscordSessionUser(request);
  if (!session) {
    return NextResponse.json(
      { error: 'Are you an editor? Hmm, didn’t think so... log in to comment.' },
      { status: 401 },
    );
  }

  const { id: postId } = params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) {
    return NextResponse.json({ error: 'comment body is required' }, { status: 400 });
  }
  if (text.length > MAX_COMMENT_LEN) {
    return NextResponse.json({ error: `comment must be under ${MAX_COMMENT_LEN} chars` }, { status: 400 });
  }

  const post = await prisma.bulletinPost.findUnique({ where: { id: postId }, select: { id: true, status: true } });
  if (!post || post.status !== 'published') {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  try {
    const comment = await prisma.bulletinComment.create({
      data: {
        postId,
        discordId: session.discordId,
        authorName: session.username,
        body: text,
      },
    });
    return NextResponse.json(
      {
        id: comment.id,
        authorName: comment.authorName,
        body: comment.body,
        createdAt: comment.createdAt,
        isOwn: true,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[bulletin comments POST]', err);
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
  }
}
