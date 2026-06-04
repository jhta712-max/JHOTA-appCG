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
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio no está configurado (faltan TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN)');
  }

  const [users, contacts] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, whatsappOptIn: true, phone: { not: null } },
      select: { name: true, phone: true },
    }),
    prisma.notificationContact.findMany({
      where: { isActive: true, phone: { not: null } },
      select: { name: true, phone: true },
    }),
  ]);

  const recipients: string[] = [];
  for (const u of users)    if (u.phone) recipients.push(normalizePhone(u.phone));
  for (const c of contacts) if (c.phone) recipients.push(normalizePhone(c.phone));

  if (recipients.length === 0) {
    if (env.NOTIFY_WHATSAPP_TO) {
      env.NOTIFY_WHATSAPP_TO.split(',').map((s) => s.trim()).filter(Boolean).forEach((n) => recipients.push(n));
    }
  }

  if (recipients.length === 0) {
    throw new Error('No hay destinatarios WhatsApp configurados. Agrega contactos o activa el opt-in en usuarios.');
  }

  const unique = [...new Set(recipients)];
  for (const to of unique) {
    const body = new URLSearchParams({
      From: env.TWILIO_WHATSAPP_FROM,
      To:   to,
      Body: '✅ *Control de Gastos — Prueba*\n\nLas notificaciones de WhatsApp están configuradas correctamente.',
    });
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        },
        body: body.toString(),
      },
    );
    if (!resp.ok) {
      const err = await resp.text();
      logger.error('[Notifications] Twilio test error:', err);
      throw new Error(`Twilio respondió con error: ${err}`);
    }
  }
  logger.info(`[Notifications] Test WhatsApp enviado a ${unique.length} destinatario(s).`);
}

function normalizePhone(phone: string): string {
  const clean = phone.replace(/[\s\-().]/g, '');
  const withPlus = clean.startsWith('+') ? clean : `+${clean}`;
  return withPlus.startsWith('whatsapp:') ? withPlus : `whatsapp:${withPlus}`;
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
