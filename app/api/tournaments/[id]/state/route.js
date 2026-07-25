import { NextResponse } from 'next/server';
import { buildTournamentState } from '@/lib/tournamentState';

export const dynamic = 'force-dynamic';

// GET /api/tournaments/[id]/state
// Returns full sanitized tournament state (participants + matches with
// computed matchState). Used by the viewer client for the initial render
// and any manual refresh, ahead of the SSE stream taking over. 404s for a
// missing or `draft` tournament — buildTournamentState is what actually
// enforces the draft exclusion (docs/adr/0003, docs/adr/0006).
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const state = await buildTournamentState(id);
    if (!state) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    return NextResponse.json(state);
  } catch {
    return NextResponse.json({ error: 'Failed to load tournament state' }, { status: 500 });
  }
}
