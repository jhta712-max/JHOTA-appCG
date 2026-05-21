/**
 * Job de Notificaciones de Cotizaciones
 *
 * Envía recordatorios diarios a admins y supervisores cuando hay cotizaciones
 * abiertas cuya fecha de validez vence en los próximos 3 días (o ya vencieron).
 *
 * Schedule: todos los días a las 08:00 AM (hora República Dominicana, UTC-4)
 *           En cron UTC: 12:00 PM (noon) UTC = 08:00 AM RD
 */

import cron from 'node-cron';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { sendQuotationExpiringEmail, type ExpiringQuotationItem } from '../utils/mailer';
import { env } from '../config/env';

// URL base de la app (para los links en el correo)
const APP_URL = process.env.FRONTEND_URL ?? 'https://gastos-proyectos.onrender.com';

// Días de anticipación para alertar
const ALERT_DAYS = 3;

// ─── Lógica principal ─────────────────────────────────────────────────────────

export async function runQuotationExpiryNotifications() {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    logger.warn('[QuotationNotifications] Email no configurado. Saltando notificaciones.');
    return;
  }

  try {
    logger.info('[QuotationNotifications] Revisando cotizaciones próximas a vencer...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alertLimit = new Date(today);
    alertLimit.setDate(alertLimit.getDate() + ALERT_DAYS);

    // Cotizaciones abiertas cuya validUntil <= hoy + 3 días
    const expiring = await prisma.quotation.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED', 'ADVANCE_PAID', 'IN_PROGRESS', 'PARTIAL_INVOICED'] as any[] },
        validUntil: { lte: alertLimit },
      },
      include: {
        project:   { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { validUntil: 'asc' },
    });

    if (expiring.length === 0) {
      logger.info('[QuotationNotifications] No hay cotizaciones próximas a vencer.');
      return;
    }

    logger.info(`[QuotationNotifications] ${expiring.length} cotización(es) próxima(s) a vencer.`);

    // Construir la lista serializada para el email
    const items: ExpiringQuotationItem[] = expiring.map((q) => {
      const validUntil = q.validUntil!;
      const msLeft = validUntil.getTime() - today.getTime();
      const daysLeft = Math.max(0, Math.floor(msLeft / (1000 * 60 * 60 * 24)));
      return {
        id:              q.id,
        supplierName:    q.supplierName,
        quotationNumber: q.quotationNumber,
        projectCode:     (q as any).project.code,
        projectName:     (q as any).project.name,
        total:           Number(q.total),
        currency:        q.currency,
        validUntil,
        daysLeft,
      };
    });

    // Destinatarios: admins y supervisores activos (role via relación)
    const recipients = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: { in: ['admin', 'supervisor'] } },
      },
      select: { id: true, name: true, email: true },
    });

    if (recipients.length === 0) {
      logger.warn('[QuotationNotifications] No hay admins/supervisores activos para notificar.');
      return;
    }

    // Enviar email a cada destinatario con manejo individual de errores
    const results = await Promise.allSettled(
      recipients.map((user) =>
        sendQuotationExpiringEmail({
          toEmail:    user.email,
          toName:     user.name,
          quotations: items,
          appUrl:     APP_URL,
        }),
      ),
    );

    const sent   = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        logger.error(`[QuotationNotifications] Error enviando a ${recipients[i]!.email}:`, (r as PromiseRejectedResult).reason);
      }
    });

    logger.info(`[QuotationNotifications] Enviadas: ${sent} OK, ${failed} fallidas.`);

  } catch (err) {
    logger.error('[QuotationNotifications] Error general en el job:', err);
  }
}

// ─── Registro del cron ────────────────────────────────────────────────────────

export function startQuotationNotificationJob() {
  // 12:00 PM UTC = 08:00 AM UTC-4 (República Dominicana)
  const schedule = '0 12 * * *';

  cron.schedule(schedule, async () => {
    logger.info('[QuotationNotifications] Ejecutando job diario...');
    await runQuotationExpiryNotifications();
  });

  logger.info('[QuotationNotifications] Job registrado: diario a las 08:00 AM hora RD.');
}
