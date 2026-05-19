import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/health
// Lightweight uptime check: pings Postgres with a trivial round-trip and
// returns 200 if it succeeds, 500 if not. Suitable for an external uptime
// monitor (UptimeRobot, BetterStack, etc.) or a deployment health gate.
//
// Intentionally unauthenticated and free of side effects.
export async function GET() {
  const startedAt = Date.now();
  try {
    // SELECT 1 — minimal query that exercises the prisma connection without
    // touching any application table.
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: 'franks-retirement-home',
      db: 'reachable',
      latencyMs: Date.now() - startedAt,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        service: 'franks-retirement-home',
        db: 'unreachable',
        latencyMs: Date.now() - startedAt,
        error: err?.message ?? 'unknown error',
      },
      { status: 500 },
    );
  }
}
