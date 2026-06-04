import cron from 'node-cron';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { createNotification, recentNotificationExists } from '../modules/notifications/notifications.service';
import {
  sendBudgetAlertEmail,
  sendPendingOrdersEmail,
  sendApprovedPayrollsEmail,
} from '../utils/mailer';

const APP_URL = process.env.FRONTEND_URL ?? 'https://gastos-proyectos.onrender.com';

// ─── WhatsApp helper (Twilio, graceful no-op if not configured) ───────────────

async function sendWhatsApp(message: string): Promise<void> {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.NOTIFY_WHATSAPP_TO) return;
  const recipients = env.NOTIFY_WHATSAPP_TO.split(',').map((s) => s.trim()).filter(Boolean);
  for (const to of recipients) {
    try {
      const body = new URLSearchParams({ From: env.TWILIO_WHATSAPP_FROM, To: to, Body: message });
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
        logger.error('[BusinessNotifications] Twilio error:', err);
      }
    } catch (err) {
      logger.error('[BusinessNotifications] Error enviando WhatsApp:', err);
    }
  }
}

// ─── Admin/Supervisor recipients ─────────────────────────────────────────────

async function getAdminSupervisorUsers() {
  return prisma.user.findMany({
    where: { isActive: true, role: { name: { in: ['admin', 'supervisor'] } } },
    select: { id: true, name: true, email: true },
  });
}

// ─── Check 1: Budget thresholds ──────────────────────────────────────────────

async function checkBudgetThresholds() {
  const projects = await prisma.project.findMany({
    where: { status: 'ACTIVE', estimatedBudget: { gt: 0 } },
    select: {
      id: true, code: true, name: true, estimatedBudget: true,
      expenses: { where: { status: 'ACTIVE' }, select: { amount: true } },
    },
  });

  const recipients = await getAdminSupervisorUsers();
  let alertCount = 0;

  for (const project of projects) {
    const budget = Number(project.estimatedBudget);
    const spent  = project.expenses.reduce((s, e) => s + Number(e.amount), 0);
    const pct    = (spent / budget) * 100;

    for (const threshold of [80, 90] as const) {
      if (pct < threshold) continue;
      const type     = `BUDGET_${threshold}` as const;
      const entityId = project.id;

      const alreadySent = await recentNotificationExists(type, entityId, 7 * 24);
      if (alreadySent) continue;

      const title   = `Proyecto ${project.code} al ${threshold}% del presupuesto`;
      const message = `El proyecto "${project.name}" ha consumido RD ${(spent / 1000).toFixed(0)}K de RD ${(budget / 1000).toFixed(0)}K (${Math.round(pct)}%).`;
      const link    = `/projects/${project.id}/financial`;

      for (const user of recipients) {
        await createNotification({ userId: user.id, type, title, message, link, entityId });
      }

      if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
        for (const user of recipients) {
          await sendBudgetAlertEmail({
            toEmail: user.email, toName: user.name,
            projectCode: project.code, projectName: project.name, projectId: project.id,
            pct: Math.round(pct), spent, budget, appUrl: APP_URL,
          }).catch((err) => logger.error('[BusinessNotifications] Email error:', err));
        }
      }

      await sendWhatsApp(
        `⚠️ *Control de Gastos — Alerta presupuesto*\n\n` +
        `Proyecto: ${project.code} — ${project.name}\n` +
        `Consumido: ${Math.round(pct)}% (RD $${spent.toLocaleString('es-DO')} / RD $${budget.toLocaleString('es-DO')})\n\n` +
        `Ver: ${APP_URL}/projects/${project.id}/financial`,
      );

      alertCount++;
      logger.info(`[BusinessNotifications] Budget ${threshold}% alert: ${project.code}`);
    }
  }

  if (alertCount === 0) logger.info('[BusinessNotifications] Budget check: no new alerts.');
}

// ─── Check 2: Pending orders +5 days ─────────────────────────────────────────

