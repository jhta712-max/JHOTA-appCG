import prisma from '../../config/database';

export async function getUserNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
    take: 50,
  });
}

export async function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markAsRead(id: string, userId: string) {
  await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
}

export async function markAllAsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}

export async function createNotification(opts: {
  userId:   string;
  type:     string;
  title:    string;
  message:  string;
  link?:    string;
  entityId?: string;
}) {
  return prisma.notification.create({ data: opts });
}

export async function recentNotificationExists(
  type: string,
  entityId: string,
  hoursAgo: number,
): Promise<boolean> {
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  const count = await prisma.notification.count({
    where: { type, entityId, createdAt: { gte: since } },
  });
  return count > 0;
}
