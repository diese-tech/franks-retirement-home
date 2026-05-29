import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { DRAFT_STATUSES } from '@/lib/constants';
import { resolveAdminAuth } from '@/lib/resolveAuth';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

function parseLimit(raw, fallback, max) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

// GET /api/drafts/admin
//   - List form: returns drafts including admin/captain keys, paginated.
//     Query params: ?limit=N (default 100, max 200), ?status=<status>.
// GET /api/drafts/admin?id=<draftId>
//   - Single form: returns one draft including keys.
//
// Gated by `requireAdmin` (issue #6). Used by AdminClient share modal so
// keys never leak through GET /api/drafts.
export async function GET(request) {
  const guard = await resolveAdminAuth(request);
  if (guard) return guard;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  try {
    if (id) {
      const draft = await prisma.draft.findUnique({ where: { id } });
      if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      return NextResponse.json(draft);
    }

    const limit = parseLimit(searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
    const status = searchParams.get('status');
    if (status && !DRAFT_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${DRAFT_STATUSES.join(', ')}` }, { status: 400 });
    }

    const drafts = await prisma.draft.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json(drafts);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }
}
