import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';

export async function GET(_req, { params }) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: {
        division: { select: { id: true, name: true, tier: true } },
        org: true,
        members: {
          orderBy: { joinedAt: 'asc' },
          include: { player: { select: { id: true, name: true, role: true, discordUsername: true } } },
        },
      },
    });
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    return NextResponse.json(team);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  try {
    const { name, tag, orgId, captainPlayerId } = await req.json();
    const team = await prisma.team.update({
      where: { id: params.id },
      data: { name, tag, orgId, captainPlayerId },
    });
    return NextResponse.json(team);
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  try {
    await prisma.team.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to delete team' }, { status: 500 });
  }
}
