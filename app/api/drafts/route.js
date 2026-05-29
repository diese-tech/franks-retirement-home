import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import prisma from '@/lib/db';
import { DRAFT_STATUSES } from '@/lib/constants';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { PUBLIC_DRAFT_SELECT } from '@/lib/draftSelect';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parseLimit(raw, fallback, max) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
  const status = searchParams.get('status');
  if (status && !DRAFT_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${DRAFT_STATUSES.join(', ')}` }, { status: 400 });
  }

  try {
    const drafts = await prisma.draft.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: PUBLIC_DRAFT_SELECT,
    });
    return NextResponse.json(drafts);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }
}

// POST /api/drafts
// Create body: { name? }
// Status update body: { id, status }
export async function POST(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    // Status update
    if (body.id && body.status) {
      if (!DRAFT_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: `status must be one of: ${DRAFT_STATUSES.join(', ')}` }, { status: 400 });
      }

      // Validate team sizes when opening lobby
      if (body.status === 'lobby') {
        const [countA, countB] = await Promise.all([
          prisma.draftPick.count({ where: { draftId: body.id, team: 'A' } }),
          prisma.draftPick.count({ where: { draftId: body.id, team: 'B' } }),
        ]);
        if (countA !== 5 || countB !== 5) {
          return NextResponse.json(
            { error: `Each team must have exactly 5 players before opening the lobby (Team A: ${countA}, Team B: ${countB})` },
            { status: 400 }
          );
        }
      }

      const draft = await prisma.draft.update({
        where: { id: body.id },
        data: { status: body.status, version: { increment: 1 } },
      });
      return NextResponse.json(draft);
    }

    // Create with 3 auto-generated keys
    const rawName = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    const draft = await prisma.draft.create({
      data: {
        name: rawName || 'Draft',
        captainAKey: randomUUID(),
        captainBKey: randomUUID(),
        adminKey: randomUUID(),
        version: 0,
      },
    });
    return NextResponse.json(draft, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    await prisma.draft.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
}
