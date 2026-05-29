import prisma from '@/lib/db';
import KnowsBallClient from './KnowsBallClient';

export const revalidate = 300;

export default async function KnowsBallPage() {
  let lines = null;
  let editorial = null;
  let lineCount = 0;

  try {
    [lines, lineCount] = await Promise.all([
      prisma.bettingLine.findMany({
        where: { status: 'open' },
        orderBy: { createdAt: 'desc' },
        include: {
          match: {
            include: {
              homeTeam: { select: { id: true, name: true, tag: true } },
              awayTeam: { select: { id: true, name: true, tag: true } },
              division: { select: { name: true } },
            },
          },
          teamA: { select: { id: true, name: true, tag: true } },
          teamB: { select: { id: true, name: true, tag: true } },
        },
      }),
      prisma.bettingLine.count({ where: { status: 'open' } }),
    ]);
  } catch (err) {
    console.error('[knows-ball lines]', err);
  }

  try {
    const row = await prisma.homepageContent.findUnique({ where: { status: 'published' } });
    editorial = row?.knowsBall ?? null;
  } catch (err) {
    console.error('[knows-ball editorial]', err);
  }

  const serialized = {
    lines: lines ? JSON.parse(JSON.stringify(lines)) : null,
    lineCount,
    editorial,
  };

  return <KnowsBallClient {...serialized} />;
}
