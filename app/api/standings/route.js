import { NextResponse } from 'next/server';
import { computeStandings } from '@/lib/standings';
import { reportServerError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

// GET /api/standings?divisionId=... — public
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const divisionId = searchParams.get('divisionId');
  if (!divisionId) {
    return NextResponse.json({ error: 'divisionId query param required' }, { status: 400 });
  }
  try {
    const standings = await computeStandings(divisionId);
    const res = NextResponse.json(standings);
    res.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res;
  } catch (e) {
    reportServerError(e, { route: 'standings GET' });
    return NextResponse.json({ error: 'Failed to compute standings' }, { status: 500 });
  }
}
