import nodemailer from 'nodemailer';
import { env } from '../config/env';

// ─── Transporter ─────────────────────────────────────────────────────────────

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.GMAIL_USER,
        pass: env.GMAIL_APP_PASSWORD,
      },
      connectionTimeout: 10_000,  // 10 segundos para conectar
      greetingTimeout:   10_000,  // 10 segundos para saludo SMTP
      socketTimeout:     15_000,  // 15 segundos de inactividad
    });
  }
  return transporter;
}

// ─── Template base ────────────────────────────────────────────────────────────

function baseTemplate(content: string) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Control de Gastos</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo / Header -->
          <tr>
            <td style="background:#2563EB;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:rgba(255,255,255,0.2);border-radius:8px;padding:8px 12px;">
                    <span style="color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:-0.5px;">
                      💼 Control de Gastos
                    </span>
                  </td>
                </tr>
              </table>
              <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:10px 0 0 0;">
                Sistema de Gestión por Proyectos
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#FFFFFF;padding:32px;border-radius:0 0 12px 12px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0;text-align:center;">
              <p style="color:#9CA3AF;font-size:12px;margin:0;">
                Si no esperabas este correo puedes ignorarlo con seguridad.<br/>
                © ${new Date().getFullYear()} Control de Gastos — Sistema privado
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Email: Invitación de usuario ─────────────────────────────────────────────

export async function sendInvitationEmail(opts: {
  toEmail:      string;
  invitedByName: string;
  roleName:     string;
  inviteUrl:    string;
  expiresHours: number;
}) {
  const roleLabel: Record<string, string> = {
    admin:      'Administrador',
    supervisor: 'Supervisor',
    operator:   'Operador',
  };

  const content = `
    <h2 style="color:#1F2937;font-size:22px;font-weight:700;margin:0 0 8px 0;">
      Te han invitado al sistema
    </h2>
    <p style="color:#6B7280;font-size:14px;margin:0 0 24px 0;">
      <strong style="color:#1F2937;">${opts.invitedByName}</strong> te invitó a unirte como
      <strong style="color:#2563EB;">${roleLabel[opts.roleName] ?? opts.roleName}</strong>.
    </p>

    <!-- Info box -->
    <table cellpadding="0" cellspacing="0" width="100%"
           style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="color:#1E40AF;font-size:13px;margin:0 0 6px 0;font-weight:600;">
            📋 Tu acceso
          </p>
          <p style="color:#1D4ED8;font-size:13px;margin:0;">
            Correo: <strong>${opts.toEmail}</strong><br/>
            Rol: <strong>${roleLabel[opts.roleName] ?? opts.roleName}</strong>
          </p>
        </td>
      </tr>
    </table>

    <p style="color:#374151;font-size:14px;margin:0 0 20px 0;">
      Haz clic en el botón para crear tu contraseña y activar tu cuenta.
      Este enlace expira en <strong>${opts.expiresHours} horas</strong>.
    </p>

    <!-- CTA Button -->
    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
      <tr>
        <td style="background:#2563EB;border-radius:8px;">
          <a href="${opts.inviteUrl}"
             style="display:inline-block;padding:14px 32px;color:#FFFFFF;font-size:15px;
                    font-weight:600;text-decoration:none;border-radius:8px;">
            Activar mi cuenta →
          </a>
        </td>
      </tr>
    </table>

    <p style="color:#9CA3AF;font-size:12px;margin:0;">
      O copia este enlace en tu navegador:<br/>
      <span style="color:#2563EB;word-break:break-all;">${opts.inviteUrl}</span>
    </p>`;

  await getTransporter().sendMail({
    from:    `"Control de Gastos" <${env.GMAIL_USER}>`,
    to:      opts.toEmail,
    subject: `Invitación al Sistema de Control de Gastos`,
    html:    baseTemplate(content),
  });
}

