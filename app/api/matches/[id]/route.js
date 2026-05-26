import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

const MATCH_INCLUDE = {
  season: { select: { id: true, name: true, slug: true } },
  division: { select: { id: true, name: true } },
  homeTeam: { select: { id: true, name: true, tag: true } },
  awayTeam: { select: { id: true, name: true, tag: true } },
  games: { orderBy: { gameNumber: 'asc' } },
};

export async function GET(_req, { params }) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: MATCH_INCLUDE,
    });
    if (!match) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Strip captain keys from public response
    const { homeTeamCaptainKey: _a, awayTeamCaptainKey: _b, ...safe } = match;
    return NextResponse.json(safe);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch match' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 'scheduledAt' is intentionally in the allowed list so admins can make
  // one-off time corrections directly. The eligibility-window anchor
  // (defaultScheduledAt) is immutable after creation and is NOT in this list.
  // Captains update scheduledAt only via the RescheduleRequest workflow.
  const allowed = ['week', 'scheduledAt', 'status', 'streamUrl', 'vodUrl', 'homeTeamCaptainKey', 'awayTeamCaptainKey'];
  const data = {};
  for (const key of allowed) {
    if (key in body) {
      data[key] = key === 'week' ? parseInt(body[key], 10) :
                  key === 'scheduledAt' && body[key] ? new Date(body[key]) :
                  body[key];
    }
  }

  // Explicitly reject any attempt to mutate the eligibility anchor.
  if ('defaultScheduledAt' in body) {
    return NextResponse.json(
      { error: 'defaultScheduledAt is immutable after creation and cannot be changed via PATCH.' },
      { status: 400 },
    );
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  try {
    const match = await prisma.match.update({
      where: { id: params.id },
      data,
      include: MATCH_INCLUDE,
    });
    return NextResponse.json(match);
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to update match' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    await prisma.match.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to delete match' }, { status: 500 });
  }
}
