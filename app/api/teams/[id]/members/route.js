import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';

export async function GET(_req, { params }) {
  try {
    const members = await prisma.teamMember.findMany({
      where: { teamId: params.id },
      orderBy: { joinedAt: 'asc' },
      include: { player: { select: { id: true, name: true, role: true, discordUsername: true } } },
    });
    return NextResponse.json(members);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { playerId, role, isCaptain, isSub } = await req.json();
    if (!playerId || !role) {
      return NextResponse.json({ error: 'playerId and role are required' }, { status: 400 });
    }
    const member = await prisma.teamMember.create({
      data: {
        teamId: params.id,
        playerId,
        role,
        isCaptain: isCaptain ?? false,
        isSub: isSub ?? false,
      },
      include: { player: { select: { id: true, name: true, role: true } } },
    });
    return NextResponse.json(member, { status: 201 });
  } catch (e) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Player is already a member of this team' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
  }
}
