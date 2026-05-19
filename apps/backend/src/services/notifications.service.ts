/**
 * Servicio de Notificaciones — Email + WhatsApp
 * SERVINGMI Sistema de Gastos por Proyectos
 *
 * Canales soportados:
 *   - Email: nodemailer (SMTP / Gmail / SendGrid)
 *   - WhatsApp: Twilio WhatsApp API
 */

import nodemailer from 'nodemailer';

// ─── Configuración desde env ──────────────────────────────────
const EMAIL_FROM    = process.env.NOTIFY_EMAIL_FROM    ?? '';
const EMAIL_TO      = process.env.NOTIFY_EMAIL_TO      ?? '';  // comma-separated
const SMTP_HOST     = process.env.SMTP_HOST            ?? 'smtp.gmail.com';
const SMTP_PORT     = parseInt(process.env.SMTP_PORT   ?? '465');
const SMTP_USER     = process.env.SMTP_USER            ?? '';
const SMTP_PASS     = process.env.SMTP_PASS            ?? '';

const TWILIO_SID    = process.env.TWILIO_ACCOUNT_SID   ?? '';
const TWILIO_TOKEN  = process.env.TWILIO_AUTH_TOKEN    ?? '';
const TWILIO_FROM   = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886'; // Twilio sandbox default
const WHATSAPP_TO   = process.env.NOTIFY_WHATSAPP_TO   ?? '';  // comma-separated e.g. "whatsapp:+18095551234"

const APP_NAME      = 'SERVINGMI — Gastos';
const APP_URL       = process.env.APP_URL ?? 'http://localhost:3001';

// ─── Email transporter (lazy init) ───────────────────────────
let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return _transporter;
}

// ─── HTML templates ──────────────────────────────────────────
function alertHtml(title: string, body: string, level: 'error' | 'warn' | 'info' = 'info'): string {
  const colors = {
    error: { bg: '#FEE2E2', border: '#EF4444', badge: '#DC2626', text: '#991B1B' },
    warn:  { bg: '#FEF3C7', border: '#F59E0B', badge: '#D97706', text: '#92400E' },
    info:  { bg: '#DBEAFE', border: '#3B82F6', badge: '#2563EB', text: '#1E40AF' },
  };
  const c = colors[level];
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr><td style="background:#1C1C1C;padding:20px 32px;text-align:center">
          <span style="color:#F5C218;font-size:20px;font-weight:bold">${APP_NAME}</span>
          <span style="color:#888;font-size:13px;margin-left:12px">Sistema de Monitoreo</span>
        </td></tr>
        <!-- Alert badge -->
        <tr><td style="background:${c.bg};border-left:4px solid ${c.border};padding:16px 32px">
          <span style="background:${c.badge};color:#fff;font-size:11px;font-weight:bold;padding:3px 10px;border-radius:20px;text-transform:uppercase">${level === 'error' ? '🔴 Error crítico' : level === 'warn' ? '🟡 Advertencia' : '🔵 Información'}</span>
          <h2 style="margin:10px 0 4px;color:${c.text};font-size:18px">${title}</h2>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:24px 32px;font-size:14px;color:#374151;line-height:1.6">${body}</td></tr>
        <!-- Footer -->
        <tr><td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;font-size:12px;color:#9CA3AF;text-align:center">
          ${new Date().toLocaleString('es-DO')} &nbsp;|&nbsp;
          <a href="${APP_URL}" style="color:#6B7280">Abrir aplicación</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function reportHtml(title: string, sections: { heading: string; rows: [string, string][] }[]): string {
  const sectionHtml = sections.map(s => `
    <tr><td style="padding:20px 32px 8px">
      <h3 style="margin:0 0 10px;font-size:15px;color:#1C1C1C;border-bottom:2px solid #F5C218;padding-bottom:6px">${s.heading}</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${s.rows.map(([label, val], i) => `
          <tr style="background:${i % 2 ? '#F9FAFB' : '#fff'}">
            <td style="padding:7px 10px;font-size:13px;font-weight:bold;color:#6B7280;width:45%">${label}</td>
            <td style="padding:7px 10px;font-size:13px;color:#111827">${val}</td>
          </tr>`).join('')}
      </table>
    </td></tr>`).join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:#1C1C1C;padding:20px 32px;text-align:center">
          <span style="color:#F5C218;font-size:20px;font-weight:bold">${APP_NAME}</span>
        </td></tr>
        <tr><td style="padding:20px 32px 0;font-size:22px;font-weight:bold;color:#1C1C1C">${title}</td></tr>
        <tr><td style="padding:4px 32px 0;font-size:13px;color:#9CA3AF">${new Date().toLocaleString('es-DO')}</td></tr>
        ${sectionHtml}
        <tr><td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;font-size:12px;color:#9CA3AF;text-align:center">
          <a href="${APP_URL}" style="color:#6B7280">Abrir aplicación</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Email sender ─────────────────────────────────────────────
async function sendEmail(subject: string, html: string): Promise<void> {
  if (!SMTP_USER || !EMAIL_TO) return;
  const recipients = EMAIL_TO.split(',').map(s => s.trim()).filter(Boolean);
  if (recipients.length === 0) return;

  try {
    await getTransporter().sendMail({
      from: `"${APP_NAME}" <${EMAIL_FROM || SMTP_USER}>`,
      to:   recipients.join(', '),
      subject,
      html,
    });
  } catch (err) {
    console.error('[Notifications] Error enviando email:', err);
  }
}

// ─── WhatsApp sender via Twilio ───────────────────────────────
async function sendWhatsApp(message: string): Promise<void> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !WHATSAPP_TO) return;
  const recipients = WHATSAPP_TO.split(',').map(s => s.trim()).filter(Boolean);

  for (const to of recipients) {
    try {
      const body = new URLSearchParams({
        From: TWILIO_FROM,
        To:   to,
        Body: message,
      });
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method:  'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
          },
          body: body.toString(),
        }
      );
      if (!resp.ok) {
        const err = await resp.text();
        console.error('[Notifications] Twilio error:', err);
      }
    } catch (err) {
      console.error('[Notifications] Error enviando WhatsApp:', err);
    }
  }
}

