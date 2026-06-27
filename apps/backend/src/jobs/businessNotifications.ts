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
import { getUpcomingPayments } from '../modules/service-subscriptions/service-subscriptions.service';
import { getMonthlySummary, getAlert } from '../modules/ai-usage/ai-usage.service';

const APP_URL = process.env.FRONTEND_URL ?? 'https://gastos-proyectos.onrender.com';

// ─── WhatsApp recipients: users with opt-in + external contacts ──────────────

async function getWhatsAppRecipients(type?: string): Promise<string[]> {
  const numbers: string[] = [];

  // 1. Users with whatsappOptIn and a phone number
  // Empty notifTypes = subscribed to all (backwards compatibility)
  const optedInUsers = await prisma.user.findMany({
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
  });
  for (const u of optedInUsers) {
    if (u.phone) numbers.push(normalizeWhatsApp(u.phone));
  }

  // 2. Active external contacts with a phone
  // Empty notifTypes = subscribed to all (backwards compatibility)
  const contacts = await prisma.notificationContact.findMany({
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
  });
  for (const c of contacts) {
    if (c.phone) numbers.push(normalizeWhatsApp(c.phone));
  }

  // Also include fallback env var if no DB recipients (backwards compatibility)
  if (numbers.length === 0 && env.NOTIFY_WHATSAPP_TO) {
    env.NOTIFY_WHATSAPP_TO.split(',').map((s) => s.trim()).filter(Boolean).forEach((n) => numbers.push(n));
  }

  return [...new Set(numbers)]; // deduplicate
}

function normalizeWhatsApp(phone: string): string {
  const clean = phone.replace(/[\s\-(). ]/g, '');
  // Strip "whatsapp:" prefix — UltraMsg uses plain numbers
  const withoutPrefix = clean.startsWith('whatsapp:') ? clean.slice(9) : clean;
  return withoutPrefix.startsWith('+') ? withoutPrefix : `+${withoutPrefix}`;
}

// ─── WhatsApp sender (UltraMsg, graceful no-op if not configured) ─────────────

