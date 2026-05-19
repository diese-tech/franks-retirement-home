import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

// GET /api/drafts/admin
//   - List form: returns all drafts including admin/captain keys.
// GET /api/drafts/admin?id=<draftId>
//   - Single form: returns one draft including keys.
//
// This endpoint exists so the AdminClient share modal can fetch the keys
// it needs without leaking them through the public GET /api/drafts (see
// issue #5). It is gated by `requireAdmin` — when ADMIN_AUTH_REQUIRED is
// off (rollout default) the guard is a no-op and behavior matches the
// pre-change /api/drafts response.
export async function GET(request) {
  const guard = requireAdmin(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  try {
    if (id) {
      const draft = await prisma.draft.findUnique({ where: { id } });
      if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      return NextResponse.json(draft);
    }
    const drafts = await prisma.draft.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(drafts);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }
}
