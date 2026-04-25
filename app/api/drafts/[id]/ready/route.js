import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveRole } from '@/lib/draftAuth';

export const dynamic = 'force-dynamic';

// POST /api/drafts/[id]/ready
// Body: { key }
// Captain marks themselves ready. When both are ready, auto-transitions to banning.
export async function POST(request, { params }) {
  const { id } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const draft = await prisma.draft.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

    const role = resolveRole(body.key, draft);
    if (role !== 'captainA' && role !== 'captainB') {
      return NextResponse.json({ error: 'Only captains can ready up' }, { status: 403 });
    }
    if (draft.status !== 'lobby') {
      return NextResponse.json({ error: 'Draft is not in lobby phase' }, { status: 400 });
    }

    const readyField = role === 'captainA' ? 'captainAReady' : 'captainBReady';
    const updated = await prisma.draft.update({
      where: { id },
      data: { [readyField]: true, version: { increment: 1 } },
    });

    // Auto-transition when both are ready
    if (updated.captainAReady && updated.captainBReady) {
      await prisma.draft.update({
        where: { id },
        data: {
          status: 'banning',
          captainAReady: false,
          captainBReady: false,
          version: { increment: 1 },
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to process ready' }, { status: 500 });
  }
}