async function checkPendingOrders() {
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  const orders = await prisma.paymentOrder.findMany({
    where: { status: 'PENDING', createdAt: { lte: fiveDaysAgo } },
    include: { project: { select: { code: true } } },
    orderBy: { createdAt: 'asc' },
  });

  if (orders.length === 0) {
    logger.info('[BusinessNotifications] Pending orders check: no stale orders.');
    return;
  }

  const alreadySent = await recentNotificationExists('PENDING_ORDERS', 'global', 24);
  if (alreadySent) {
    logger.info('[BusinessNotifications] Pending orders: notified in last 24h, skipping.');
    return;
  }

  const recipients = await getAdminSupervisorUsers();
  const title   = `${orders.length} orden${orders.length !== 1 ? 'es' : ''} de pago pendiente${orders.length !== 1 ? 's' : ''}`;
  const message = `Hay ${orders.length} orden${orders.length !== 1 ? 'es' : ''} de pago sin pagar con más de 5 días de antigüedad.`;
  const link    = '/payment-orders';

  for (const user of recipients) {
    await createNotification({ userId: user.id, type: 'PENDING_ORDERS', title, message, link, entityId: 'global' });
  }

  const orderItems = orders.map((o) => ({
    id:          o.id,
    number:      o.number,
    concept:     o.concept,
    amount:      Number(o.amount),
    currency:    o.currency,
    daysAgo:     Math.floor((Date.now() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    projectCode: (o as any).project.code,
  }));

  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    for (const user of recipients) {
      await sendPendingOrdersEmail({
        toEmail: user.email, toName: user.name, orders: orderItems, appUrl: APP_URL,
      }).catch((err) => logger.error('[BusinessNotifications] Email error:', err));
    }
  }

  await sendWhatsApp(
    `⏳ *Control de Gastos — Órdenes pendientes*\n\n` +
    `${orders.length} orden${orders.length !== 1 ? 'es' : ''} de pago con +5 días sin pagar.\n\n` +
    `Ver: ${APP_URL}/payment-orders`,
  );

  logger.info(`[BusinessNotifications] Pending orders: ${orders.length} notified.`);
}

// ─── Check 3: Approved payrolls not paid ─────────────────────────────────────

async function checkApprovedPayrolls() {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const payrolls = await prisma.payroll.findMany({
    where: {
      status: 'APPROVED',
      approvedAt: { lte: threeDaysAgo },
    },
    include: { project: { select: { code: true, name: true } } },
    orderBy: { approvedAt: 'asc' },
  });

  if (payrolls.length === 0) {
    logger.info('[BusinessNotifications] Payroll check: no stale approved payrolls.');
    return;
  }

  const alreadySent = await recentNotificationExists('PAYROLL_UNPAID', 'global', 24);
  if (alreadySent) {
    logger.info('[BusinessNotifications] Payroll unpaid: notified in last 24h, skipping.');
    return;
  }

  const recipients = await getAdminSupervisorUsers();
  const title   = `${payrolls.length} nómina${payrolls.length !== 1 ? 's' : ''} aprobada${payrolls.length !== 1 ? 's' : ''} sin pagar`;
  const message = `Hay ${payrolls.length} nómina${payrolls.length !== 1 ? 's' : ''} aprobada${payrolls.length !== 1 ? 's' : ''} con más de 3 días sin ser pagada${payrolls.length !== 1 ? 's' : ''}.`;
  const link    = '/payrolls';

  for (const user of recipients) {
    await createNotification({ userId: user.id, type: 'PAYROLL_UNPAID', title, message, link, entityId: 'global' });
  }

  const payrollItems = payrolls.map((p) => ({
    id:          p.id,
    projectCode: (p as any).project.code,
    projectName: (p as any).project.name,
    number:      p.number,
    totalAmount: Number(p.totalAmount),
    approvedAt:  p.approvedAt!,
    daysAgo:     Math.floor((Date.now() - p.approvedAt!.getTime()) / (1000 * 60 * 60 * 24)),
  }));

  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    for (const user of recipients) {
      await sendApprovedPayrollsEmail({
        toEmail: user.email, toName: user.name, payrolls: payrollItems, appUrl: APP_URL,
      }).catch((err) => logger.error('[BusinessNotifications] Email error:', err));
    }
  }

  await sendWhatsApp(
    `🧾 *Control de Gastos — Nóminas sin pagar*\n\n` +
    `${payrolls.length} nómina${payrolls.length !== 1 ? 's' : ''} aprobada${payrolls.length !== 1 ? 's' : ''} con +3 días sin pagar.\n\n` +
    `Ver: ${APP_URL}/payrolls`,
  );

  logger.info(`[BusinessNotifications] Approved payrolls: ${payrolls.length} notified.`);
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export async function runBusinessNotifications() {
  logger.info('[BusinessNotifications] Iniciando revisión de alertas de negocio...');
  try {
    await checkBudgetThresholds();
    await checkPendingOrders();
    await checkApprovedPayrolls();
    logger.info('[BusinessNotifications] Revisión completada.');
  } catch (err) {
    logger.error('[BusinessNotifications] Error general:', err);
  }
}

// ─── Cron registration ────────────────────────────────────────────────────────

export function startBusinessNotificationJob() {
  // 12:00 PM UTC = 08:00 AM UTC-4 (República Dominicana)
  cron.schedule('0 12 * * *', async () => {
    logger.info('[BusinessNotifications] Ejecutando job diario...');
    await runBusinessNotifications();
  });
  logger.info('[BusinessNotifications] Job registrado: diario a las 08:00 AM hora RD.');
}
