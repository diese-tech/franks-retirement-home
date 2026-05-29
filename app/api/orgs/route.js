import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';

export async function GET() {
  try {
    const orgs = await prisma.org.findMany({
      orderBy: { name: 'asc' },
      include: { teams: { select: { id: true, name: true, tag: true } } },
    });
    return NextResponse.json(orgs);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch orgs' }, { status: 500 });
  }
}

export async function POST(req) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  try {
    const { name, tag, logoInitials, accentColor } = await req.json();
    if (!name || !tag) {
      return NextResponse.json({ error: 'name and tag are required' }, { status: 400 });
    }
    const org = await prisma.org.create({ data: { name, tag, logoInitials, accentColor } });
    return NextResponse.json(org, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create org' }, { status: 500 });
  }
}
