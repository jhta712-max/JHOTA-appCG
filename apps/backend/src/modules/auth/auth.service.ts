import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler';
import { JwtPayload } from '../../middlewares/authenticate';
import type { LoginInput } from './auth.schema';

// ----------------------------------------------------------------
// Helpers internos
// ----------------------------------------------------------------
function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn'],
  });
}

function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as jwt.SignOptions['expiresIn'],
  });
}

function getRefreshTokenExpiry(): Date {
  const ms = parseDuration(env.JWT_REFRESH_EXPIRES);
  return new Date(Date.now() + ms);
}

/** Convierte duración tipo '7d', '15m', '1h' a milisegundos */
function parseDuration(str: string): number {
  const units: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 86400000; // 7 días por defecto
  return parseInt(match[1]) * units[match[2]];
}

// ----------------------------------------------------------------
// Servicio
// ----------------------------------------------------------------
export async function login(data: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    // Mensaje genérico para no revelar si el email existe
    throw new AppError(401, 'Credenciales incorrectas', 'INVALID_CREDENTIALS');
  }

  const passwordMatch = await bcrypt.compare(data.password, user.password);
  if (!passwordMatch) {
    throw new AppError(401, 'Credenciales incorrectas', 'INVALID_CREDENTIALS');
  }

  // Registrar último login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const tokenPayload: JwtPayload = {
    userId: user.id,
    role: user.role.name,
    email: user.email,
  };

  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Guardar refresh token en BD
  await prisma.refreshToken.create({
    data: {
      userId:    user.id,
      token:     refreshToken,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role.name,
    },
  };
}

export async function refresh(token: string) {
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    throw new AppError(401, 'Refresh token inválido o expirado', 'TOKEN_INVALID');
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token } });

  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw new AppError(401, 'Refresh token revocado o expirado', 'TOKEN_REVOKED');
  }

  // Revocar el token actual (rotación)
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    throw new AppError(401, 'Usuario no disponible', 'USER_INACTIVE');
  }

  const newPayload: JwtPayload = { userId: user.id, role: user.role.name, email: user.email };
  const newAccessToken  = generateAccessToken(newPayload);
  const newRefreshToken = generateRefreshToken(newPayload);

  await prisma.refreshToken.create({
    data: { userId: user.id, token: newRefreshToken, expiresAt: getRefreshTokenExpiry() },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logout(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token, revoked: false },
    data:  { revoked: true },
  });
}

// ----------------------------------------------------------------
// Primer acceso — crea el primer admin cuando la BD está vacía
// ----------------------------------------------------------------

/** Devuelve true si no existe ningún usuario en la BD */
export async function needsSetup(): Promise<boolean> {
  const count = await prisma.user.count();
  return count === 0;
}

/** Crea el primer admin. Falla si ya hay usuarios. */
export async function setupAdmin(data: {
  name: string;
  email: string;
  password: string;
}) {
  const empty = await needsSetup();
  if (!empty) {
    throw new AppError(403, 'El sistema ya tiene usuarios registrados', 'SETUP_LOCKED');
  }

  // Buscar o crear el rol admin
  let adminRole = await prisma.role.findFirst({ where: { name: 'admin' } });
  if (!adminRole) {
    // Seed básico de roles si la BD está completamente vacía
    adminRole = await prisma.role.create({
      data: { name: 'admin', description: 'Administrador del sistema' },
    });
    await prisma.role.createMany({
      data: [
        { name: 'supervisor', description: 'Supervisor de proyectos' },
        { name: 'operator',   description: 'Operador de gastos' },
      ],
      skipDuplicates: true,
    });
  }

  const hashed = await bcrypt.hash(data.password, 12);

  const user = await prisma.user.create({
    data: {
      name:     data.name,
      email:    data.email,
      password: hashed,
      roleId:   adminRole.id,
      isActive: true,
    },
    include: { role: { select: { name: true, description: true } } },
  });

  return {
    id:    user.id,
    name:  user.name,
    email: user.email,
    role:  user.role,
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, phone: true,
      avatarUrl: true, lastLogin: true, createdAt: true,
      role: { select: { name: true, description: true } },
    },
  });

  if (!user) throw new AppError(404, 'Usuario no encontrado', 'NOT_FOUND');
  return user;
}
