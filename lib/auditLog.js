import prisma from '@/lib/db';

/**
 * Fire-and-forget audit logger. Never throws, never blocks the caller.
 */
export function logAudit({ entity, entityId, action, adminId = null, payload = {} }) {
  prisma.auditLog.create({
    data: { entity, entityId, action, adminId, payload },
  }).catch(err => console.error('[auditLog] write failed:', err?.message));
}
