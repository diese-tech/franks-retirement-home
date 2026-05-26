import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminSession';
import { buildDraftForGame } from '@/lib/matchDraftProvisioning';

// POST /api/matches/[id]/games/[gameId]/draft
// Admin action: create (or return existing) match-bound Draft for a specific game.
// Idempotent — returns 200 with the existing draft if one already exists.
// The provisioning logic is shared with the auto-creation path in POST /api/matches.
export async function POST(req, { params }) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { id: matchId, gameId } = await params;

  try {
    const { draft, created } = await buildDraftForGame(matchId, gameId);
    return NextResponse.json(draft, { status: created ? 201 : 200 });
  } catch (err) {
    if (err.message.includes('not found')) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 });
  }
}
