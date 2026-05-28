import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { getDiscordSessionUser } from '@/lib/discordAuth';

// PATCH /api/admin/superlatives/[id]  — edit, approve a suggestion, or archive
export async function PATCH(request, { params }) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const session = getDiscordSessionUser(request);
  const { id } = params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const existing = await prisma.superlative.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Superlative not found' }, { status: 404 });
  }

  const data = {};
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.nominee !== undefined) data.nominee = body.nominee?.trim() || null;
  if (body.weekLabel !== undefined) data.weekLabel = body.weekLabel?.trim() || null;
  if (body.displayOrder !== undefined) data.displayOrder = Number.isInteger(body.displayOrder) ? body.displayOrder : null;
  if (body.status !== undefined) {
    if (!['active', 'suggested', 'archived'].includes(body.status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }
    data.status = body.status;
    // Approving a suggestion records the approving admin.
    if (body.status === 'active' && existing.status === 'suggested') {
      data.createdById = session?.username ?? 'FRH Staff';
    }
  }

  try {
    const item = await prisma.superlative.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (err) {
    console.error('[admin/superlatives PATCH]', err);
    return NextResponse.json({ error: 'Failed to update superlative' }, { status: 500 });
  }
}

// DELETE /api/admin/superlatives/[id]
export async function DELETE(request, { params }) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  try {
    await prisma.superlative.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[admin/superlatives DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete superlative' }, { status: 500 });
  }
}
