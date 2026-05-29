import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { checkMatchWindow } from '@/lib/matchWindow';
import { checkSeriesComplete } from '@/lib/seriesResult';
import { invalidateAllStandings } from '@/lib/standings';
import { resolveMatchCaptainAuth, resolveAdminAuth } from '@/lib/resolveAuth';
import { captainLog } from '@/lib/captainLog';

export const dynamic = 'force-dynamic';

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function loadMatchAndGame(matchId, gameId) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeamCaptainKey: true,
      awayTeamCaptainKey: true,
      defaultScheduledAt: true,
      status: true,
      format: true,
      games: {
        orderBy: { gameNumber: 'asc' },
        select: { id: true, gameNumber: true, winnerTeamId: true, resultStatus: true },
      },
    },
  });
  if (!match) return { match: null, game: null };

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      matchId: true,
      gameNumber: true,
      resultStatus: true,
      reportedWinnerTeamId: true,
      reportedByTeamId: true,
      confirmedByTeamId: true,
      winnerTeamId: true,
      resultReportedAt: true,
      resultConfirmedAt: true,
      resultDisputedAt: true,
    },
  });

  if (!game || game.matchId !== matchId) return { match, game: null };
  return { match, game };
}

// ─── POST /api/matches/[id]/games/[gameId]/result ────────────────────────────
// Captain reports the game winner.
// Body: { winnerTeamId }
// Auth: X-Captain-Key header (home or away captain)
// Constraints:
//   - Match must not be completed/postponed
//   - Game resultStatus must be pending or null
//   - winnerTeamId must be homeTeamId or awayTeamId
//   - Eligibility window check applies to captains (admins bypass)
export async function POST(req, { params }) {
  const { id: matchId, gameId } = await params;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { winnerTeamId } = body;
  if (!winnerTeamId) {
    return NextResponse.json({ error: 'winnerTeamId is required' }, { status: 400 });
  }

  const { match, game } = await loadMatchAndGame(matchId, gameId);
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  if (!game)  return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  const adminErr = await resolveAdminAuth(req);
  const auth = await resolveMatchCaptainAuth(req, match);
  const isAdmin = adminErr === null || auth.isAdmin;
  const captainSide = auth.side;

  if (!isAdmin && !captainSide) {
    captainLog('captain_auth_failed', { matchId, reason: 'no_auth_resolved' });
    return NextResponse.json({ error: 'Valid captain key or admin session required' }, { status: 401 });
  }

  try {
    if (['completed', 'postponed'].includes(match.status)) {
      return NextResponse.json({ error: 'Match is already completed or postponed' }, { status: 400 });
    }

    if (game.resultStatus === 'confirmed') {
      return NextResponse.json({ error: 'Game result is already confirmed' }, { status: 409 });
    }
    if (game.resultStatus === 'reported') {
      return NextResponse.json({ error: 'A result has already been reported — the opposing captain must confirm or dispute it' }, { status: 409 });
    }

    if (winnerTeamId !== match.homeTeamId && winnerTeamId !== match.awayTeamId) {
      return NextResponse.json({ error: 'winnerTeamId must be one of the two match teams' }, { status: 400 });
    }

    // Eligibility window check (captains only)
    if (!isAdmin) {
      const windowCheck = checkMatchWindow(match);
      if (!windowCheck.ok) {
        return NextResponse.json({ error: windowCheck.reason }, { status: 403 });
      }
    }

    // Which teamId is the reporter?
    const reportingTeamId = isAdmin
      ? null
      : captainSide === 'home' ? match.homeTeamId : match.awayTeamId;

    // Use updateMany with a resultStatus guard so two simultaneous reports
    // can't both succeed — the second writer gets zero rows and returns 409.
    const { count } = await prisma.game.updateMany({
      where: { id: gameId, resultStatus: null },
      data: {
        resultStatus: 'reported',
        reportedWinnerTeamId: winnerTeamId,
        reportedByTeamId: reportingTeamId,
        resultReportedAt: new Date(),
        // Clear any previous dispute timestamps if re-reporting after admin reset
        resultDisputedAt: null,
        confirmedByTeamId: null,
      },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: 'A result has already been reported for this game' },
        { status: 409 }
      );
    }

    const updated = await prisma.game.findUnique({ where: { id: gameId } });
    captainLog('captain_result_reported', { matchId, gameId, captainSide, winnerTeamId, source: auth.source });
    return NextResponse.json(updated, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to report result' }, { status: 500 });
  }
}

