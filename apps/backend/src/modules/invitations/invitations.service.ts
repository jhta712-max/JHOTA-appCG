import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { sendInvitationEmail, sendWelcomeEmail } from '../../utils/mailer';
import { env } from '../../config/env';

const INVITE_EXPIRES_HOURS = 48;

// ─── Crear y enviar invitación ────────────────────────────────────────────────

export async function createInvitation(
  invitedById: string,
  email: string,
  roleId: number,
) {
  // Verificar que el email no esté ya registrado
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'Este correo ya tiene una cuenta activa en el sistema');
  }

  // Cancelar invitaciones pendientes anteriores al mismo correo
  await prisma.invitation.updateMany({
    where: { email, usedAt: null },
    data:  { expiresAt: new Date() }, // expira inmediatamente
  });

  // Verificar que el rol existe
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new AppError(404, 'Rol no encontrado');

  // Obtener quien invita
  const invitedBy = await prisma.user.findUnique({
    where: { id: invitedById },
    select: { name: true },
  });
  if (!invitedBy) throw new AppError(404, 'Usuario no encontrado');

  // Generar token seguro
  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_EXPIRES_HOURS * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: { email, roleId, token, invitedById, expiresAt },
  });

  // URL de activación
  const inviteUrl = `${env.FRONTEND_URL}/invite/${token}`;

  // Enviar email en segundo plano (fire-and-forget) para no bloquear la respuesta
  const emailConfigured = !!(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);
  if (emailConfigured) {
    sendInvitationEmail({
      toEmail:       email,
      invitedByName: invitedBy.name,
      roleName:      role.name,
      inviteUrl,
      expiresHours:  INVITE_EXPIRES_HOURS,
    }).catch((err) => console.error('[mailer] Error enviando invitación:', err));
  }

  return {
    invitationId: invitation.id.toString(),
    email,
    inviteUrl,
    expiresAt,
    emailSent: !!(env.GMAIL_USER && env.GMAIL_APP_PASSWORD),
  };
}

// ─── Verificar token (para pre-cargar datos en el frontend) ───────────────────

export async function verifyInvitationToken(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { role: true },
  });

  if (!invitation) {
    throw new AppError(404, 'Invitación no válida o no encontrada');
  }
  if (invitation.usedAt) {
    throw new AppError(410, 'Esta invitación ya fue utilizada');
  }
  if (invitation.expiresAt < new Date()) {
    throw new AppError(410, 'Esta invitación ha expirado');
  }

  return {
    email:    invitation.email,
    roleName: invitation.role.name,
    roleId:   invitation.roleId,
    expiresAt: invitation.expiresAt,
  };
}

// ─── Aceptar invitación (crear usuario) ──────────────────────────────────────

export async function acceptInvitation(
  token: string,
  name: string,
  password: string,
) {
  // Verificar token
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { role: true },
  });

  if (!invitation)         throw new AppError(404, 'Invitación no válida');
  if (invitation.usedAt)   throw new AppError(410, 'Esta invitación ya fue utilizada');
  if (invitation.expiresAt < new Date()) throw new AppError(410, 'La invitación ha expirado');

  // Verificar nuevamente que el email no esté tomado
  const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existing) throw new AppError(409, 'Este correo ya tiene una cuenta');

  const hashedPassword = await bcrypt.hash(password, 12);

  // Crear usuario + marcar invitación como usada en una transacción
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name,
        email:    invitation.email,
        password: hashedPassword,
        roleId:   invitation.roleId,
        isActive: true,
      },
      include: { role: { select: { name: true, description: true } } },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data:  { usedAt: new Date() },
    });

    return newUser;
  });

  // Email de bienvenida (best-effort)
  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    sendWelcomeEmail({
      toEmail:  user.email,
      name:     user.name,
      loginUrl: `${env.FRONTEND_URL}/login`,
    }).catch((err) => console.error('[mailer] Error enviando bienvenida:', err));
  }

  return {
    id:    user.id,
    name:  user.name,
    email: user.email,
    role:  user.role,
  };
}

// ─── Listar invitaciones pendientes ──────────────────────────────────────────

export async function listPendingInvitations() {
  const rows = await prisma.invitation.findMany({
    where: {
      usedAt:    null,
      expiresAt: { gt: new Date() },
    },
    include: {
      role:      { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  // BigInt no es serializable a JSON — lo convertimos a string
  return rows.map((inv) => ({ ...inv, id: inv.id.toString() }));
}

// ─── Revocar invitación ───────────────────────────────────────────────────────

export async function revokeInvitation(id: bigint) {
  const inv = await prisma.invitation.findUnique({ where: { id } });
  if (!inv) throw new AppError(404, 'Invitación no encontrada');
  if (inv.usedAt) throw new AppError(400, 'No se puede revocar una invitación ya utilizada');

  await prisma.invitation.update({
    where: { id },
    data:  { expiresAt: new Date() },
  });
}
