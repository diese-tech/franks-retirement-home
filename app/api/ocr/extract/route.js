import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireAdmin } from '@/lib/adminSession';
import { logAudit } from '@/lib/audit';
import { extractSmite2Details } from '@/lib/gemini';
import { checkMatchWindow } from '@/lib/matchWindow';
import { resolveMatchCaptainAuth } from '@/lib/resolveAuth';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';
import { clampStat, MAX_KDA, MAX_AMOUNT } from '@/lib/statBounds';

export const dynamic = 'force-dynamic';

// POST /api/ocr/extract
// Accepts either an admin session cookie OR a valid X-Captain-Key for the match.
// Captains can upload screenshots; only admins can approve via /api/ocr/[id]/submit.
// Captains are subject to the match eligibility window; admins bypass it.
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
    include: {
      match: {
        include: {
          homeTeam: { select: { id: true, name: true, tag: true } },
          awayTeam: { select: { id: true, name: true, tag: true } },
        },
      },
    },
  });
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  // If admin auth failed, try Discord auth then captain key as fallback
  let isCaptain = false;
  if (adminGuard !== null) {
    const auth = await resolveMatchCaptainAuth(req, game.match);
    if (!auth.side && !auth.isAdmin) {
      return adminGuard; // return the original 401
    }
    if (auth.isAdmin) {
      // Discord admin - treat as admin path
    } else {
      isCaptain = true;

      // Captains are subject to the match eligibility window (section 7).
      const windowCheck = checkMatchWindow(game.match, { adminOverride: false });
      if (!windowCheck.ok) {
        return NextResponse.json({ error: windowCheck.reason }, { status: 403 });
      }

      // Every extraction is a paid Gemini call — cap captain uploads.
      // 6 per 10 minutes per client is plenty for a BO3/BO5 screenshot set.
      const { allowed } = await checkRateLimit(`ocr-extract:${clientIp(req)}`, 6, 600);
      if (!allowed) {
        return NextResponse.json({ error: 'Too many uploads. Try again in a few minutes.' }, { status: 429 });
      }
    }
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
          kills: clampStat(p.kills, MAX_KDA),
          deaths: clampStat(p.deaths, MAX_KDA),
          assists: clampStat(p.assists, MAX_KDA),
          damageDealt: clampStat(p.playerDamage, MAX_AMOUNT),
          damageMitigated: clampStat(p.damageMitigated, MAX_AMOUNT),
          healing: clampStat(p.selfHealing, MAX_AMOUNT) + clampStat(p.allyHealing, MAX_AMOUNT),
          structureDamage: clampStat(p.structureDamage, MAX_AMOUNT),
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
