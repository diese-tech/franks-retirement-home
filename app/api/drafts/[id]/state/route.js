import { NextResponse } from 'next/server';
import { buildDraftState } from '@/lib/draftState';
import { reportServerError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

// GET /api/drafts/[id]/state
// Returns full key-stripped draft state. Used by client for immediate post-action refresh.
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const state = await buildDraftState(id);
    if (!state) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    return NextResponse.json(state);
  } catch (err) {
    reportServerError(err, { route: 'drafts/[id]/state GET' });
    return NextResponse.json({ error: 'Failed to load draft state' }, { status: 500 });
  }
}
