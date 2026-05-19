import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { buildPaginatedResponse, parsePagination } from '../../utils/pagination';
import { extractNCFType, isElectronicNCF } from '../../utils/fiscal.utils';
import type { CreateExpenseInput, UpdateExpenseInput, VoidExpenseInput, ExpenseQuery } from './expenses.schema';

const EXPENSE_INCLUDE = {
  project:      { select: { id: true, code: true, name: true } },
  category:     { select: { id: true, name: true, icon: true } },
  registeredBy: { select: { id: true, name: true } },
  fiscalVoucher: true,
  attachments:  { select: { id: true, fileName: true, mimeType: true, isPrimary: true, createdAt: true } },
} as const;

// ---------------------------------------------------------------
// Listar con filtros
// ---------------------------------------------------------------
export async function getExpenses(query: ExpenseQuery) {
  const { page, limit, skip } = parsePagination(query);

  const where: any = {};
  if (query.projectId)     where.projectId     = query.projectId;
  if (query.categoryId)    where.categoryId    = query.categoryId;
  if (query.userId)        where.userId        = query.userId;
  if (query.status)        where.status        = query.status;
  if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
  if (query.hasFiscalDoc !== undefined) where.hasFiscalDoc = query.hasFiscalDoc;

  if (query.dateFrom || query.dateTo) {
    where.expenseDate = {};
    if (query.dateFrom) where.expenseDate.gte = new Date(query.dateFrom);
    if (query.dateTo)   where.expenseDate.lte = new Date(query.dateTo);
  }

  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    where.amount = {};
    if (query.minAmount !== undefined) where.amount.gte = query.minAmount;
    if (query.maxAmount !== undefined) where.amount.lte = query.maxAmount;
  }

  if (query.search) {
    where.OR = [
      { description: { contains: query.search, mode: 'insensitive' } },
      { fiscalVoucher: { supplierName: { contains: query.search, mode: 'insensitive' } } },
      { fiscalVoucher: { ncf: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [query.orderBy]: query.order },
      include: EXPENSE_INCLUDE,
    }),
    prisma.expense.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, { page, limit, skip });
}

// ---------------------------------------------------------------
// Obtener uno
// ---------------------------------------------------------------
export async function getExpenseById(id: string) {
  const expense = await prisma.expense.findUnique({ where: { id }, include: EXPENSE_INCLUDE });
  if (!expense) throw new AppError(404, 'Gasto no encontrado', 'NOT_FOUND');
  return expense;
}

// ---------------------------------------------------------------
// Crear gasto + comprobante fiscal
// ---------------------------------------------------------------
export async function createExpense(data: CreateExpenseInput, userId: string, userRole?: string) {
  // Verificar que el proyecto existe y está activo
  const project = await prisma.project.findUnique({
    where:   { id: data.projectId },
    include: { assignments: { select: { userId: true } } },
  });
  if (!project)                    throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');
  if (project.status !== 'ACTIVE') throw new AppError(400, 'Solo se pueden registrar gastos en proyectos activos', 'PROJECT_INACTIVE');

  // Operadores solo pueden registrar gastos en proyectos asignados a ellos
  if (userRole === 'operator') {
    const isAssigned = project.assignments.some((a) => a.userId === userId);
    if (!isAssigned) throw new AppError(403, 'No tienes acceso a este proyecto', 'FORBIDDEN');
  }

  // Verificar que la categoría existe
  const category = await prisma.expenseCategory.findUnique({ where: { id: data.categoryId } });
  if (!category || !category.isActive) throw new AppError(404, 'Categoría no encontrada o inactiva', 'NOT_FOUND');

  return prisma.expense.create({
    data: {
      projectId:     data.projectId,
      categoryId:    data.categoryId,
      userId,
      expenseDate:   new Date(data.expenseDate),
      amount:        data.amount,
      description:   data.description,
      paymentMethod: data.paymentMethod,
      hasFiscalDoc:  data.hasFiscalDoc,
      notes:         data.notes,
      // Crear comprobante fiscal si aplica
      ...(data.hasFiscalDoc && data.fiscalVoucher && {
        fiscalVoucher: {
          create: {
            ncf:          data.fiscalVoucher.ncf,
            ncfType:      extractNCFType(data.fiscalVoucher.ncf),
            isElectronic: isElectronicNCF(data.fiscalVoucher.ncf),
            supplierRnc:  data.fiscalVoucher.supplierRnc,
            supplierName: data.fiscalVoucher.supplierName,
            itbisAmount:  data.fiscalVoucher.itbisAmount,
          },
        },
      }),
    },
    include: EXPENSE_INCLUDE,
  });
}

// ---------------------------------------------------------------
// Actualizar gasto
// ---------------------------------------------------------------
export async function updateExpense(id: string, data: UpdateExpenseInput, userId: string, userRole: string) {
  const expense = await getExpenseById(id);

  if (expense.status === 'VOIDED') {
    throw new AppError(400, 'No se puede editar un gasto anulado', 'EXPENSE_VOIDED');
  }

  // Operadores solo pueden editar sus propios gastos dentro de 24 horas
  if (userRole === 'operator') {
    if (expense.userId !== userId) {
      throw new AppError(403, 'Solo puedes editar tus propios gastos', 'FORBIDDEN');
    }
    const hoursSince = (Date.now() - expense.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince > 24) {
      throw new AppError(403, 'Solo puedes editar gastos dentro de las primeras 24 horas', 'EDIT_WINDOW_EXPIRED');
    }
  }

  // Actualizar o eliminar comprobante fiscal
  let fiscalVoucherOp = {};
  if (data.hasFiscalDoc === false) {
    // Eliminar comprobante si existía
    fiscalVoucherOp = { fiscalVoucher: { delete: !!expense.fiscalVoucher } };
  } else if (data.hasFiscalDoc && data.fiscalVoucher) {
    const fv = data.fiscalVoucher;
    const fiscalData = {
      ncf:          fv.ncf,
      ncfType:      extractNCFType(fv.ncf),
      isElectronic: isElectronicNCF(fv.ncf),
      supplierRnc:  fv.supplierRnc,
      supplierName: fv.supplierName,
      itbisAmount:  fv.itbisAmount ?? 0,
    };
    fiscalVoucherOp = {
      fiscalVoucher: expense.fiscalVoucher
        ? { update: fiscalData }
        : { create: fiscalData },
    };
  }

  const { fiscalVoucher, ...expenseData } = data as any;

  return prisma.expense.update({
    where: { id },
    data: {
      ...expenseData,
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
      ...fiscalVoucherOp,
    },
    include: EXPENSE_INCLUDE,
  });
}

// ---------------------------------------------------------------
// Anular gasto
// ---------------------------------------------------------------
export async function voidExpense(id: string, data: VoidExpenseInput, userId: string) {
  const expense = await getExpenseById(id);
  if (expense.status === 'VOIDED') {
    throw new AppError(400, 'El gasto ya está anulado', 'ALREADY_VOIDED');
  }
  return prisma.expense.update({
    where: { id },
    data: {
      status:     'VOIDED',
      voidedAt:   new Date(),
      voidedById: userId,
      voidReason: data.reason,
    },
    include: EXPENSE_INCLUDE,
  });
}
