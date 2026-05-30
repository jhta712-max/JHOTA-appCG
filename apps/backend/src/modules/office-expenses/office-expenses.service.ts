import { prisma } from '../../lib/prisma';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateOfficeExpenseInput, UpdateOfficeExpenseInput, ListOfficeExpensesInput } from './office-expenses.schema';

const INCLUDE = {
  createdBy:   { select: { id: true, name: true, email: true } },
  companyCard: { select: { id: true, holderName: true, lastFour: true, bank: true } },
} as const;

// ── List ─────────────────────────────────────────────────────────────────────

export async function listOfficeExpenses(params: ListOfficeExpensesInput) {
  const { page, limit, category, from, to, orderBy, order } = params;
  const skip = (page - 1) * limit;

  const where: any = { status: 'ACTIVE' };
  if (category)   where.category    = category;
  if (from || to) {
    where.expenseDate = {};
    if (from) where.expenseDate.gte = new Date(from);
    if (to)   where.expenseDate.lte = new Date(to);
  }

  const [data, total] = await Promise.all([
    prisma.officeExpense.findMany({
      where,
      include: INCLUDE,
      orderBy: { [orderBy]: order },
      skip,
      take: limit,
    }),
    prisma.officeExpense.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ── Get one ──────────────────────────────────────────────────────────────────

export async function getOfficeExpenseById(id: string) {
  const expense = await prisma.officeExpense.findUnique({ where: { id }, include: INCLUDE });
  if (!expense || expense.status === 'VOIDED') {
    throw new AppError(404, 'Gasto de oficina no encontrado', 'NOT_FOUND');
  }
  return expense;
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createOfficeExpense(data: CreateOfficeExpenseInput, userId: string) {
  // Validate card required for CARD payment
  if (data.paymentMethod === 'CARD' && !data.companyCardId) {
    throw new AppError(400, 'Debe seleccionar una tarjeta para pagos con tarjeta', 'CARD_REQUIRED');
  }

  return prisma.officeExpense.create({
    data: {
      category:      data.category,
      description:   data.description,
      amount:        data.amount,
      expenseDate:   new Date(data.expenseDate),
      paymentMethod: data.paymentMethod as any,
      companyCardId: data.companyCardId ? Number(data.companyCardId) : null,
      hasFiscalDoc:  data.hasFiscalDoc,
      fiscalDocNum:  data.fiscalDocNum ?? null,
      notes:         data.notes ?? null,
      createdById:   userId,
    },
    include: INCLUDE,
  });
}

// ── Update ───────────────────────────────────────────────────────────────────

export async function updateOfficeExpense(id: string, data: UpdateOfficeExpenseInput) {
  await getOfficeExpenseById(id);

  const paymentMethod = data.paymentMethod ?? undefined;
  if (paymentMethod === 'CARD' && data.companyCardId === null) {
    throw new AppError(400, 'Debe seleccionar una tarjeta para pagos con tarjeta', 'CARD_REQUIRED');
  }

  return prisma.officeExpense.update({
    where: { id },
    data: {
      ...(data.category      && { category:    data.category }),
      ...(data.description   && { description: data.description }),
      ...(data.amount        && { amount:      data.amount }),
      ...(data.expenseDate   && { expenseDate: new Date(data.expenseDate) }),
      ...(paymentMethod      && { paymentMethod: paymentMethod as any }),
      ...(data.companyCardId !== undefined && { companyCardId: data.companyCardId ? Number(data.companyCardId) : null }),
      ...(data.hasFiscalDoc  !== undefined && { hasFiscalDoc: data.hasFiscalDoc }),
      ...(data.fiscalDocNum  !== undefined && { fiscalDocNum: data.fiscalDocNum }),
      ...(data.notes         !== undefined && { notes: data.notes }),
    },
    include: INCLUDE,
  });
}

// ── Void (soft delete) ────────────────────────────────────────────────────────

export async function voidOfficeExpense(id: string) {
  await getOfficeExpenseById(id);
  return prisma.officeExpense.update({
    where: { id },
    data:  { status: 'VOIDED' },
    include: INCLUDE,
  });
}

// ── Summary stats ─────────────────────────────────────────────────────────────

export async function getOfficeExpenseSummary() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [totalMonth, byCategory, totalAll] = await Promise.all([
    prisma.officeExpense.aggregate({
      where:  { status: 'ACTIVE', expenseDate: { gte: start, lte: end } },
      _sum:   { amount: true },
      _count: true,
    }),
    prisma.officeExpense.groupBy({
      by:     ['category'],
      where:  { status: 'ACTIVE' },
      _sum:   { amount: true },
      _count: true,
    }),
    prisma.officeExpense.aggregate({
      where: { status: 'ACTIVE' },
      _sum:  { amount: true },
      _count: true,
    }),
  ]);

  return {
    currentMonth: {
      total: Number(totalMonth._sum.amount ?? 0),
      count: totalMonth._count,
    },
    allTime: {
      total: Number(totalAll._sum.amount ?? 0),
      count: totalAll._count,
    },
    byCategory: byCategory.map((r: any) => ({
      category: r.category,
      total:    Number(r._sum.amount ?? 0),
      count:    r._count,
    })),
  };
}
