import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getDiscordSessionUser, hasDiscordAdminRole } from '@/lib/discordAuth';

// DELETE /api/bulletin/comments/[commentId]  — own comment or admin
export async function DELETE(request, { params }) {
  const session = getDiscordSessionUser(request);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { commentId } = params;

  const comment = await prisma.bulletinComment.findUnique({ where: { id: commentId } });
  if (!comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }

  const isOwner = comment.discordId === session.discordId;
  const isAdmin = hasDiscordAdminRole(session.roles);
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'You can only delete your own comments' }, { status: 403 });
  }

  try {
    await prisma.bulletinComment.delete({ where: { id: commentId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[bulletin comment DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
