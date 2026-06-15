import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateCreditLineInput, UpdateCreditLineInput, AddPaymentInput } from './credit-lines.schema';

const LINE_INCLUDE = {
  supplier:  { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  payments:  { orderBy: { paymentDate: 'desc' as const } },
} as const;

export async function listCreditLines(supplierId: string) {
  return prisma.supplierCreditLine.findMany({
    where:   { supplierId },
    include: LINE_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCreditLineBalance(lineId: string) {
  const line = await prisma.supplierCreditLine.findUnique({
    where:   { id: lineId },
    include: { payments: { select: { amount: true } } },
  });
  if (!line) throw new AppError(404, 'Línea de crédito no encontrada', 'NOT_FOUND');

  const consumed = Number(
    (await prisma.expense.aggregate({
      where: { creditLineId: lineId, status: { not: 'VOIDED' } },
      _sum:  { amount: true },
    }))._sum.amount ?? 0
  );
  const paid      = line.payments.reduce((s, p) => s + Number(p.amount), 0);
  const pending   = Math.max(consumed - paid, 0);
  const available = Math.max(Number(line.creditLimit) - pending, 0);

  return { lineId, creditLimit: Number(line.creditLimit), consumed, paid, pending, available };
}

export async function createCreditLine(supplierId: string, data: CreateCreditLineInput, userId: string) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new AppError(404, 'Proveedor no encontrado', 'NOT_FOUND');

  return prisma.supplierCreditLine.create({
    data: {
      supplierId,
      creditLimit: data.creditLimit,
      notes:       data.notes ?? null,
      createdById: userId,
    },
    include: LINE_INCLUDE,
  });
}

export async function updateCreditLine(lineId: string, data: UpdateCreditLineInput) {
  const line = await prisma.supplierCreditLine.findUnique({ where: { id: lineId } });
  if (!line) throw new AppError(404, 'Línea de crédito no encontrada', 'NOT_FOUND');

  return prisma.supplierCreditLine.update({
    where:   { id: lineId },
    data:    { creditLimit: data.creditLimit, notes: data.notes },
    include: LINE_INCLUDE,
  });
}

export async function toggleCreditLine(lineId: string) {
  const line = await prisma.supplierCreditLine.findUnique({ where: { id: lineId } });
  if (!line) throw new AppError(404, 'Línea de crédito no encontrada', 'NOT_FOUND');

  return prisma.supplierCreditLine.update({
    where:   { id: lineId },
    data:    { isActive: !line.isActive },
    include: LINE_INCLUDE,
  });
}

export async function addPayment(lineId: string, data: AddPaymentInput, userId: string) {
  const bal = await getCreditLineBalance(lineId);
  if (data.amount > bal.pending + 0.01) {
    throw new AppError(400, `El pago (${data.amount}) supera la deuda pendiente (${bal.pending})`, 'EXCEEDS_BALANCE');
  }

  return prisma.supplierCreditPayment.create({
    data: {
      creditLineId:  lineId,
      amount:        data.amount,
      paymentDate:   new Date(data.paymentDate),
      paymentMethod: data.paymentMethod as any,
      reference:     data.reference ?? null,
      notes:         data.notes     ?? null,
      createdById:   userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function listPayments(lineId: string) {
  return prisma.supplierCreditPayment.findMany({
    where:   { creditLineId: lineId },
    orderBy: { paymentDate: 'desc' },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}
