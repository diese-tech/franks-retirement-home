import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveRole, SENDER_INFO } from '@/lib/draftAuth';
import { clientIp, consume } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const CHAT_MESSAGE_MAX_LENGTH = 500;

// Token bucket: 10 messages over a rolling ~30 s window per IP per draft.
// capacity=10 lets short bursts through (typing fast); refillPerSec=10/30
// caps sustained traffic at 1 msg / 3 s. Tuned for live drafts where a few
// captains chatting normally never hit it but a single client trying to
// flood the SSE stream gets throttled fast.
const CHAT_BUCKET = { capacity: 10, refillPerSec: 10 / 30 };

// POST /api/drafts/[id]/chat
// Body: { key?, message }
// All roles including spectators can chat. Chat not available in pending status.
//
// Issue #8: chat increments Draft.chatsVersion (not Draft.version) so the
// SSE stream can deliver a small chats-only payload instead of forcing a
// full state push (gods + players + picks + bans + draft) on every message.
//
// Issue #13: per-IP rate limit + length validation.
export async function POST(request, { params }) {
  const { id } = await params;

  const ip = clientIp(request);
  if (!consume(`chat:${ip}:${id}`, CHAT_BUCKET)) {
    return NextResponse.json({ error: 'Too many chat messages, please slow down' }, { status: 429 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, CHAT_MESSAGE_MAX_LENGTH) : '';
  if (!message) return NextResponse.json({ error: `message required (max ${CHAT_MESSAGE_MAX_LENGTH} chars)` }, { status: 400 });

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
      prisma.draft.update({ where: { id }, data: { chatsVersion: { increment: 1 } } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
