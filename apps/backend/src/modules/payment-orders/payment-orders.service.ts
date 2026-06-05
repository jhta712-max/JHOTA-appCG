import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { buildPaginatedResponse, parsePagination } from '../../utils/pagination';
import type { CreatePaymentOrderInput, UpdatePaymentOrderInput, PaymentOrderQuery } from './payment-orders.schema';

const INCLUDE = {
  supplier:  true,
  project:   { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  paidBy:    { select: { id: true, name: true } },
  payroll:   { select: { id: true, number: true, type: true, totalAmount: true, periodStart: true, periodEnd: true, status: true } },
  expense:   { select: { id: true, amount: true, expenseDate: true, description: true, status: true } },
} as const;

// ── Listar con filtros y paginación ───────────────────────────
export async function getPaymentOrders(
  query:   PaymentOrderQuery,
  userCtx: { userId: string; role: string },
) {
  const { page, limit, skip } = parsePagination(query);
  const isAdmin = userCtx.role === 'admin';

  const where: any = {};
  if (query.status)     where.status     = query.status;
  if (query.projectId)  where.projectId  = query.projectId;
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.orderType)  where.orderType  = query.orderType;
  if (query.search) {
    where.OR = [
      { concept:       { contains: query.search, mode: 'insensitive' } },
      { payingCompany: { contains: query.search, mode: 'insensitive' } },
      { supplier:      { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  if (!isAdmin) {
    where.createdById = userCtx.userId;
    where.status      = { notIn: ['PAID', 'VOIDED'] };
  }

  const [data, total] = await Promise.all([
    prisma.paymentOrder.findMany({ where, skip, take: limit, orderBy: { [query.orderBy]: query.order }, include: INCLUDE }),
    prisma.paymentOrder.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, { page, limit, skip });
}

// ── Obtener una ───────────────────────────────────────────────
export async function getPaymentOrderById(
  id:      string,
  userCtx?: { userId: string; role: string },
) {
  const po = await prisma.paymentOrder.findUnique({ where: { id }, include: INCLUDE });
  if (!po) throw new AppError(404, 'Orden de pago no encontrada', 'NOT_FOUND');

  if (userCtx && userCtx.role !== 'admin') {
    if (po.createdById !== userCtx.userId)
      throw new AppError(403, 'No tienes acceso a esta orden de pago', 'FORBIDDEN');
    if (['PAID', 'VOIDED'].includes(po.status))
      throw new AppError(404, 'Orden de pago no encontrada', 'NOT_FOUND');
  }
  return po;
}

// ── Nóminas APPROVED disponibles ─────────────────────────────
export async function getAvailablePayrolls(projectId: string) {
  return prisma.payroll.findMany({
    where:   { projectId, status: 'APPROVED', paymentOrder: null },
    orderBy: { createdAt: 'desc' },
    select:  { id: true, number: true, type: true, totalAmount: true, periodStart: true, periodEnd: true, description: true },
  });
}

// ── Gastos TRANSFER disponibles ───────────────────────────────
export async function getAvailableExpenses(projectId: string) {
  return prisma.expense.findMany({
    where:   { projectId, paymentMethod: 'TRANSFER', status: 'ACTIVE', paymentOrder: null },
    orderBy: { expenseDate: 'desc' },
    include: { category: { select: { id: true, name: true } } },
  });
}

// ── Crear ─────────────────────────────────────────────────────
export async function createPaymentOrder(data: CreatePaymentOrderInput, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: data.projectId } });
  if (!project)                    throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');
  if (project.status !== 'ACTIVE') throw new AppError(400, 'El proyecto debe estar activo', 'PROJECT_INACTIVE');

  const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
  if (!supplier || !supplier.isActive) throw new AppError(404, 'Suplidor no encontrado o inactivo', 'NOT_FOUND');
  if (!supplier.bank || !supplier.accountNumber)
    throw new AppError(400, 'El suplidor no tiene datos bancarios registrados. Actualícelo primero.', 'SUPPLIER_NO_BANK');

  if (data.orderType === 'PAYROLL' && data.payrollId) {
    const payroll = await prisma.payroll.findUnique({ where: { id: data.payrollId } });
    if (!payroll)                      throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
    if (payroll.status !== 'APPROVED') throw new AppError(400, 'La nómina debe estar aprobada', 'PAYROLL_NOT_APPROVED');
    if (payroll.projectId !== data.projectId) throw new AppError(400, 'La nómina no pertenece a este proyecto', 'PROJECT_MISMATCH');
    const existing = await prisma.paymentOrder.findFirst({ where: { payrollId: data.payrollId } });
    if (existing) throw new AppError(409, 'Esta nómina ya tiene una orden de pago vinculada', 'DUPLICATE');
  }

  const last   = await prisma.paymentOrder.findFirst({ orderBy: { number: 'desc' } });
  const number = (last?.number ?? 0) + 1;

  const generatedText = buildOrderText({
    payingCompany: data.payingCompany,
    currency:      data.currency ?? 'RD$',
    amount:        Number(data.amount),
    concept:       data.concept,
    project:       `${project.code} — ${project.name}`,
    bank:          supplier.bank,
    accountType:   supplier.accountType ?? '',
    accountNumber: supplier.accountNumber,
    holderName:    supplier.name,
  });

  return prisma.paymentOrder.create({
    data: {
      number,
      orderType:     data.orderType ?? 'SERVICIO',
      payingCompany: data.payingCompany,
      supplierId:    data.supplierId,
      projectId:     data.projectId,
      amount:        data.amount,
      currency:      data.currency ?? 'RD$',
      concept:       data.concept,
      notes:         data.notes,
      generatedText,
      payrollId:     data.orderType === 'PAYROLL' ? (data.payrollId ?? null) : null,
      createdById:   userId,
    },
    include: INCLUDE,
  });
}

// ── Actualizar ────────────────────────────────────────────────
export async function updatePaymentOrder(id: string, data: UpdatePaymentOrderInput) {
  const po = await getPaymentOrderById(id);
  if (po.status === 'PAID' || po.status === 'VOIDED')
    throw new AppError(400, 'No se puede editar una orden pagada o anulada', 'ORDER_CLOSED');

  const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId ?? po.supplierId } });
  const project  = await prisma.project.findUnique({ where: { id: data.projectId ?? po.projectId } });

  const merged = {
    payingCompany: data.payingCompany ?? po.payingCompany,
    currency:      data.currency      ?? po.currency,
    amount:        Number(data.amount ?? po.amount),
    concept:       data.concept       ?? po.concept,
    project:       `${project!.code} — ${project!.name}`,
    bank:          supplier!.bank          ?? (po.supplier as any).bank          ?? '',
    accountType:   supplier!.accountType   ?? (po.supplier as any).accountType   ?? '',
    accountNumber: supplier!.accountNumber ?? (po.supplier as any).accountNumber ?? '',
    holderName:    supplier!.name,
  };

  const { payrollId, ...rest } = data as any;

  return prisma.paymentOrder.update({
    where:   { id },
    data:    { ...rest, generatedText: buildOrderText(merged) },
    include: INCLUDE,
  });
}