// ─── Email: Bienvenida (al aceptar invitación) ────────────────────────────────

export async function sendWelcomeEmail(opts: {
  toEmail:  string;
  name:     string;
  loginUrl: string;
}) {
  const content = `
    <h2 style="color:#1F2937;font-size:22px;font-weight:700;margin:0 0 8px 0;">
      ¡Bienvenido, ${opts.name}! 🎉
    </h2>
    <p style="color:#6B7280;font-size:14px;margin:0 0 24px 0;">
      Tu cuenta ha sido activada exitosamente. Ya puedes acceder al sistema.
    </p>

    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
      <tr>
        <td style="background:#2563EB;border-radius:8px;">
          <a href="${opts.loginUrl}"
             style="display:inline-block;padding:14px 32px;color:#FFFFFF;font-size:15px;
                    font-weight:600;text-decoration:none;border-radius:8px;">
            Ir al sistema →
          </a>
        </td>
      </tr>
    </table>

    <p style="color:#9CA3AF;font-size:12px;margin:0;">
      Guarda bien tu contraseña. Si la olvidas, contacta al administrador.
    </p>`;

  await getTransporter().sendMail({
    from:    `"Control de Gastos" <${env.GMAIL_USER}>`,
    to:      opts.toEmail,
    subject: `Bienvenido al Sistema de Control de Gastos`,
    html:    baseTemplate(content),
  });
}


// ─── Email: Alerta de cotizaciones próximas a vencer ─────────────────────────

export interface ExpiringQuotationItem {
  id:              string;
  supplierName:    string;
  quotationNumber: string | null;
  projectCode:     string;
  projectName:     string;
  total:           number;
  currency:        string;
  validUntil:      Date;
  daysLeft:        number;
}

