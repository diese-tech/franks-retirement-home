import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { getDiscordSessionUser } from '@/lib/discordAuth';

// GET /api/admin/superlatives?status=suggested  — admin listing (all statuses)
export async function GET(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  try {
    const items = await prisma.superlative.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ status: 'asc' }, { displayOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(items);
  } catch (err) {
    console.error('[admin/superlatives GET]', err);
    return NextResponse.json({ error: 'Failed to load superlatives' }, { status: 500 });
  }
}

// POST /api/admin/superlatives  — create an active superlative
export async function POST(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const session = getDiscordSessionUser(request);

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, description, nominee, weekLabel } = body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  try {
    const item = await prisma.superlative.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        nominee: nominee?.trim() || null,
        weekLabel: weekLabel?.trim() || null,
        status: 'active',
        createdById: session?.username ?? 'FRH Staff',
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('[admin/superlatives POST]', err);
    return NextResponse.json({ error: 'Failed to create superlative' }, { status: 500 });
  }
}