// ─── Public notification functions ───────────────────────────

/**
 * Alerta cuando el servidor o la BD dejan de responder correctamente.
 */
export async function notifySystemDown(details: {
  status: string;
  dbOk: boolean;
  memoryUsedPct: number;
  message: string;
}): Promise<void> {
  const title   = `🔴 Sistema CAÍDO — ${APP_NAME}`;
  const bodyHtml = `
    <p>Se detectó una falla en el sistema:</p>
    <ul style="font-size:14px;color:#374151;line-height:2">
      <li><strong>Estado:</strong> ${details.status.toUpperCase()}</li>
      <li><strong>Base de datos:</strong> ${details.dbOk ? '✅ OK' : '❌ SIN CONEXIÓN'}</li>
      <li><strong>Uso de memoria:</strong> ${details.memoryUsedPct.toFixed(1)}%</li>
      <li><strong>Detalle:</strong> ${details.message}</li>
    </ul>
    <p style="margin-top:16px"><a href="${APP_URL}" style="background:#DC2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Ver aplicación</a></p>
  `;
  const waMsg = `🔴 *${APP_NAME} — ALERTA CRÍTICA*\n\nEstado: ${details.status.toUpperCase()}\nBase de datos: ${details.dbOk ? '✅ OK' : '❌ CAÍDA'}\nMemoria: ${details.memoryUsedPct.toFixed(1)}%\n\nDetalle: ${details.message}\n\n${APP_URL}`;

  await Promise.all([
    sendEmail(title, alertHtml('Sistema con falla detectada', bodyHtml, 'error')),
    sendWhatsApp(waMsg),
  ]);
}

/**
 * Alerta cuando el sistema vuelve a estar saludable después de una falla.
 */
export async function notifySystemRecovered(): Promise<void> {
  const title   = `✅ Sistema RECUPERADO — ${APP_NAME}`;
  const bodyHtml = `<p>El sistema ha vuelto a funcionar correctamente.</p>
    <p>Todos los servicios están operando con normalidad.</p>`;
  const waMsg = `✅ *${APP_NAME} — RECUPERADO*\n\nEl sistema ha vuelto a funcionar correctamente.\n\n${APP_URL}`;

  await Promise.all([
    sendEmail(title, alertHtml('Sistema recuperado', bodyHtml, 'info')),
    sendWhatsApp(waMsg),
  ]);
}

/**
 * Alerta de alta tasa de errores en la API.
 */
