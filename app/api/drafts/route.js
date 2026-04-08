import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET /api/drafts — list all drafts
export async function GET() {
  const drafts = await prisma.draft.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(drafts);
}

// POST /api/drafts — create draft or update status
// Body: { name } for create, { id, status } for update
export async function POST(request) {
  const body = await request.json();

  // Update status
  if (body.id && body.status) {
    const draft = await prisma.draft.update({
      where: { id: body.id },
      data: { status: body.status },
    });
    return NextResponse.json(draft);
  }

  // Create
  const draft = await prisma.draft.create({
    data: { name: body.name || 'Draft' },
  });
  return NextResponse.json(draft, { status: 201 });
}

// DELETE /api/drafts?id=xxx
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await prisma.draft.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
