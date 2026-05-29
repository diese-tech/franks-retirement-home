import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// POST /api/ocr/[id]/submit
// Admin: approve an extraction and write canonical StatLine rows.
// Body: {
//   orderTeamId: string,   which team (home or away) was the Order side
//   winnerTeamId: string,
//   rows: [{
//     id: string,          ExtractedStatLine id
//     resolvedPlayerId: string | null,
//     resolvedGodId: string | null,
//     kills, deaths, assists, damage, damageMitigated, healing, structureDamage: number,
//     include: boolean     false = skip this row
//   }]
// }
export async function POST(req, { params }) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { orderTeamId, winnerTeamId, rows } = body;
  if (!orderTeamId) return NextResponse.json({ error: 'orderTeamId is required' }, { status: 400 });
  if (!winnerTeamId) return NextResponse.json({ error: 'winnerTeamId is required' }, { status: 400 });
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: 'rows is required' }, { status: 400 });

  const extraction = await prisma.ocrExtraction.findUnique({
    where: { id: params.id },
    include: { game: { include: { match: { include: { homeTeam: true, awayTeam: true } } } } },
  });
  if (!extraction) return NextResponse.json({ error: 'Extraction not found' }, { status: 404 });
  if (!extraction.gameId) return NextResponse.json({ error: 'Extraction is not linked to a game' }, { status: 400 });

  const { homeTeamId, awayTeamId } = extraction.game.match;
  const chaosTeamId = orderTeamId === homeTeamId ? awayTeamId : homeTeamId;

  const includedRows = rows.filter(r => r.include !== false);
  const unresolved = includedRows.filter(r => !r.resolvedPlayerId);
  if (unresolved.length > 0) {
    return NextResponse.json({
      error: `${unresolved.length} row(s) have no player assigned. Assign players or exclude those rows before submitting.`,
    }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    for (const row of includedRows) {
      // Determine teamId from the side stored in ExtractedStatLine
      const extractedRow = await tx.extractedStatLine.findUnique({ where: { id: row.id } });
      const teamId = extractedRow?.teamRaw === 'order' ? orderTeamId : chaosTeamId;

      await tx.statLine.upsert({
        where: { gameId_playerId: { gameId: extraction.gameId, playerId: row.resolvedPlayerId } },
        create: {
          gameId: extraction.gameId,
          playerId: row.resolvedPlayerId,
          teamId,
          godId: row.resolvedGodId ?? null,
          kills: row.kills ?? 0,
          deaths: row.deaths ?? 0,
          assists: row.assists ?? 0,
          damage: row.damage ?? 0,
          damageMitigated: row.damageMitigated ?? 0,
          healing: row.healing ?? 0,
          structureDamage: row.structureDamage ?? 0,
        },
        update: {
          teamId,
          godId: row.resolvedGodId ?? null,
          kills: row.kills ?? 0,
          deaths: row.deaths ?? 0,
          assists: row.assists ?? 0,
          damage: row.damage ?? 0,
          damageMitigated: row.damageMitigated ?? 0,
          healing: row.healing ?? 0,
          structureDamage: row.structureDamage ?? 0,
        },
      });

      await tx.extractedStatLine.update({
        where: { id: row.id },
        data: { status: 'approved', resolvedPlayerId: row.resolvedPlayerId, resolvedGodId: row.resolvedGodId ?? null },
      });
    }

    // Reject excluded rows
    const excludedIds = rows.filter(r => r.include === false).map(r => r.id);
    if (excludedIds.length > 0) {
      await tx.extractedStatLine.updateMany({
        where: { id: { in: excludedIds } },
        data: { status: 'rejected', rejectionReason: 'excluded by admin' },
      });
    }

    await tx.game.update({
      where: { id: extraction.gameId },
      data: { winnerTeamId },
    });
  });

  logAudit('OcrExtraction', params.id, 'submitted', {
    payload: { gameId: extraction.gameId, rowsApproved: includedRows.length, winnerTeamId },
  });
  return NextResponse.json({ ok: true });
}