export async function notifyHighErrorRate(count: number, windowMinutes: number): Promise<void> {
  const title   = `⚠️ Alta tasa de errores — ${APP_NAME}`;
  const bodyHtml = `
    <p>Se detectaron <strong>${count} errores</strong> en los últimos <strong>${windowMinutes} minutos</strong>.</p>
    <p>Revise los logs del sistema para identificar la causa.</p>
    <p><a href="${APP_URL}" style="color:#2563EB">Abrir dashboard de monitoreo</a></p>`;
  const waMsg = `⚠️ *${APP_NAME} — ERRORES FRECUENTES*\n\n${count} errores en los últimos ${windowMinutes} min.\nRevisa el dashboard.\n\n${APP_URL}`;

  await Promise.all([
    sendEmail(title, alertHtml(`${count} errores detectados`, bodyHtml, 'warn')),
    sendWhatsApp(waMsg),
  ]);
}

/**
 * Reporte diario del sistema.
 */
export async function sendDailyReport(stats: {
  totalRequests:  number;
  errorCount:     number;
  avgResponseMs:  number;
  uptimeHours:    number;
  dbStatus:       string;
  activeUsers?:   number;
  topEndpoints?:  { endpoint: string; count: number }[];
}): Promise<void> {
  const today = new Date().toLocaleDateString('es-DO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const html  = reportHtml(`📊 Reporte Diario — ${today}`, [
    {
      heading: 'Estado del Sistema',
      rows: [
        ['Uptime',           `${stats.uptimeHours.toFixed(1)} horas`],
        ['Base de datos',    stats.dbStatus],
        ['Solicitudes hoy',  stats.totalRequests.toLocaleString('es-DO')],
        ['Errores hoy',      `${stats.errorCount} ${stats.errorCount > 10 ? '⚠️' : '✅'}`],
        ['Resp. promedio',   `${stats.avgResponseMs.toFixed(0)} ms`],
        ...(stats.activeUsers != null ? [['Usuarios activos', String(stats.activeUsers)] as [string, string]] : []),
      ],
    },
    ...(stats.topEndpoints?.length ? [{
      heading: 'Endpoints más usados',
      rows: stats.topEndpoints.slice(0, 5).map(e => [e.endpoint, `${e.count} llamadas`] as [string, string]),
    }] : []),
  ]);

  const waMsg = `📊 *${APP_NAME} — Reporte Diario*\n\n📅 ${today}\n\n🟢 Uptime: ${stats.uptimeHours.toFixed(1)}h\n📨 Requests: ${stats.totalRequests}\n❌ Errores: ${stats.errorCount}\n⚡ Resp. avg: ${stats.avgResponseMs.toFixed(0)}ms\n\n${APP_URL}`;

  await Promise.all([
    sendEmail(`📊 Reporte Diario — ${APP_NAME}`, html),
    sendWhatsApp(waMsg),
  ]);
}

/**
 * Reporte semanal.
 */
export async function sendWeeklyReport(stats: {
  weekLabel:      string;
  totalRequests:  number;
  errorCount:     number;
  avgUptime:      number;
  totalPayrolls?: number;
  totalExpenses?: number;
}): Promise<void> {
  const html = reportHtml(`📈 Reporte Semanal — ${stats.weekLabel}`, [
    {
      heading: 'Resumen de la Semana',
      rows: [
        ['Solicitudes totales', stats.totalRequests.toLocaleString('es-DO')],
        ['Errores totales',     `${stats.errorCount} ${stats.errorCount > 50 ? '⚠️' : '✅'}`],
        ['Disponibilidad avg',  `${stats.avgUptime.toFixed(2)}%`],
        ...(stats.totalPayrolls != null ? [['Nóminas procesadas', String(stats.totalPayrolls)] as [string, string]] : []),
        ...(stats.totalExpenses != null ? [['Gastos registrados', String(stats.totalExpenses)] as [string, string]] : []),
      ],
    },
  ]);

  const waMsg = `📈 *${APP_NAME} — Reporte Semanal*\n\n📅 ${stats.weekLabel}\n\n📨 Requests: ${stats.totalRequests}\n❌ Errores: ${stats.errorCount}\n✅ Uptime: ${stats.avgUptime.toFixed(2)}%\n\n${APP_URL}`;

  await Promise.all([
    sendEmail(`📈 Reporte Semanal — ${APP_NAME}`, html),
    sendWhatsApp(waMsg),
  ]);
}

export { sendEmail, sendWhatsApp };