async function sendWhatsApp(message: string, type?: string): Promise<void> {
  if (!env.ULTRAMSG_INSTANCE_ID || !env.ULTRAMSG_TOKEN) return;
  const recipients = await getWhatsAppRecipients(type);
  if (recipients.length === 0) return;

  for (const to of recipients) {
    try {
      const resp = await fetch(
        `https://api.ultramsg.com/${env.ULTRAMSG_INSTANCE_ID}/messages/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: env.ULTRAMSG_TOKEN, to, body: message }),
        },
      );
      if (!resp.ok) {
        const err = await resp.text();
        logger.error('[BusinessNotifications] UltraMsg error:', err);
      }
    } catch (err) {
      logger.error('[BusinessNotifications] Error enviando WhatsApp:', err);
    }
  }
}

// ─── Email recipients: admin/supervisor + external contacts with email ────────

async function getAllEmailRecipients(type?: string) {
  const [users, contacts] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: { in: ['admin', 'supervisor'] } },
        ...(type ? {
          OR: [
            { notifTypes: { isEmpty: true } },
            { notifTypes: { has: type } },
          ],
        } : {}),
      },
      select: { id: true, name: true, email: true },
    }),
    prisma.notificationContact.findMany({
      where: {
        isActive: true,
        email: { not: null },
        ...(type ? {
          OR: [
            { notifTypes: { isEmpty: true } },
            { notifTypes: { has: type } },
          ],
        } : {}),
      },
      select: { name: true, email: true },
    }),
  ]);

  const emailRecipients: { name: string; email: string }[] = [
    ...users,
    ...contacts.filter((c) => c.email).map((c) => ({ name: c.name, email: c.email! })),
  ];
  return { userRecipients: users, emailRecipients };
}

// ─── Admin/Supervisor for in-app notifications ────────────────────────────────

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

  const { userRecipients, emailRecipients } = await getAllEmailRecipients('BUDGET');
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

      for (const user of userRecipients) {
        await createNotification({ userId: user.id, type, title, message, link, entityId });
      }

      if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
        for (const rec of emailRecipients) {
          await sendBudgetAlertEmail({
            toEmail: rec.email, toName: rec.name,
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
        'BUDGET',
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

  const { userRecipients, emailRecipients } = await getAllEmailRecipients('ORDERS');
  const title   = `${orders.length} orden${orders.length !== 1 ? 'es' : ''} de pago pendiente${orders.length !== 1 ? 's' : ''}`;
  const message = `Hay ${orders.length} orden${orders.length !== 1 ? 'es' : ''} de pago sin pagar con más de 5 días de antigüedad.`;
  const link    = '/payment-orders';

  for (const user of userRecipients) {
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
    for (const rec of emailRecipients) {
      await sendPendingOrdersEmail({
        toEmail: rec.email, toName: rec.name, orders: orderItems, appUrl: APP_URL,
      }).catch((err) => logger.error('[BusinessNotifications] Email error:', err));
    }
  }

  await sendWhatsApp(
    `⏳ *Control de Gastos — Órdenes pendientes*\n\n` +
    `${orders.length} orden${orders.length !== 1 ? 'es' : ''} de pago con +5 días sin pagar.\n\n` +
    `Ver: ${APP_URL}/payment-orders`,
    'ORDERS',
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

  const { userRecipients, emailRecipients } = await getAllEmailRecipients('PAYROLL');
  const title   = `${payrolls.length} nómina${payrolls.length !== 1 ? 's' : ''} aprobada${payrolls.length !== 1 ? 's' : ''} sin pagar`;
  const message = `Hay ${payrolls.length} nómina${payrolls.length !== 1 ? 's' : ''} aprobada${payrolls.length !== 1 ? 's' : ''} con más de 3 días sin ser pagada${payrolls.length !== 1 ? 's' : ''}.`;
  const link    = '/payrolls';

  for (const user of userRecipients) {
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
    for (const rec of emailRecipients) {
      await sendApprovedPayrollsEmail({
        toEmail: rec.email, toName: rec.name, payrolls: payrollItems, appUrl: APP_URL,
      }).catch((err) => logger.error('[BusinessNotifications] Email error:', err));
    }
  }

  await sendWhatsApp(
    `🧾 *Control de Gastos — Nóminas sin pagar*\n\n` +
    `${payrolls.length} nómina${payrolls.length !== 1 ? 's' : ''} aprobada${payrolls.length !== 1 ? 's' : ''} con +3 días sin pagar.\n\n` +
    `Ver: ${APP_URL}/payrolls`,
    'PAYROLL',
  );

  logger.info(`[BusinessNotifications] Approved payrolls: ${payrolls.length} notified.`);
}

// ─── Check 4: Upcoming service subscription payments ─────────────────────────

async function checkServicePayments() {
  const upcoming = await getUpcomingPayments(7);

  if (upcoming.length === 0) {
    logger.info('[BusinessNotifications] Service payments check: no upcoming payments in 7 days.');
    return;
  }

  const adminUsers = await prisma.user.findMany({
    where: { isActive: true, role: { name: 'admin' } },
    select: { id: true },
  });

  let alertCount = 0;

  for (const sub of upcoming) {
    const alreadySent = await recentNotificationExists('SERVICE_PAYMENT', sub.id, 24);
    if (alreadySent) continue;

    const daysUntil = sub.daysUntil;
    const title   = `Pago próximo: ${sub.name}`;
    const message = `${sub.provider} — $${sub.monthlyCost} ${sub.currency} vence el día ${sub.billingDay} (${daysUntil} día${daysUntil !== 1 ? 's' : ''})`;
    const link    = '/monitoring';

    for (const user of adminUsers) {
      await createNotification({
        userId:   user.id,
        type:     'SERVICE_PAYMENT',
        title,
        message,
        link,
        entityId: sub.id,
      });
    }

    alertCount++;
    logger.info(`[BusinessNotifications] Service payment alert: ${sub.name} (${sub.provider}) in ${daysUntil}d`);
  }

  if (alertCount === 0) {
    logger.info('[BusinessNotifications] Service payments check: no new alerts (all recently notified).');
  } else {
    logger.info(`[BusinessNotifications] Service payments: ${alertCount} alert(s) sent.`);
  }
}

// ─── Check 5: Monthly AI cost alert ──────────────────────────────────────────

async function checkAiCostAlert(): Promise<void> {
  try {
    const alertConfig = await getAlert();
    if (!alertConfig || !alertConfig.enabled) return;

    const month   = new Date().toISOString().slice(0, 7);
    const summary = await getMonthlySummary(month);

    if (summary.estimatedCostUsd >= alertConfig.monthlyLimitUsd) {
      const pct     = ((summary.estimatedCostUsd / alertConfig.monthlyLimitUsd) * 100).toFixed(0);
      const message = `⚠️ *ALERTA CONSUMO IA* — JHOTA Construcciones\n\nEl costo estimado de Claude API en ${month} es *$${summary.estimatedCostUsd.toFixed(4)} USD* (${pct}% del límite de $${alertConfig.monthlyLimitUsd} USD).\n\nTokens de entrada: ${summary.totalInputTokens.toLocaleString()}\nTokens de salida: ${summary.totalOutputTokens.toLocaleString()}\nLlamadas totales: ${summary.totalCalls}`;
      await sendWhatsApp(message, 'SYSTEM');
    }
  } catch (err) {
    logger.error('[BusinessNotifications] Error checking AI cost alert:', err);
  }
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export async function runBusinessNotifications() {
  logger.info('[BusinessNotifications] Iniciando revisión de alertas de negocio...');
  try {
    await checkBudgetThresholds();
    await checkPendingOrders();
    await checkApprovedPayrolls();
    await checkServicePayments();
    await checkAiCostAlert();
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
