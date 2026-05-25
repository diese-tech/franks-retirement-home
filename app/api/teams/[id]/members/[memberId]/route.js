import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';

export async function PATCH(req, { params }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { role, isCaptain, isSub, leftAt } = await req.json();
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
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    await prisma.teamMember.delete({ where: { id: params.memberId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
