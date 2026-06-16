import prisma from '../config/database';

type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export async function logAudit(params: {
  tableName: string;
  recordId: string;
  action: AuditAction;
  userId?: string | null;
  oldData?: object | null;
  newData?: object | null;
  ipAddress?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        tableName:  params.tableName,
        recordId:   params.recordId,
        action:     params.action,
        userId:     params.userId ?? null,
        oldData:    params.oldData   ?? undefined,
        newData:    params.newData   ?? undefined,
        ipAddress:  params.ipAddress ?? null,
      },
    });
  } catch {
    // Audit failures must never break the main flow
  }
}
