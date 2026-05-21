import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { buildPaginatedResponse, parsePagination } from '../../utils/pagination';
import type { CreatePaymentOrderInput, UpdatePaymentOrderInput, PaymentOrderQuery } from './payment-orders.schema';

const INCLUDE = {
  beneficiary: true,
  project:     { select: { id: true, code: true, name: true } },
  createdBy:   { select: { id: true, name: true } },
  paidBy:      { select: { id: true, name: true } },
  payroll:     { select: { id: true, number: true, type: true, totalAmount: true, periodStart: true, periodEnd: true, status: true } },
  expense:     { select: { id: true, amount: true, expenseDate: true, description: true, status: true } },
} as const;

// ── Listar con filtros y paginación ───────────────────────────
export async function getPaymentOrders(query: PaymentOrderQuery) {
  const { page, limit, skip } = parsePagination(query);

  const where: any = {};
  if (query.status)        where.status        = query.status;
  if (query.projectId)     where.projectId     = query.projectId;
  if (query.beneficiaryId) where.beneficiaryId = query.beneficiaryId;
  if (query.orderType)     where.orderType     = query.orderType;
  if (query.search) {
    where.OR = [
      { concept:       { contains: query.search, mode: 'insensitive' } },
      { payingCompany: { contains: query.search, mode: 'insensitive' } },
      { beneficiary:   { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.paymentOrder.findMany({ where, skip, take: limit, orderBy: { [query.orderBy]: query.order }, include: INCLUDE }),
    prisma.paymentOrder.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, { page, limit, skip });
}

// ── Obtener una ───────────────────────────────────────────────
export async function getPaymentOrderById(id: string) {
  const po = await prisma.paymentOrder.findUnique({ where: { id }, include: INCLUDE });
  if (!po) throw new AppError(404, 'Orden de pago no encontrada', 'NOT_FOUND');
  return po;
}

// ── Nóminas APPROVED disponibles para vincular ────────────────
export async function getAvailablePayrolls(projectId: string) {
  return prisma.payroll.findMany({
    where: {
      projectId,
      status:      'APPROVED',
      paymentOrder: null, // No vinculadas a otra orden
    },
    orderBy: { createdAt: 'desc' },
    select:  {
      id: true, number: true, type: true, totalAmount: true,
      periodStart: true, periodEnd: true, description: true,
    },
  });
}

// ── Gastos TRANSFER disponibles para vincular (materiales) ────
export async function getAvailableExpenses(projectId: string) {
  return prisma.expense.findMany({
    where: {
      projectId,
      paymentMethod: 'TRANSFER',
      status:        'ACTIVE',
      paymentOrder:  null, // No vinculadas a otra orden
    },
    orderBy: { expenseDate: 'desc' },
    include: { category: { select: { id: true, name: true } } },
  });
}

// ── Crear ─────────────────────────────────────────────────────
export async function createPaymentOrder(data: CreatePaymentOrderInput, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: data.projectId } });
  if (!project)                    throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');
  if (project.status !== 'ACTIVE') throw new AppError(400, 'El proyecto debe estar activo', 'PROJECT_INACTIVE');

  const bene = await prisma.beneficiary.findUnique({ where: { id: data.beneficiaryId } });
  if (!bene || !bene.isActive) throw new AppError(404, 'Beneficiario no encontrado o inactivo', 'NOT_FOUND');

  // Validar nómina si aplica
  if (data.orderType === 'PAYROLL' && data.payrollId) {
    const payroll = await prisma.payroll.findUnique({ where: { id: data.payrollId } });
    if (!payroll)                   throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
    if (payroll.status !== 'APPROVED') throw new AppError(400, 'La nómina debe estar aprobada', 'PAYROLL_NOT_APPROVED');
    if (payroll.projectId !== data.projectId) throw new AppError(400, 'La nómina no pertenece a este proyecto', 'PROJECT_MISMATCH');
    // Verificar que no esté ya vinculada
    const existing = await prisma.paymentOrder.findFirst({ where: { payrollId: data.payrollId } });
    if (existing) throw new AppError(409, 'Esta nómina ya tiene una orden de pago vinculada', 'DUPLICATE');
  }

  const last   = await prisma.paymentOrder.findFirst({ orderBy: { number: 'desc' } });
  const number = (last?.number ?? 0) + 1;

  const projectLabel = `${project.code} — ${project.name}`;
  const generatedText = buildOrderText({
    payingCompany: data.payingCompany,
    currency:      data.currency ?? 'RD$',
    amount:        Number(data.amount),
    concept:       data.concept,
    project:       projectLabel,
    bank:          bene.bank,
    accountType:   bene.accountType,
    accountNumber: bene.accountNumber,
    holderName:    bene.name,
  });

  return prisma.paymentOrder.create({
    data: {
      number,
      orderType:     data.orderType ?? 'GENERAL',
      payingCompany: data.payingCompany,
      beneficiaryId: data.beneficiaryId,
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
  if (po.status === 'PAID' || po.status === 'VOIDED') {
    throw new AppError(400, 'No se puede editar una orden pagada o anulada', 'ORDER_CLOSED');
  }

  const bene    = await prisma.beneficiary.findUnique({ where: { id: data.beneficiaryId ?? po.beneficiaryId } });
  const project = await prisma.project.findUnique({ where: { id: data.projectId ?? po.projectId } });

  const merged = {
    payingCompany: data.payingCompany ?? po.payingCompany,
    currency:      data.currency      ?? po.currency,
    amount:        Number(data.amount ?? po.amount),
    concept:       data.concept       ?? po.concept,
    project:       `${project!.code} — ${project!.name}`,
    bank:          bene!.bank,
    accountType:   bene!.accountType,
    accountNumber: bene!.accountNumber,
    holderName:    bene!.name,
  };

  const { payrollId, ...rest } = data as any;

  return prisma.paymentOrder.update({
    where: { id },
    data:  { ...rest, generatedText: buildOrderText(merged) },
    include: INCLUDE,
  });
}

// ── Vincular gasto (materiales) ───────────────────────────────
export async function linkExpense(id: string, expenseId: string) {
  const po = await getPaymentOrderById(id);
  if (po.orderType !== 'MATERIALS') throw new AppError(400, 'Solo se puede vincular un gasto a órdenes de tipo Materiales', 'WRONG_TYPE');
  if (po.status === 'VOIDED')       throw new AppError(400, 'La orden está anulada', 'ORDER_VOIDED');
  if (po.expenseId)                 throw new AppError(409, 'Esta orden ya tiene un gasto vinculado', 'DUPLICATE');

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) throw new AppError(404, 'Gasto no encontrado', 'NOT_FOUND');
  if (expense.projectId !== po.projectId) throw new AppError(400, 'El gasto no pertenece al mismo proyecto', 'PROJECT_MISMATCH');
  if (expense.paymentMethod !== 'TRANSFER') throw new AppError(400, 'Solo se pueden vincular gastos pagados por transferencia', 'WRONG_PAYMENT_METHOD');

  // Verificar que el gasto no esté ya vinculado
  const existing = await prisma.paymentOrder.findFirst({ where: { expenseId } });
  if (existing) throw new AppError(409, 'Este gasto ya está vinculado a otra orden de pago', 'DUPLICATE');

  return prisma.paymentOrder.update({
    where: { id },
    data:  { expenseId },
    include: INCLUDE,
  });
}

// ── Desvincular gasto ─────────────────────────────────────────
export async function unlinkExpense(id: string) {
  await getPaymentOrderById(id);
  return prisma.paymentOrder.update({
    where: { id },
    data:  { expenseId: null },
    include: INCLUDE,
  });
}

// ── Marcar como pagada + auto-crear gasto ─────────────────────
export async function markAsPaid(id: string, userId: string) {
  const po = await getPaymentOrderById(id);
  if (po.status === 'PAID')   throw new AppError(400, 'La orden ya está marcada como pagada', 'ALREADY_PAID');
  if (po.status === 'VOIDED') throw new AppError(400, 'La orden está anulada', 'ORDER_VOIDED');

  // Categoría según tipo de orden
  const categoryName =
    po.orderType === 'PAYROLL'   ? 'Mano de obra' :
    po.orderType === 'MATERIALS' ? 'Materiales'   : 'Servicios';

  const category = await prisma.expenseCategory.findFirst({
    where: { name: categoryName, isActive: true },
  });
  if (!category) throw new AppError(500, 'Categoría de gasto no disponible', 'CATEGORY_NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    // 1. Marcar la orden como pagada
    await tx.paymentOrder.update({
      where: { id },
      data:  { status: 'PAID', paidAt: new Date(), paidById: userId },
    });

    // 2. Crear gasto solo si la orden no tiene uno ya vinculado
    if (!po.expenseId) {
      const opRef = `OP-${String(po.number).padStart(3, '0')}`;
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
          notes:         `Auto-generado al confirmar ${opRef}. Beneficiario: ${(po as any).beneficiary?.name ?? po.beneficiaryId}. Empresa: ${po.payingCompany}.`,
        },
      });

      // 3. Vincular el gasto recién creado a la orden
      await tx.paymentOrder.update({
        where: { id },
        data:  { expenseId: expense.id },
      });
    }

    // 4. Devolver la orden actualizada con todos los includes
    return tx.paymentOrder.findUniqueOrThrow({ where: { id }, include: INCLUDE });
  });
}

