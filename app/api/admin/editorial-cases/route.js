import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { getDiscordSessionUser } from '@/lib/discordAuth';
import { EDITORIAL_TYPES } from '@/lib/bulletinHelpers';

// GET /api/admin/editorial-cases?type=fraud_watch&status=draft
export async function GET(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');

  try {
    const cases = await prisma.editorialCase.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        relatedPlayer: { select: { id: true, name: true, avatarUrl: true } },
        relatedTeam: { select: { id: true, name: true, tag: true } },
      },
    });
    return NextResponse.json(cases);
  } catch (err) {
    console.error('[admin/editorial-cases GET]', err);
    return NextResponse.json({ error: 'Failed to load cases' }, { status: 500 });
  }
}

// POST /api/admin/editorial-cases
export async function POST(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const session = getDiscordSessionUser(request);

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, title, charge, body: caseBody, severity, status, relatedPlayerId, relatedTeamId, relatedMatchId } = body;

  if (!EDITORIAL_TYPES.includes(type)) {
    return NextResponse.json({ error: `type must be one of: ${EDITORIAL_TYPES.join(', ')}` }, { status: 400 });
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const newStatus = status === 'published' ? 'published' : 'draft';

  try {
    const created = await prisma.editorialCase.create({
      data: {
        type,
        title: title.trim(),
        charge: charge?.trim() || null,
        body: caseBody?.trim() || null,
        severity: Number.isInteger(severity) ? severity : null,
        status: newStatus,
        relatedPlayerId: relatedPlayerId || null,
        relatedTeamId: relatedTeamId || null,
        relatedMatchId: relatedMatchId || null,
        createdById: session?.username ?? 'FRH Staff',
        publishedAt: newStatus === 'published' ? new Date() : null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error('[admin/editorial-cases POST]', err);
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
  }
}
