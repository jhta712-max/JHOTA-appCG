import prisma from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

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

export async function sendTestWhatsApp(): Promise<void> {
  if (!env.ULTRAMSG_INSTANCE_ID || !env.ULTRAMSG_TOKEN) {
    throw new Error('UltraMsg no está configurado (faltan ULTRAMSG_INSTANCE_ID o ULTRAMSG_TOKEN)');
  }

  // El test se envía a todos los destinatarios activos sin filtrar por tipo
  // (es un mensaje de prueba de conectividad, no una alerta de negocio)
  const unique = await getWhatsAppRecipients();

  if (unique.length === 0) {
    throw new Error('No hay destinatarios WhatsApp configurados. Agrega contactos o activa el opt-in en usuarios.');
  }

  for (const to of unique) {
    const resp = await fetch(
      `https://api.ultramsg.com/${env.ULTRAMSG_INSTANCE_ID}/messages/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: env.ULTRAMSG_TOKEN,
          to,
          body: '✅ *Control de Gastos — Prueba*\n\nLas notificaciones de WhatsApp están configuradas correctamente.',
        }),
      },
    );
    if (!resp.ok) {
      const err = await resp.text();
      logger.error('[Notifications] UltraMsg test error:', err);
      throw new Error(`UltraMsg respondió con error: ${err}`);
    }
  }
  logger.info(`[Notifications] Test WhatsApp enviado a ${unique.length} destinatario(s).`);
}

function normalizePhone(phone: string): string {
  const clean = phone.replace(/[\s\-(). ]/g, '');
  // Strip "whatsapp:" prefix — UltraMsg uses plain numbers e.g. "+18095551234"
  const withoutPrefix = clean.startsWith('whatsapp:') ? clean.slice(9) : clean;
  return withoutPrefix.startsWith('+') ? withoutPrefix : `+${withoutPrefix}`;
}

export async function getWhatsAppRecipients(type?: string): Promise<string[]> {
  const [users, contacts] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        whatsappOptIn: true,
        phone: { not: null },
        ...(type ? {
          OR: [
            { notifTypes: { isEmpty: true } },
            { notifTypes: { has: type } },
          ],
        } : {}),
      },
      select: { phone: true },
    }),
    prisma.notificationContact.findMany({
      where: {
        isActive: true,
        phone: { not: null },
        ...(type ? {
          OR: [
            { notifTypes: { isEmpty: true } },
            { notifTypes: { has: type } },
          ],
        } : {}),
      },
      select: { phone: true },
    }),
  ]);

  const numbers: string[] = [];
  for (const u of users)    if (u.phone) numbers.push(normalizePhone(u.phone));
  for (const c of contacts) if (c.phone) numbers.push(normalizePhone(c.phone));

  if (numbers.length === 0 && env.NOTIFY_WHATSAPP_TO) {
    env.NOTIFY_WHATSAPP_TO.split(',').map(s => s.trim()).filter(Boolean).forEach(n => numbers.push(n));
  }

  return [...new Set(numbers)];
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
