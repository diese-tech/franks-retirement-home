import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';
import { logAudit } from '@/lib/audit';
import { extractSmite2Details } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

// POST /api/ocr/extract
// Accepts either an admin session cookie OR a valid X-Captain-Key for the match.
// Captains can upload screenshots; only admins can approve via /api/ocr/[id]/submit.
// Body: { gameId, imageBase64, mimeType? }
// Returns: { ok: true } for captains (no extraction data exposed); full result for admins.
export async function POST(req) {
  const adminGuard = requireAdmin(req);

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 503 });
  }

  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { gameId, imageBase64, mimeType = 'image/png' } = body;
  if (!gameId) return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
  if (!imageBase64) return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { match: { include: { homeTeam: { select: { id: true, name: true, tag: true } }, awayTeam: { select: { id: true, name: true, tag: true } } } } },
  });
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  // If admin auth failed, try captain key as fallback
  let isCaptain = false;
  if (adminGuard !== null) {
    const captainKey = req.headers.get('x-captain-key');
    const { homeTeamCaptainKey, awayTeamCaptainKey } = game.match;
    if (!captainKey || (captainKey !== homeTeamCaptainKey && captainKey !== awayTeamCaptainKey)) {
      return adminGuard; // return the original 401
    }
    isCaptain = true;
  }

  const extraction = await prisma.ocrExtraction.create({
    data: { gameId, attachmentUrl: isCaptain ? 'captain-upload' : 'admin-upload', mimeType, status: 'processing' },
  });

  let geminiResult;
  try {
    geminiResult = await extractSmite2Details(imageBase64, mimeType);
  } catch (err) {
    await prisma.ocrExtraction.update({
      where: { id: extraction.id },
      data: { status: 'failed', errorMessage: err.message, completedAt: new Date() },
    });
    return NextResponse.json({ error: `Extraction failed: ${err.message}` }, { status: 502 });
  }

  const players = geminiResult.players ?? [];
  const gods = await prisma.god.findMany({ select: { id: true, name: true } });

  await prisma.$transaction(async (tx) => {
    for (const p of players) {
      // Auto-resolve god name case-insensitively
      const godMatch = gods.find(g => g.name.toLowerCase() === (p.god ?? '').toLowerCase());

      // Auto-resolve player by IGN against both teams
      const allMembers = await tx.teamMember.findMany({
        where: {
          teamId: { in: [game.match.homeTeamId, game.match.awayTeamId] },
          leftAt: null,
        },
        include: { player: { select: { id: true, name: true, discordUsername: true, aliases: { select: { alias: true } } } } },
      });
      const ign = (p.ign ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const playerMatch = allMembers.find(m => {
        const name = m.player.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const discord = (m.player.discordUsername ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const aliasMatch = m.player.aliases.some(a => a.alias.toLowerCase().replace(/[^a-z0-9]/g, '') === ign);
        return name === ign || discord === ign || aliasMatch;
      });

      await tx.extractedStatLine.create({
        data: {
          extractionId: extraction.id,
          ignRaw: p.ign ?? '',
          teamRaw: p.side ?? null,
          godRaw: p.god ?? null,
          kills: p.kills ?? 0,
          deaths: p.deaths ?? 0,
          assists: p.assists ?? 0,
          damageDealt: p.playerDamage ?? 0,
          damageMitigated: p.damageMitigated ?? 0,
          healing: (p.selfHealing ?? 0) + (p.allyHealing ?? 0),
          structureDamage: p.structureDamage ?? 0,
          resolvedGodId: godMatch?.id ?? null,
          resolvedPlayerId: playerMatch?.playerId ?? null,
          status: 'pending',
        },
      });
    }

    await tx.ocrExtraction.update({
      where: { id: extraction.id },
      data: {
        status: 'completed',
        rawModelOutput: JSON.stringify(geminiResult),
        completedAt: new Date(),
      },
    });
  });

  const result = await prisma.ocrExtraction.findUnique({
    where: { id: extraction.id },
    include: { rows: true },
  });

  logAudit('OcrExtraction', extraction.id, 'extracted', { payload: { gameId, rowCount: players.length, source: isCaptain ? 'captain' : 'admin' } });
  // Captains get a simple confirmation — no extracted data exposed to them
  if (isCaptain) return NextResponse.json({ ok: true, extractionId: extraction.id }, { status: 201 });
  return NextResponse.json(result, { status: 201 });
}
