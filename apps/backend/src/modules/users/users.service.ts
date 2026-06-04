import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateUserInput, UpdateUserInput, ChangePasswordInput } from './users.schema';

const USER_SELECT = {
  id: true, name: true, email: true, phone: true,
  avatarUrl: true, isActive: true, whatsappOptIn: true, lastLogin: true,
  createdAt: true, updatedAt: true,
  role: { select: { id: true, name: true, description: true } },
} as const;

export async function getAll() {
  return prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { name: 'asc' },
  });
}

export async function getById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  if (!user) throw new AppError(404, 'Usuario no encontrado', 'NOT_FOUND');
  return user;
}

export async function create(data: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError(409, `Ya existe un usuario con el correo ${data.email}`, 'DUPLICATE_EMAIL');

  const role = await prisma.role.findUnique({ where: { id: data.roleId } });
  if (!role) throw new AppError(404, 'Rol no encontrado', 'NOT_FOUND');

  const hashed = await bcrypt.hash(data.password, 12);
  return prisma.user.create({
    data: {
      name:     data.name,
      email:    data.email,
      password: hashed,
      roleId:   data.roleId,
      phone:    data.phone,
    },
    select: USER_SELECT,
  });
}

export async function update(id: string, data: UpdateUserInput) {
  await getById(id);
  if (data.roleId) {
    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) throw new AppError(404, 'Rol no encontrado', 'NOT_FOUND');
  }
  return prisma.user.update({ where: { id }, data, select: USER_SELECT });
}

export async function changePassword(id: string, data: ChangePasswordInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'Usuario no encontrado', 'NOT_FOUND');

  const match = await bcrypt.compare(data.currentPassword, user.password);
  if (!match) throw new AppError(401, 'Contraseña actual incorrecta', 'WRONG_PASSWORD');

  const hashed = await bcrypt.hash(data.newPassword, 12);
  await prisma.user.update({ where: { id }, data: { password: hashed } });

  // Revocar todos los refresh tokens para forzar re-login
  await prisma.refreshToken.updateMany({ where: { userId: id }, data: { revoked: true } });
}

export async function getRoles() {
  return prisma.role.findMany({ orderBy: { name: 'asc' } });
}
