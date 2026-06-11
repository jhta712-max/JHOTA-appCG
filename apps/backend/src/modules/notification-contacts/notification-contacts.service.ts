import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';

const SELECT = {
  id: true, name: true, phone: true, email: true, isActive: true, notifTypes: true,
  createdAt: true, updatedAt: true,
  createdBy: { select: { id: true, name: true } },
};

export async function listContacts() {
  return prisma.notificationContact.findMany({ select: SELECT, orderBy: { name: 'asc' } });
}

export async function createContact(data: { name: string; phone?: string | null; email?: string | null; notifTypes?: string[] }, userId: string) {
  return prisma.notificationContact.create({
    data: { name: data.name, phone: data.phone ?? null, email: data.email ?? null, notifTypes: data.notifTypes ?? [], createdById: userId },
    select: SELECT,
  });
}

export async function updateContact(id: string, data: { name?: string; phone?: string | null; email?: string | null; isActive?: boolean; notifTypes?: string[] }) {
  const exists = await prisma.notificationContact.findUnique({ where: { id } });
  if (!exists) throw new AppError(404, 'Contacto no encontrado', 'CONTACT_NOT_FOUND');
  return prisma.notificationContact.update({ where: { id }, data, select: SELECT });
}

export async function deleteContact(id: string) {
  const exists = await prisma.notificationContact.findUnique({ where: { id } });
  if (!exists) throw new AppError(404, 'Contacto no encontrado', 'CONTACT_NOT_FOUND');
  await prisma.notificationContact.delete({ where: { id } });
}

export async function getActiveContacts() {
  return prisma.notificationContact.findMany({ where: { isActive: true }, select: { id: true, name: true, phone: true, email: true } });
}
