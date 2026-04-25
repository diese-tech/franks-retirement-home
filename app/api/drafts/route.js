import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { DRAFT_STATUSES } from '@/lib/constants';

// GET /api/drafts — list all drafts
export async function GET() {
  try {
    const drafts = await prisma.draft.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(drafts);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }
}

// POST /api/drafts — create draft or update status
// Body: { name } for create, { id, status } for update
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    if (body.id && body.status) {
      if (!DRAFT_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: `status must be one of: ${DRAFT_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      const draft = await prisma.draft.update({
        where: { id: body.id },
        data: { status: body.status },
      });
      return NextResponse.json(draft);
    }

    const rawName = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    const draft = await prisma.draft.create({
      data: { name: rawName || 'Draft' },
    });
    return NextResponse.json(draft, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }
}

// DELETE /api/drafts?id=xxx
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    await prisma.draft.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
}
