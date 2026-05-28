import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { getDiscordSessionUser } from '@/lib/discordAuth';

// PATCH /api/admin/editorial-cases/[id]
export async function PATCH(request, { params }) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const session = getDiscordSessionUser(request);
  const { id } = params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const existing = await prisma.editorialCase.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  const data = { updatedById: session?.username ?? 'FRH Staff' };

  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
  if (body.charge !== undefined) data.charge = body.charge?.trim() || null;
  if (body.body !== undefined) data.body = body.body?.trim() || null;
  if (body.severity !== undefined) data.severity = Number.isInteger(body.severity) ? body.severity : null;
  if (body.relatedPlayerId !== undefined) data.relatedPlayerId = body.relatedPlayerId || null;
  if (body.relatedTeamId !== undefined) data.relatedTeamId = body.relatedTeamId || null;
  if (body.relatedMatchId !== undefined) data.relatedMatchId = body.relatedMatchId || null;

  if (body.status !== undefined) {
    if (!['draft', 'published', 'archived'].includes(body.status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }
    data.status = body.status;
    if (body.status === 'published' && !existing.publishedAt) {
      data.publishedAt = new Date();
    }
  }

  try {
    const updated = await prisma.editorialCase.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[admin/editorial-cases PATCH]', err);
    return NextResponse.json({ error: 'Failed to update case' }, { status: 500 });
  }
}

// DELETE /api/admin/editorial-cases/[id]
export async function DELETE(request, { params }) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  try {
    await prisma.editorialCase.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/editorial-cases DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete case' }, { status: 500 });
  }
}
