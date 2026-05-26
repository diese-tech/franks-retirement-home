import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminSession';
import { invalidateAllStandings } from '@/lib/standings';

export const dynamic = 'force-dynamic';

// POST /api/standings/recompute — admin: flush standings cache for all divisions
export async function POST(req) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  invalidateAllStandings();
  return NextResponse.json({ ok: true, recomputedAt: new Date().toISOString() });
}
