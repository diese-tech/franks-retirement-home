import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const seasonId = searchParams.get('seasonId');
    const divisions = await prisma.division.findMany({
      where: seasonId ? { seasonId } : {},
      orderBy: [{ seasonId: 'desc' }, { tier: 'asc' }],
      include: { season: { select: { name: true, slug: true } } },
    });
    return NextResponse.json(divisions);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch divisions' }, { status: 500 });
  }
}

export async function POST(req) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  try {
    const { seasonId, name, tier } = await req.json();
    if (!seasonId || !name || tier === undefined) {
      return NextResponse.json({ error: 'seasonId, name, and tier are required' }, { status: 400 });
    }
    const division = await prisma.division.create({
      data: { seasonId, name, tier: Number(tier) },
    });
    return NextResponse.json(division, { status: 201 });
  } catch (e) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Division name already exists for this season' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create division' }, { status: 500 });
  }
}
