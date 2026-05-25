import prisma from '@/lib/db';

// logAudit — fire-and-forget audit entry. Never throws; errors are swallowed
// so a logging failure never breaks the calling request.
export async function logAudit(entity, entityId, action, { adminId = null, payload = {} } = {}) {
  try {
    await prisma.auditLog.create({
      data: { entity, entityId, action, adminId: adminId || null, payload },
    });
  } catch {
    // intentionally silent — audit log is best-effort
  }
}