// ── Generar gasto retroactivo para una orden ya pagada ────────
export async function generateExpenseForOrder(id: string, userId: string) {
  const po = await getPaymentOrderById(id);
  if (po.status !== 'PAID') throw new AppError(400, 'Solo se puede generar gasto para órdenes pagadas', 'ORDER_NOT_PAID');
  if (po.expenseId)         throw new AppError(409, 'Esta orden ya tiene un gasto vinculado', 'ALREADY_HAS_EXPENSE');

  const categoryName =
    po.orderType === 'PAYROLL'   ? 'Mano de obra' :
    po.orderType === 'MATERIALS' ? 'Materiales'   : 'Servicios';

  const category = await prisma.expenseCategory.findFirst({
    where: { name: categoryName, isActive: true },
  });
  if (!category) throw new AppError(500, 'Categoría de gasto no disponible', 'CATEGORY_NOT_FOUND');

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
        notes:         `Generado retroactivamente para ${opRef}. Beneficiario: ${(po as any).beneficiary?.name ?? po.beneficiaryId}. Empresa: ${po.payingCompany}.`,
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

  return prisma.paymentOrder.update({
    where: { id },
    data:  { status: 'VOIDED' },
    include: INCLUDE,
  });
}

// ── Helper ────────────────────────────────────────────────────
function buildOrderText(p: {
  payingCompany: string; currency: string; amount: number;
  concept: string; project: string; bank: string;
  accountType: string; accountNumber: string; holderName: string;
}) {
  const monto = p.amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hoy   = new Date();
  const fecha = hoy.toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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
