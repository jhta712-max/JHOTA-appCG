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
