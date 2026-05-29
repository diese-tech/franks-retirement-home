import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';

export const dynamic = 'force-dynamic';

export async function PATCH(req, { params }) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { role, isCaptain, isSub, leftAt } = body;

  try {
    const member = await prisma.teamMember.update({
      where: { id: params.memberId },
      data: { role, isCaptain, isSub, leftAt },
      include: { player: { select: { id: true, name: true, role: true } } },
    });
    return NextResponse.json(member);
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  try {
    await prisma.teamMember.delete({ where: { id: params.memberId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
