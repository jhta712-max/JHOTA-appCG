import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateBeneficiaryInput, UpdateBeneficiaryInput } from './beneficiaries.schema';

const INCLUDE = {
  createdBy: { select: { id: true, name: true } },
} as const;

export async function getBeneficiaries(onlyActive = true) {
  return prisma.beneficiary.findMany({
    where:   onlyActive ? { isActive: true } : undefined,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: INCLUDE,
  });
}

export async function getBeneficiaryById(id: string) {
  const b = await prisma.beneficiary.findUnique({ where: { id }, include: INCLUDE });
  if (!b) throw new AppError(404, 'Beneficiario no encontrado', 'NOT_FOUND');
  return b;
}

export async function createBeneficiary(data: CreateBeneficiaryInput, userId: string) {
  // Verificar duplicado: mismo nombre + número de cuenta activo
  const existing = await prisma.beneficiary.findFirst({
    where: {
      name:          { equals: data.name, mode: 'insensitive' },
      accountNumber: data.accountNumber,
      isActive:      true,
    },
  });
  if (existing) {
    throw new AppError(409, 'Ya existe un beneficiario activo con ese nombre y número de cuenta', 'DUPLICATE');
  }

  return prisma.beneficiary.create({
    data: { ...data, createdById: userId },
    include: INCLUDE,
  });
}

export async function updateBeneficiary(id: string, data: UpdateBeneficiaryInput) {
  await getBeneficiaryById(id);
  return prisma.beneficiary.update({ where: { id }, data, include: INCLUDE });
}

export async function deactivateBeneficiary(id: string) {
  await getBeneficiaryById(id);
  return prisma.beneficiary.update({
    where: { id },
    data:  { isActive: false },
    include: INCLUDE,
  });
}
