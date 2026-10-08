import prisma from '../prisma';

export const logAudit = async ({
  userId,
  userName,
  userRole,
  action,
  module,
  details,
  ipAddress,
}: {
  userId?: number;
  userName?: string;
  userRole?: string;
  action: string;
  module: string;
  details: string;
  ipAddress?: string;
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        userName,
        userRole,
        action,
        module,
        details,
        ipAddress: ipAddress || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Audit logging failed:', err);
  }
};