// ── Vincular gasto ────────────────────────────────────────────
export async function linkExpense(id: string, expenseId: string) {
  const po = await getPaymentOrderById(id);
  if (po.orderType !== 'MATERIALS') throw new AppError(400, 'Solo se puede vincular un gasto a órdenes de tipo Materiales', 'WRONG_TYPE');
  if (po.status === 'VOIDED')       throw new AppError(400, 'La orden está anulada', 'ORDER_VOIDED');
  if (po.expenseId)                 throw new AppError(409, 'Esta orden ya tiene un gasto vinculado', 'DUPLICATE');

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense)                             throw new AppError(404, 'Gasto no encontrado', 'NOT_FOUND');
  if (expense.projectId !== po.projectId)   throw new AppError(400, 'El gasto no pertenece al mismo proyecto', 'PROJECT_MISMATCH');
  if (expense.paymentMethod !== 'TRANSFER') throw new AppError(400, 'Solo se pueden vincular gastos pagados por transferencia', 'WRONG_PAYMENT_METHOD');

  const existing = await prisma.paymentOrder.findFirst({ where: { expenseId } });
  if (existing) throw new AppError(409, 'Este gasto ya está vinculado a otra orden de pago', 'DUPLICATE');

  return prisma.paymentOrder.update({ where: { id }, data: { expenseId }, include: INCLUDE });
}

// ── Desvincular gasto ─────────────────────────────────────────
export async function unlinkExpense(id: string) {
  await getPaymentOrderById(id);
  return prisma.paymentOrder.update({ where: { id }, data: { expenseId: null }, include: INCLUDE });
}

// ── Vincular nómina retroactivamente ─────────────────────────
export async function linkPayroll(id: string, payrollId: string) {
  const po = await getPaymentOrderById(id);
  if (po.orderType !== 'PAYROLL') throw new AppError(400, 'Solo se puede vincular una nómina a órdenes de tipo Nómina', 'WRONG_TYPE');
  if (po.status === 'VOIDED')     throw new AppError(400, 'La orden está anulada', 'ORDER_VOIDED');
  if (po.payrollId)               throw new AppError(409, 'Esta orden ya tiene una nómina vinculada', 'DUPLICATE');

  const payroll = await prisma.payroll.findUnique({ where: { id: payrollId } });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (['PAID', 'VOIDED'].includes(payroll.status)) throw new AppError(400, 'No se puede vincular una nómina pagada o anulada', 'PAYROLL_INVALID_STATUS');
  if (payroll.projectId !== po.projectId) throw new AppError(400, 'La nómina no pertenece al mismo proyecto', 'PROJECT_MISMATCH');

  return prisma.paymentOrder.update({ where: { id }, data: { payrollId }, include: INCLUDE });
}

// ── Desvincular nómina ────────────────────────────────────────
export async function unlinkPayroll(id: string) {
  await getPaymentOrderById(id);
  return prisma.paymentOrder.update({ where: { id }, data: { payrollId: null }, include: INCLUDE });
}