export async function sendQuotationExpiringEmail(opts: {
  toEmail:     string;
  toName:      string;
  quotations:  ExpiringQuotationItem[];
  appUrl:      string;
}) {
  const fmt = (n: number, currency = 'DOP') =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency, minimumFractionDigits: 0 }).format(n);

  const rows = opts.quotations.map((q) => {
    const urgency = q.daysLeft === 0
      ? { color: '#DC2626', label: 'Vence hoy', bg: '#FEF2F2' }
      : q.daysLeft === 1
      ? { color: '#EA580C', label: 'Vence manana', bg: '#FFF7ED' }
      : { color: '#D97706', label: `${q.daysLeft} dias`, bg: '#FFFBEB' };

    const numLabel = q.quotationNumber ? ` #${q.quotationNumber}` : '';
    return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #F3F4F6;vertical-align:top;">
          <p style="margin:0 0 2px 0;font-size:14px;font-weight:600;color:#1F2937;">
            ${q.supplierName}<span style="font-size:12px;color:#6B7280;font-weight:400;">${numLabel}</span>
          </p>
          <p style="margin:0;font-size:12px;color:#6B7280;">${q.projectCode} - ${q.projectName}</p>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #F3F4F6;text-align:right;vertical-align:top;">
          <p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:#1F2937;">${fmt(q.total, q.currency)}</p>
          <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${urgency.bg};color:${urgency.color};">${urgency.label}</span>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #F3F4F6;text-align:right;vertical-align:top;">
          <a href="${opts.appUrl}/quotations/${q.id}" style="font-size:12px;color:#2563EB;text-decoration:none;font-weight:500;">Ver</a>
        </td>
      </tr>`;
  }).join('');

  const todayCount    = opts.quotations.filter((q) => q.daysLeft === 0).length;
  const tomorrowCount = opts.quotations.filter((q) => q.daysLeft === 1).length;
  const laterCount    = opts.quotations.filter((q) => q.daysLeft > 1).length;

  const summaryParts: string[] = [];
  if (todayCount > 0)    summaryParts.push(`<strong style="color:#DC2626;">${todayCount} vence${todayCount > 1 ? 'n' : ''} hoy</strong>`);
  if (tomorrowCount > 0) summaryParts.push(`<strong style="color:#EA580C;">${tomorrowCount} vence${tomorrowCount > 1 ? 'n' : ''} manana</strong>`);
  if (laterCount > 0)    summaryParts.push(`<strong style="color:#D97706;">${laterCount} en los proximos dias</strong>`);
  const summaryItems = summaryParts.join(' - ');

  const count = opts.quotations.length;
  const content = `
    <h2 style="color:#1F2937;font-size:20px;font-weight:700;margin:0 0 6px 0;">
      Cotizaciones proximas a vencer
    </h2>
    <p style="color:#6B7280;font-size:14px;margin:0 0 20px 0;">
      Hola, <strong style="color:#1F2937;">${opts.toName}</strong>.
      Tienes ${count} cotizacion${count > 1 ? 'es' : ''} abiertas que requieren atencion: ${summaryItems}
    </p>

    <table cellpadding="0" cellspacing="0" width="100%"
           style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <thead>
        <tr style="background:#F9FAFB;">
          <th style="padding:10px 16px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">COTIZACION</th>
          <th style="padding:10px 16px;text-align:right;font-size:12px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB;">TOTAL / VENCE</th>
          <th style="padding:10px 16px;border-bottom:1px solid #E5E7EB;">&nbsp;</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <table cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
      <tr>
        <td style="background:#2563EB;border-radius:8px;">
          <a href="${opts.appUrl}/quotations"
             style="display:inline-block;padding:12px 28px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
            Ver cotizaciones
          </a>
        </td>
      </tr>
    </table>

    <p style="color:#9CA3AF;font-size:12px;margin:0;">
      Este recordatorio se envia automaticamente cada dia a las 8:00 AM.<br/>
      Solo se notifican cotizaciones en estado abierto.
    </p>`;

  const plural = count > 1 ? 'es' : '';
  await getTransporter().sendMail({
    from:    `"Control de Gastos" <${env.GMAIL_USER}>`,
    to:      opts.toEmail,
    subject: `${count} cotizacion${plural} proxima${plural} a vencer - Control de Gastos`,
    html:    baseTemplate(content),
  });
}

// ─── Email: Alerta de presupuesto ─────────────────────────────────────────────

export async function sendBudgetAlertEmail(opts: {
  toEmail:    string;
  toName:     string;
  projectCode: string;
  projectName: string;
  projectId:  string;
  pct:        number;  // 80 or 90
  spent:      number;
  budget:     number;
  appUrl:     string;
}) {
  const fmtDOP = (n: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);

  const level   = opts.pct >= 90 ? 'error' : 'warn';
  const emoji   = opts.pct >= 90 ? '🔴' : '🟡';
  const remaining = opts.budget - opts.spent;

  const content = `
    <h2 style="color:#1F2937;font-size:20px;font-weight:700;margin:0 0 8px 0;">
      ${emoji} Alerta de presupuesto — ${opts.pct}% consumido
    </h2>
    <p style="color:#6B7280;font-size:14px;margin:0 0 20px 0;">
      Hola, <strong style="color:#1F2937;">${opts.toName}</strong>.
      El proyecto <strong style="color:#1F2937;">${opts.projectCode}</strong> ha consumido el
      <strong style="color:${level === 'error' ? '#DC2626' : '#D97706'};">${opts.pct}%</strong> de su presupuesto.
    </p>

    <table cellpadding="0" cellspacing="0" width="100%"
           style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#1F2937;">${opts.projectName}</p>
          <p style="margin:0 0 4px;font-size:13px;color:#6B7280;">
            Presupuesto total: <strong style="color:#1F2937;">${fmtDOP(opts.budget)}</strong>
          </p>
          <p style="margin:0 0 4px;font-size:13px;color:#6B7280;">
            Gastado hasta hoy: <strong style="color:${level === 'error' ? '#DC2626' : '#D97706'};">${fmtDOP(opts.spent)}</strong>
          </p>
          <p style="margin:0;font-size:13px;color:#6B7280;">
            Disponible: <strong style="color:#059669;">${fmtDOP(remaining)}</strong>
          </p>
        </td>
      </tr>
    </table>

    <table cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
      <tr>
        <td style="background:#2563EB;border-radius:8px;">
          <a href="${opts.appUrl}/projects/${opts.projectId}/financial"
             style="display:inline-block;padding:12px 28px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
            Ver estado financiero del proyecto
          </a>
        </td>
      </tr>
    </table>`;

  await getTransporter().sendMail({
    from:    `"Control de Gastos" <${env.GMAIL_USER}>`,
    to:      opts.toEmail,
    subject: `${emoji} Proyecto ${opts.projectCode} al ${opts.pct}% del presupuesto - Control de Gastos`,
    html:    baseTemplate(content),
  });
}

// ─── Email: Órdenes de pago pendientes ────────────────────────────────────────

export async function sendPendingOrdersEmail(opts: {
  toEmail: string;
  toName:  string;
  orders:  Array<{
    id:        string;
    number:    number;
    concept:   string;
    amount:    number;
    currency:  string;
    daysAgo:   number;
    projectCode: string;
  }>;
  appUrl: string;
}) {
  const fmtDOP = (n: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);

  const rows = opts.orders.map((o, i) => `
    <tr style="background:${i % 2 ? '#F9FAFB' : '#fff'}">
      <td style="padding:10px 14px;font-size:13px;color:#1F2937;font-family:monospace">OP-${String(o.number).padStart(4,'0')}</td>
      <td style="padding:10px 14px;font-size:13px;color:#374151">${o.concept.slice(0,50)}${o.concept.length > 50 ? '...' : ''}</td>
      <td style="padding:10px 14px;font-size:13px;color:#374151">${o.projectCode}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#1F2937;text-align:right">${fmtDOP(o.amount)}</td>
      <td style="padding:10px 14px;font-size:12px;text-align:center">
        <span style="background:#FEF3C7;color:#D97706;padding:2px 8px;border-radius:999px;font-weight:600">${o.daysAgo} días</span>
      </td>
    </tr>`).join('');

  const count = opts.orders.length;
  const content = `
    <h2 style="color:#1F2937;font-size:20px;font-weight:700;margin:0 0 8px 0;">
      ⏳ Órdenes de pago pendientes
    </h2>
    <p style="color:#6B7280;font-size:14px;margin:0 0 20px 0;">
      Hola, <strong style="color:#1F2937;">${opts.toName}</strong>.
      Tienes <strong>${count}</strong> orden${count !== 1 ? 'es' : ''} de pago con más de 5 días sin ser pagada${count !== 1 ? 's' : ''}.
    </p>

    <table cellpadding="0" cellspacing="0" width="100%"
           style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <thead>
        <tr style="background:#F3F4F6">
          <th style="padding:9px 14px;text-align:left;font-size:11px;color:#6B7280;font-weight:700;border-bottom:1px solid #E5E7EB">No.</th>
          <th style="padding:9px 14px;text-align:left;font-size:11px;color:#6B7280;font-weight:700;border-bottom:1px solid #E5E7EB">Concepto</th>
          <th style="padding:9px 14px;text-align:left;font-size:11px;color:#6B7280;font-weight:700;border-bottom:1px solid #E5E7EB">Proyecto</th>
          <th style="padding:9px 14px;text-align:right;font-size:11px;color:#6B7280;font-weight:700;border-bottom:1px solid #E5E7EB">Monto</th>
          <th style="padding:9px 14px;text-align:center;font-size:11px;color:#6B7280;font-weight:700;border-bottom:1px solid #E5E7EB">Antigüedad</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <table cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
      <tr>
        <td style="background:#2563EB;border-radius:8px;">
          <a href="${opts.appUrl}/payment-orders"
             style="display:inline-block;padding:12px 28px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
            Ver órdenes de pago
          </a>
        </td>
      </tr>
    </table>`;

  await getTransporter().sendMail({
    from:    `"Control de Gastos" <${env.GMAIL_USER}>`,
    to:      opts.toEmail,
    subject: `⏳ ${count} orden${count !== 1 ? 'es' : ''} de pago pendiente${count !== 1 ? 's' : ''} - Control de Gastos`,
    html:    baseTemplate(content),
  });
}

// ─── Email: Nóminas aprobadas sin pagar ──────────────────────────────────────

export async function sendApprovedPayrollsEmail(opts: {
  toEmail:  string;
  toName:   string;
  payrolls: Array<{
    id:          string;
    projectCode: string;
    projectName: string;
    number:      number;
    totalAmount: number;
    approvedAt:  Date;
    daysAgo:     number;
  }>;
  appUrl: string;
}) {
  const fmtDOP = (n: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0 }).format(n);

  const rows = opts.payrolls.map((p, i) => `
    <tr style="background:${i % 2 ? '#F9FAFB' : '#fff'}">
      <td style="padding:10px 14px;font-size:13px;color:#1F2937;font-family:monospace">NOM-${String(p.number).padStart(3,'0')}</td>
      <td style="padding:10px 14px;font-size:13px;color:#374151">${p.projectCode} — ${p.projectName}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#1F2937;text-align:right">${fmtDOP(p.totalAmount)}</td>
      <td style="padding:10px 14px;font-size:12px;text-align:center">
        <span style="background:#FEE2E2;color:#DC2626;padding:2px 8px;border-radius:999px;font-weight:600">${p.daysAgo} días</span>
      </td>
    </tr>`).join('');

  const count = opts.payrolls.length;
  const content = `
    <h2 style="color:#1F2937;font-size:20px;font-weight:700;margin:0 0 8px 0;">
      🧾 Nóminas aprobadas sin pagar
    </h2>
    <p style="color:#6B7280;font-size:14px;margin:0 0 20px 0;">
      Hola, <strong style="color:#1F2937;">${opts.toName}</strong>.
      Tienes <strong>${count}</strong> nómina${count !== 1 ? 's' : ''} aprobada${count !== 1 ? 's' : ''} con más de 3 días sin ser pagada${count !== 1 ? 's' : ''}.
    </p>

    <table cellpadding="0" cellspacing="0" width="100%"
           style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <thead>
        <tr style="background:#F3F4F6">
          <th style="padding:9px 14px;text-align:left;font-size:11px;color:#6B7280;font-weight:700;border-bottom:1px solid #E5E7EB">No.</th>
          <th style="padding:9px 14px;text-align:left;font-size:11px;color:#6B7280;font-weight:700;border-bottom:1px solid #E5E7EB">Proyecto</th>
          <th style="padding:9px 14px;text-align:right;font-size:11px;color:#6B7280;font-weight:700;border-bottom:1px solid #E5E7EB">Total</th>
          <th style="padding:9px 14px;text-align:center;font-size:11px;color:#6B7280;font-weight:700;border-bottom:1px solid #E5E7EB">Antigüedad</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <table cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
      <tr>
        <td style="background:#2563EB;border-radius:8px;">
          <a href="${opts.appUrl}/payrolls"
             style="display:inline-block;padding:12px 28px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
            Ver nóminas
          </a>
        </td>
      </tr>
    </table>`;

  await getTransporter().sendMail({
    from:    `"Control de Gastos" <${env.GMAIL_USER}>`,
    to:      opts.toEmail,
    subject: `🧾 ${count} nómina${count !== 1 ? 's' : ''} aprobada${count !== 1 ? 's' : ''} sin pagar - Control de Gastos`,
    html:    baseTemplate(content),
  });
}
