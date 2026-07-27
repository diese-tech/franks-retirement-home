import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveAdminAuth } from '@/lib/resolveAuth';
import { reportServerError } from '@/lib/apiError';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const authError = await resolveAdminAuth(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'pending';

  try {
    const requests = await prisma.changeRequest.findMany({
      where: status === 'all' ? {} : { status },
      include: { team: { select: { name: true, tag: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return NextResponse.json(requests);
  } catch (err) {
    reportServerError(err, { route: 'admin/change-requests GET' });
    return NextResponse.json({ error: 'Change requests unavailable. Run database migrations.' }, { status: 503 });
  }
}