// ── Marcar como pagada + auto-crear gasto ─────────────────────
export async function markAsPaid(id: string, userId: string) {
  const po = await getPaymentOrderById(id);
  if (po.status === 'PAID')   throw new AppError(400, 'La orden ya está marcada como pagada', 'ALREADY_PAID');
  if (po.status === 'VOIDED') throw new AppError(400, 'La orden está anulada', 'ORDER_VOIDED');

  return prisma.$transaction(async (tx) => {
    await tx.paymentOrder.update({ where: { id }, data: { status: 'PAID', paidAt: new Date(), paidById: userId } });

    if (!po.expenseId && po.orderType !== 'PAYROLL') {
      const categoryName = po.orderType === 'MATERIALS' ? 'Materiales' : 'Servicios';
      const category = await tx.expenseCategory.upsert({
        where:  { name: categoryName },
        update: { isActive: true },
        create: { name: categoryName, description: 'Auto-creada para órdenes de pago', isActive: true },
      });

      const opRef   = `OP-${String(po.number).padStart(3, '0')}`;
      const expense = await tx.expense.create({
        data: {
          projectId:     po.projectId,
          categoryId:    category.id,
          userId,
          expenseDate:   new Date(),
          amount:        po.amount,
          description:   `[${opRef}] ${po.concept}`,
          paymentMethod: 'TRANSFER',
          hasFiscalDoc:  false,
          notes:         `Auto-generado al confirmar ${opRef}. Suplidor: ${(po as any).supplier?.name ?? po.supplierId}. Empresa: ${po.payingCompany}.`,
        },
      });

      await tx.paymentOrder.update({ where: { id }, data: { expenseId: expense.id } });
    }

    return tx.paymentOrder.findUniqueOrThrow({ where: { id }, include: INCLUDE });
  });
}

// ── Generar gasto retroactivo ─────────────────────────────────
export async function generateExpenseForOrder(id: string, userId: string) {
  const po = await getPaymentOrderById(id);
  if (po.status !== 'PAID')       throw new AppError(400, 'Solo se puede generar gasto para órdenes pagadas', 'ORDER_NOT_PAID');
  if (po.expenseId)               throw new AppError(409, 'Esta orden ya tiene un gasto vinculado', 'ALREADY_HAS_EXPENSE');
  if (po.orderType === 'PAYROLL') throw new AppError(400, 'Las órdenes de nómina no generan gasto individual', 'PAYROLL_NO_EXPENSE');

  const categoryName = po.orderType === 'MATERIALS' ? 'Materiales' : 'Servicios';
  const category = await prisma.expenseCategory.upsert({
    where:  { name: categoryName },
    update: { isActive: true },
    create: { name: categoryName, description: 'Auto-creada para órdenes de pago', isActive: true },
  });

  return prisma.$transaction(async (tx) => {
    const opRef = `OP-${String(po.number).padStart(3, '0')}`;
    const expense = await tx.expense.create({
      data: {
        projectId:     po.projectId,
        categoryId:    category.id,
        userId,
        expenseDate:   po.paidAt ?? new Date(),
        amount:        po.amount,
        description:   `[${opRef}] ${po.concept}`,
        paymentMethod: 'TRANSFER',
        hasFiscalDoc:  false,
        notes:         `Generado retroactivamente para ${opRef}. Suplidor: ${(po as any).supplier?.name ?? po.supplierId}.`,
      },
    });
    await tx.paymentOrder.update({ where: { id }, data: { expenseId: expense.id } });
    return tx.paymentOrder.findUniqueOrThrow({ where: { id }, include: INCLUDE });
  });
}

// ── Anular ────────────────────────────────────────────────────
export async function voidPaymentOrder(id: string) {
  const po = await getPaymentOrderById(id);
  if (po.status === 'PAID')   throw new AppError(400, 'No se puede anular una orden ya pagada', 'ALREADY_PAID');
  if (po.status === 'VOIDED') throw new AppError(400, 'La orden ya está anulada', 'ALREADY_VOIDED');
  return prisma.paymentOrder.update({ where: { id }, data: { status: 'VOIDED' }, include: INCLUDE });
}

// ── Borrado permanente (solo admin) ──────────────────────────
export async function hardDeletePaymentOrder(id: string) {
  const po = await prisma.paymentOrder.findUnique({ where: { id } });
  if (!po) throw new AppError(404, 'Orden no encontrada', 'NOT_FOUND');
  await prisma.paymentOrder.delete({ where: { id } });
}

// ── Helper ────────────────────────────────────────────────────
function buildOrderText(p: {
  payingCompany: string; currency: string; amount: number;
  concept: string; project: string; bank: string;
  accountType: string; accountNumber: string; holderName: string;
}) {
  const monto = p.amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fecha = new Date().toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return [
    p.payingCompany,
    `💰 ${p.currency} ${monto}`,
    `📌 Concepto: ${p.concept}`,
    `📍 Proyecto: ${p.project}`,
    `Banco: ${p.bank}`,
    `${p.accountType}: ${p.accountNumber}`,
    `nombre: ${p.holderName}`,
    `📅 Fecha: ${fecha.charAt(0).toUpperCase() + fecha.slice(1)}`,
  ].join('\n');
}
