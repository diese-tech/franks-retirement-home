import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveRole, SENDER_INFO } from '@/lib/draftAuth';

export const dynamic = 'force-dynamic';

// POST /api/drafts/[id]/chat
// Body: { key?, message }
// All roles including spectators can chat. Chat not available in pending status.
export async function POST(request, { params }) {
  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
  if (!message) return NextResponse.json({ error: 'message required (max 500 chars)' }, { status: 400 });

  try {
    const draft = await prisma.draft.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    if (draft.status === 'pending') {
      return NextResponse.json({ error: 'Chat is not available until the lobby opens' }, { status: 400 });
    }

    const role = resolveRole(body.key, draft);
    const { name: senderName, team } = SENDER_INFO[role];

    await prisma.$transaction([
      prisma.draftChat.create({ data: { draftId: id, team, senderName, message } }),
      prisma.draft.update({ where: { id }, data: { version: { increment: 1 } } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
