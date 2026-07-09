import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { SEASON_STATUSES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// PATCH /api/seasons/[id] — admin: update season status/name/dates/week.
// This is the supported path for flipping a season upcoming → active at
// launch (previously only possible by editing the database directly).
export async function PATCH(req, { params }) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100) {
      return NextResponse.json({ error: 'name must be a non-empty string of at most 100 chars' }, { status: 400 });
    }
    data.name = body.name;
  }
  if (body.status !== undefined) {
    if (!SEASON_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${SEASON_STATUSES.join(', ')}` }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body.currentWeek !== undefined) {
    if (!Number.isInteger(body.currentWeek) || body.currentWeek < 1) {
      return NextResponse.json({ error: 'currentWeek must be a positive integer' }, { status: 400 });
    }
    data.currentWeek = body.currentWeek;
  }
  if (body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  try {
    // Only one season should be active at a time — activating one demotes
    // any other active season to completed in the same transaction.
    if (data.status === 'active') {
      const [, season] = await prisma.$transaction([
        prisma.season.updateMany({
          where: { status: 'active', id: { not: params.id } },
          data: { status: 'completed' },
        }),
        prisma.season.update({ where: { id: params.id }, data }),
      ]);
      return NextResponse.json(season);
    }

    const season = await prisma.season.update({ where: { id: params.id }, data });
    return NextResponse.json(season);
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    console.error('[seasons PATCH]', e);
    return NextResponse.json({ error: 'Failed to update season' }, { status: 500 });
  }
}