// ─── PATCH /api/matches/[id]/games/[gameId]/result ───────────────────────────
// Confirm, dispute, or admin-resolve a reported game result.
// Body: { action: 'confirm' | 'dispute' | 'resolve', winnerTeamId? }
//   confirm  — opposing captain agrees with the reported winner
//   dispute  — opposing captain disagrees; blocks series progression
//   resolve  — admin sets the definitive winner and clears the dispute
// Auth: X-Captain-Key (confirm/dispute) or requireAdmin (resolve)
export async function PATCH(req, { params }) {
  const { id: matchId, gameId } = await params;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, winnerTeamId: resolvedWinner } = body;
  if (!['confirm', 'dispute', 'resolve'].includes(action)) {
    return NextResponse.json({ error: "action must be 'confirm', 'dispute', or 'resolve'" }, { status: 400 });
  }

  const adminErr = await resolveAdminAuth(req);
  const isAdmin = adminErr === null;

  if (action === 'resolve' && !isAdmin) {
    return NextResponse.json({ error: 'Only admins can resolve disputes' }, { status: 403 });
  }

  try {
    const { match, game } = await loadMatchAndGame(matchId, gameId);
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (!game)  return NextResponse.json({ error: 'Game not found' }, { status: 404 });

    if (action === 'resolve') {
      if (game.resultStatus !== 'disputed') {
        return NextResponse.json({ error: 'Game is not in disputed state' }, { status: 400 });
      }
      if (!resolvedWinner) {
        return NextResponse.json({ error: 'winnerTeamId is required when resolving a dispute' }, { status: 400 });
      }
      if (resolvedWinner !== match.homeTeamId && resolvedWinner !== match.awayTeamId) {
        return NextResponse.json({ error: 'winnerTeamId must be one of the two match teams' }, { status: 400 });
      }

      return await confirmResult(match, game, resolvedWinner, null);
    }

    // confirm or dispute — requires captain key
    const auth = await resolveMatchCaptainAuth(req, match);
    const captainSide = auth.side;
    if (!captainSide) {
      return NextResponse.json({ error: 'Valid captain key required' }, { status: 401 });
    }

    if (game.resultStatus !== 'reported') {
      return NextResponse.json({ error: 'Game result has not been reported yet' }, { status: 400 });
    }

    const confirmingTeamId = captainSide === 'home' ? match.homeTeamId : match.awayTeamId;

    // The OPPOSING captain must confirm/dispute (not the same side that reported)
    if (game.reportedByTeamId && confirmingTeamId === game.reportedByTeamId) {
      return NextResponse.json({ error: 'The reporting captain cannot confirm or dispute their own report' }, { status: 403 });
    }

    // Eligibility window check for captains
    const windowCheck = checkMatchWindow(match);
    if (!windowCheck.ok) {
      return NextResponse.json({ error: windowCheck.reason }, { status: 403 });
    }

    if (action === 'dispute') {
      const updated = await prisma.game.update({
        where: { id: gameId },
        data: {
          resultStatus: 'disputed',
          resultDisputedAt: new Date(),
          confirmedByTeamId: confirmingTeamId,
        },
      });
      captainLog('captain_result_disputed', { matchId, gameId, captainSide, source: auth.source });
      return NextResponse.json(updated);
    }

    // action === 'confirm'
    captainLog('captain_result_confirmed', { matchId, gameId, captainSide, source: auth.source });
    return await confirmResult(match, game, game.reportedWinnerTeamId, confirmingTeamId);
  } catch {
    return NextResponse.json({ error: 'Failed to update result' }, { status: 500 });
  }
}

// ─── Shared confirmation logic ────────────────────────────────────────────────
// Atomically:
//   1. Set game.winnerTeamId + resultStatus = confirmed
//   2. Check whether the series is now won
//   3. If series complete → set Match.status = completed
//   4. Invalidate standings cache
async function confirmResult(match, game, winnerTeamId, confirmingTeamId) {
  const result = await prisma.$transaction(async (tx) => {
    const updatedGame = await tx.game.update({
      where: { id: game.id },
      data: {
        winnerTeamId,
        resultStatus: 'confirmed',
        resultConfirmedAt: new Date(),
        confirmedByTeamId: confirmingTeamId,
        // Lock in the reported winner as the confirmed winner
        reportedWinnerTeamId: winnerTeamId,
      },
    });

    // Re-read all games to compute fresh series score
    const allGames = await tx.game.findMany({
      where: { matchId: match.id },
      select: { winnerTeamId: true },
    });

    const series = checkSeriesComplete(allGames, match.homeTeamId, match.awayTeamId, match.format);

    let updatedMatch = null;
    if (series.complete && match.status !== 'completed') {
      updatedMatch = await tx.match.update({
        where: { id: match.id },
        data: { status: 'completed' },
      });
    } else if (match.status === 'scheduled') {
      // Auto-set to live on first confirmed game result
      updatedMatch = await tx.match.update({
        where: { id: match.id },
        data: { status: 'live' },
      });
    }

    return { game: updatedGame, match: updatedMatch, seriesComplete: series.complete };
  });

  if (result.seriesComplete) {
    invalidateAllStandings();
  }

  return NextResponse.json(result);
}
