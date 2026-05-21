import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateCardInput, UpdateCardInput } from './cards.schema';

// ── Listar tarjetas ────────────────────────────────────────────

export async function getCards(onlyActive = false) {
  return prisma.companyCard.findMany({
    where:   onlyActive ? { isActive: true } : undefined,
    orderBy: [{ isActive: 'desc' }, { holderName: 'asc' }],
    include: { _count: { select: { expenses: true } } },
  });
}

// ── Obtener una tarjeta ────────────────────────────────────────

export async function getCardById(id: number) {
  const card = await prisma.companyCard.findUnique({
    where:   { id },
    include: { _count: { select: { expenses: true } } },
  });
  if (!card) throw new AppError(404, 'Tarjeta no encontrada', 'CARD_NOT_FOUND');
  return card;
}

// ── Crear tarjeta ──────────────────────────────────────────────

export async function createCard(data: CreateCardInput) {
  // Verificar que no exista la misma combinación holderName + lastFour
  const existing = await prisma.companyCard.findFirst({
    where: {
      holderName: { equals: data.holderName, mode: 'insensitive' },
      lastFour:   data.lastFour,
      isActive:   true,
    },
  });
  if (existing) {
    throw new AppError(409, 'Ya existe una tarjeta activa con ese titular y últimos 4 dígitos', 'CARD_DUPLICATE');
  }

  return prisma.companyCard.create({ data });
}

// ── Actualizar tarjeta ─────────────────────────────────────────

export async function updateCard(id: number, data: UpdateCardInput) {
  await getCardById(id);
  return prisma.companyCard.update({ where: { id }, data });
}

// ── Desactivar tarjeta ─────────────────────────────────────────

export async function deactivateCard(id: number) {
  await getCardById(id);
  return prisma.companyCard.update({
    where: { id },
    data:  { isActive: false },
  });
}
