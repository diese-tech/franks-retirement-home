import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from '@/lib/db';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// POST /api/forgelens/callback
// Receives OCR results from the ForgeLens worker.
// Validates HMAC-SHA256 signature in X-ForgeLens-Signature header.
// Body: { jobId, status, confidence, parserVersion, warnings, rows, rawModelOutput?, error? }
// On success/needs_review: creates ExtractedStatLine rows, transitions OcrExtraction status.
// On failure: sets OcrExtraction.status = 'failed' with errorMessage.
export async function POST(req) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-forgelens-signature');
  const secret = process.env.FORGELENS_HMAC_SECRET;

  // Fail closed: without a shared secret there is no way to authenticate the
  // caller, and this endpoint writes staging stat rows. Only skip verification
  // in non-production so local development works without a worker.
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[forgelens/callback] FORGELENS_HMAC_SECRET is not set — rejecting callback');
      return NextResponse.json({ error: 'ForgeLens not configured' }, { status: 503 });
    }
  } else {
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuffer = Buffer.from(signature.replace('sha256=', ''), 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let body;
  try { body = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { jobId, status, confidence, parserVersion, warnings = [], rows = [], rawModelOutput, error: errorMsg } = body;

  if (!jobId || !status) {
    return NextResponse.json({ error: 'jobId and status are required' }, { status: 400 });
  }

  const extraction = await prisma.ocrExtraction.findUnique({ where: { id: jobId } });
  if (!extraction) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Idempotency: if already completed, return 200 without re-processing
  if (extraction.status === 'completed' || extraction.status === 'needs_review') {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  if (status === 'failed') {
    await prisma.ocrExtraction.update({
      where: { id: jobId },
      data: { status: 'failed', errorMessage: errorMsg ?? 'ForgeLens reported failure', completedAt: new Date() },
    });
    logAudit('OcrExtraction', jobId, 'callback_failed', { payload: { errorMsg } });
    return NextResponse.json({ ok: true });
  }

  if (status === 'completed' || status === 'needs_review') {
    await prisma.$transaction(async (tx) => {
      await tx.ocrExtraction.update({
        where: { id: jobId },
        data: {
          status,
          confidence: confidence ?? null,
          parserVersion: parserVersion ?? null,
          rawModelOutput: rawModelOutput ?? null,
          warnings: warnings ?? [],
          completedAt: new Date(),
        },
      });

      // Create one ExtractedStatLine per row in the ForgeLens response
      for (const row of rows) {
        await tx.extractedStatLine.create({
          data: {
            extractionId: jobId,
            ignRaw: row.ign ?? '',
            teamRaw: row.team ?? null,
            roleRaw: row.role ?? null,
            godRaw: row.god ?? null,
            kills: row.kills ?? 0,
            deaths: row.deaths ?? 0,
            assists: row.assists ?? 0,
            damageDealt: row.damageDealt ?? 0,
            damageMitigated: row.damageMitigated ?? 0,
            healing: row.healing ?? 0,
            goldEarned: row.goldEarned ?? 0,
            structureDamage: row.structureDamage ?? 0,
            confidence: row.confidence ?? null,
            status: 'pending',
          },
        });
      }
    });

    // Attempt auto-resolution of player and god names via aliases + exact match
    await autoResolveExtractedRows(jobId);

    logAudit('OcrExtraction', jobId, `callback_${status}`, { payload: { confidence, rowCount: rows.length } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown status: ${status}` }, { status: 400 });
}

// Attempt to resolve ignRaw → Player and godRaw → God for all pending rows
async function autoResolveExtractedRows(extractionId) {
  const rows = await prisma.extractedStatLine.findMany({
    where: { extractionId, status: 'pending' },
  });

  for (const row of rows) {
    const updates = {};

    if (!row.resolvedPlayerId && row.ignRaw) {
      // Try alias table first, then discord, then name
      const alias = await prisma.playerAlias.findUnique({ where: { alias: row.ignRaw } });
      if (alias) {
        updates.resolvedPlayerId = alias.playerId;
      } else {
        const player = await prisma.player.findFirst({
          where: {
            OR: [
              { discordUsername: row.ignRaw },
              { name: { equals: row.ignRaw, mode: 'insensitive' } },
            ],
          },
        });
        if (player) updates.resolvedPlayerId = player.id;
      }
    }

    if (!row.resolvedGodId && row.godRaw) {
      const god = await prisma.god.findFirst({ where: { name: { equals: row.godRaw, mode: 'insensitive' } } });
      if (god) updates.resolvedGodId = god.id;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.extractedStatLine.update({ where: { id: row.id }, data: updates });
    }
  }
}
