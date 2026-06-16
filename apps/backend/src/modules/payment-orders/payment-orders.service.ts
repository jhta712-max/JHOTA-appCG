import prisma from '../../config/database';
import Anthropic from '@anthropic-ai/sdk';
import { resolveBatchItemId, BATCH_ITEM_SELECT } from '../../utils/batchItems';
import { AppError } from '../../middlewares/errorHandler';
import { buildPaginatedResponse, parsePagination } from '../../utils/pagination';
import { extractNCFType, isElectronicNCF } from '../../utils/fiscal.utils';
import { autoUpdateStatus as autoUpdateQuotationStatus } from '../quotations/quotations.service';
import { env } from '../../config/env';
import type { CreatePaymentOrderInput, UpdatePaymentOrderInput, PaymentOrderQuery } from './payment-orders.schema';
import type { Prisma } from '@prisma/client';

// ── Shared helper: build expense data for auto-generated expenses ─
interface ExpenseSourceData {
  projectId:          string;
  categoryId:         number;
  userId:             string;
  expenseDate:        Date | string;
  amount:             number | { toString(): string };
  description:        string;
  paymentMethod?:     string;
  hasFiscalDoc?:      boolean;
  notes?:             string | null;
  contratoAjustadoId?: string | null;
  batchItemId?:       string | null;
  foreignAmount?:     number | { toString(): string } | null;
  foreignCurrency?:   string | null;
  exchangeRate?:      number | { toString(): string } | null;
}

export function buildExpenseData(src: ExpenseSourceData): Prisma.ExpenseUncheckedCreateInput {
  return {
    projectId:          src.projectId,
    categoryId:         src.categoryId,
    userId:             src.userId,
    expenseDate:        new Date(src.expenseDate as string),
    amount:             Number(src.amount),
    description:        src.description,
    paymentMethod:      (src.paymentMethod ?? 'TRANSFER') as any,
    hasFiscalDoc:       src.hasFiscalDoc ?? false,
    ...(src.notes              != null ? { notes:          src.notes }                           : {}),
    ...(src.contratoAjustadoId != null ? { contratoAjustadoId: src.contratoAjustadoId }         : {}),
    ...(src.batchItemId        != null ? { batchItemId: src.batchItemId }                       : {}),
    ...(src.foreignAmount      != null ? { foreignAmount:  Number(src.foreignAmount) }           : {}),
    ...(src.foreignCurrency    != null ? { foreignCurrency: src.foreignCurrency }               : {}),
    ...(src.exchangeRate       != null ? { exchangeRate:   Number(src.exchangeRate) }            : {}),
  };
}

const aiClient = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

interface FiscalVoucherInput {
  ncf:          string;
  supplierRnc:  string;
  supplierName: string;
  itbisAmount?: number;
}

interface PaymentInfoInput {
  paymentBank?:           string | null;
  paymentReference?:      string | null;
  paymentMethod?:         string | null;
  exchangeRate?:          number | null;
  exchangeRateValidated?: boolean;
}

const INCLUDE = {
  supplier:               true,
  project:                { select: { id: true, code: true, name: true } },
  createdBy:              { select: { id: true, name: true } },
  paidBy:                 { select: { id: true, name: true } },
  exchangeRateValidator:  { select: { id: true, name: true } },
  payroll:                { select: { id: true, number: true, type: true, totalAmount: true, periodStart: true, periodEnd: true, status: true } },
  expense:                { select: { id: true, amount: true, expenseDate: true, description: true, status: true } },
  contratoAjustado:       { select: { id: true, descripcionTrabajo: true, montoContratado: true, estado: true } },
  batchItem:              BATCH_ITEM_SELECT,
} as const;

// ── Listar con filtros y paginación ───────────────────────────
export async function getPaymentOrders(
  query:   PaymentOrderQuery,
  userCtx: { userId: string; role: string },
) {
  const { page, limit, skip } = parsePagination(query);
  const { role, userId } = userCtx;

  const where: any = {};
  if (query.projectId)   where.projectId   = query.projectId;
  if (query.supplierId)  where.supplierId  = query.supplierId;
  if (query.orderType)   where.orderType   = query.orderType;
  if (query.createdById && role === 'admin') where.createdById = query.createdById;
  if (query.search) {
    where.OR = [
      { concept:       { contains: query.search, mode: 'insensitive' } },
      { payingCompany: { contains: query.search, mode: 'insensitive' } },
      { supplier:      { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  if (role === 'financiero') {
    // Financiero: all orders, respects status filter
    if (query.status) where.status = query.status;
  } else if (role === 'admin') {
    // Admin: all orders from any creator, defaults to PENDING
    where.status = query.status || 'PENDING';
  } else if (role === 'auxiliar') {
    // Auxiliar: sees all orders (same as financiero)
    if (query.status) where.status = query.status;
  } else {
    // Supervisor / operator / others: only their own PENDING
    where.createdById = userId;
    where.status      = 'PENDING';
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

  if (userCtx && userCtx.role !== 'admin' && userCtx.role !== 'financiero') {
    if (po.createdById !== userCtx.userId)
      throw new AppError(403, 'No tienes acceso a esta orden de pago', 'FORBIDDEN');
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

// ── Cotizaciones abiertas para proyecto+suplidor ──────────────
export async function getAvailableQuotations(projectId: string, supplierId?: string) {
  const openStatuses = ['PENDING', 'APPROVED', 'ADVANCE_PAID', 'IN_PROGRESS', 'PARTIAL_INVOICED', 'INVOICED'];
  const quotations = await prisma.quotation.findMany({
    where: {
      projectId,
      status: { in: openStatuses as any },
      ...(supplierId ? { supplierId } : {}),
    },
    orderBy: { quotationDate: 'desc' },
    select: {
      id: true, number: true, description: true, total: true, currency: true,
      status: true, quotationDate: true, supplierName: true, supplierId: true,
      paymentOrders: { where: { status: 'PAID' }, select: { amount: true } },
    },
  });
  return quotations.map((q) => {
    const total       = parseFloat(q.total.toString());
    const totalPagado = q.paymentOrders.reduce((s, po) => s + parseFloat(po.amount.toString()), 0);
    return { id: q.id, number: q.number, description: q.description, total, currency: q.currency, status: q.status, quotationDate: q.quotationDate, supplierName: q.supplierName, supplierId: q.supplierId, totalPagado, pendiente: total - totalPagado };
  });
}

// ── Contratos ajustados ACTIVOS para proyecto+suplidor ────────
export async function getAvailableContracts(projectId: string, supplierId: string) {
  const contratos = await prisma.contratoAjustado.findMany({
    where:   { projectId, supplierId, estado: 'ACTIVO' },
    orderBy: { fechaContrato: 'desc' },
    select:  {
      id: true, descripcionTrabajo: true, montoContratado: true, fechaContrato: true,
      adendas:       { select: { monto: true } },
      paymentOrders: { where: { status: 'PAID' }, select: { amount: true } },
    },
  });
  return contratos.map((c) => {
    const montoBase   = parseFloat(c.montoContratado.toString());
    const adendas     = c.adendas.reduce((s, a) => s + parseFloat(a.monto.toString()), 0);
    const montoTotal  = montoBase + adendas;
    const totalPagado = c.paymentOrders.reduce((s, po) => s + parseFloat(po.amount.toString()), 0);
    return { id: c.id, descripcionTrabajo: c.descripcionTrabajo, montoContratado: montoTotal, montoBase, adendas, fechaContrato: c.fechaContrato, totalPagado, pendiente: montoTotal - totalPagado };
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

  const batchItemId = await resolveBatchItemId(data.projectId, (data as any).batchItemId ?? (data as any).projectItemId);

  const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
  if (!supplier || !supplier.isActive) throw new AppError(404, 'Suplidor no encontrado o inactivo', 'NOT_FOUND');

  // Resolve bank account: explicit selection → default → first → legacy fields
  let bankAccount: { bank: string; accountType: string | null; accountNumber: string } | null = null;
  if (data.bankAccountId) {
    bankAccount = await prisma.supplierBankAccount.findFirst({ where: { id: data.bankAccountId, supplierId: data.supplierId } });
    if (!bankAccount) throw new AppError(404, 'Cuenta bancaria no encontrada', 'BANK_ACCOUNT_NOT_FOUND');
  } else {
    bankAccount = await prisma.supplierBankAccount.findFirst({
      where:   { supplierId: data.supplierId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (!bankAccount && supplier.bank && supplier.accountNumber) {
      bankAccount = { bank: supplier.bank, accountType: supplier.accountType, accountNumber: supplier.accountNumber };
    }
  }
  if (!bankAccount)
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
    bank:          bankAccount.bank,
    accountType:   bankAccount.accountType ?? '',
    accountNumber: bankAccount.accountNumber,
    holderName:    supplier.name,
    cedula:        supplier.cedula,
    rnc:           supplier.rnc,
  });

  // Validate contrato ajustado if provided
  if (data.contratoAjustadoId) {
    const contrato = await prisma.contratoAjustado.findUnique({ where: { id: data.contratoAjustadoId } });
    if (!contrato) throw new AppError(404, 'Contrato ajustado no encontrado', 'NOT_FOUND');
    if (contrato.projectId !== data.projectId || contrato.supplierId !== data.supplierId)
      throw new AppError(400, 'El contrato no pertenece a este proyecto/suplidor', 'CONTRACT_MISMATCH');
  }

  // Validate quotation if provided
  if (data.quotationId) {
    const quotation = await prisma.quotation.findUnique({ where: { id: data.quotationId } });
    if (!quotation) throw new AppError(404, 'Cotización no encontrada', 'NOT_FOUND');
    if (quotation.projectId !== data.projectId)
      throw new AppError(400, 'La cotización no pertenece a este proyecto', 'QUOTATION_MISMATCH');
  }

  // ── AUTO-CREATE PAYROLL when type=PAYROLL + payrollData ──────
  if (data.orderType === 'PAYROLL' && data.payrollData) {
    const payrollLast = await prisma.payroll.findFirst({ where: { projectId: data.projectId }, orderBy: { number: 'desc' } });
    const payrollNumber = (payrollLast?.number ?? 0) + 1;

    const categoryName = data.payrollData.type === 'LABOR' ? 'Mano de obra' : 'Servicios';
    let category = await prisma.expenseCategory.findFirst({
      where: { name: { contains: categoryName, mode: 'insensitive' }, isActive: true },
    });
    if (!category) {
      category = await prisma.expenseCategory.upsert({
        where:  { name: categoryName },
        update: { isActive: true },
        create: { name: categoryName, description: 'Auto-creada para nóminas', isActive: true },
      });
    }

    return prisma.$transaction(async (tx) => {
      // 1. Crear nómina directamente en APPROVED (sin pasar por DRAFT)
      const payroll = await tx.payroll.create({
        data: {
          projectId:   data.projectId,
          number:      payrollNumber,
          periodStart: new Date(data.payrollData!.periodStart),
          periodEnd:   new Date(data.payrollData!.periodEnd),
          type:        data.payrollData!.type,
          description: data.concept,
          totalAmount:  Number(data.amount),
          status:      'APPROVED',
          approvedById: userId,
          approvedAt:  new Date(),
          createdById: userId,
          lines: {
            create: [{
              lineNumber:   1,
              description:  data.concept,
              quantity:     1,
              unit:         'Global',
              unitPrice:    Number(data.amount),
              subtotal:     Number(data.amount),
              supplierName: supplier.name,
              bankName:     bankAccount!.bank,
              bankAccount:  bankAccount!.accountNumber,
            }],
          },
        },
        include: { lines: true },
      });

      // 2. Crear gasto para la línea de nómina
      const nomRef = `NOM-${String(payrollNumber).padStart(3, '0')}`;
      const expense = await tx.expense.create({
        data: {
          projectId:          data.projectId,
          categoryId:         category!.id,
          userId,
          expenseDate:        new Date(data.payrollData!.periodEnd),
          amount:             Number(data.amount),
          description:        `${nomRef} — ${supplier.name}: ${data.concept}`,
          paymentMethod:      'TRANSFER',
          hasFiscalDoc:       false,
          notes:              `Auto-generado al crear orden de pago de nómina ${nomRef}.`,
          contratoAjustadoId: data.contratoAjustadoId ?? null,
          batchItemId:        batchItemId ?? null,
        },
      });

      // 3. Vincular gasto a la línea de nómina
      const line = payroll.lines[0];
      if (line) {
        await tx.payrollLine.update({ where: { id: line.id }, data: { expenseId: expense.id } });
      }

      // 4. Si hay contrato ajustado, registrar avance
      if (data.contratoAjustadoId) {
        await tx.contratoAjustadoPago.create({
          data: {
            contratoAjustadoId: data.contratoAjustadoId,
            nominaId:           payroll.id,
            gastoId:            expense.id,
            monto:              Number(data.amount),
            fecha:              new Date(data.payrollData!.periodEnd),
            creadoPorId:        userId,
          },
        });
      }

      // 5. Crear orden de pago vinculada a la nómina recién creada
      return tx.paymentOrder.create({
        data: {
          number,
          orderType:          'PAYROLL',
          payingCompany:      data.payingCompany,
          supplierId:         data.supplierId,
          projectId:          data.projectId,
          amount:             data.amount,
          currency:           data.currency ?? 'RD$',
          concept:            data.concept,
          notes:              data.notes,
          generatedText,
          payrollId:          payroll.id,
          contratoAjustadoId: data.contratoAjustadoId ?? null,
          quotationId:        null,
          batchItemId:        batchItemId ?? null,
          creditLineId:       data.creditLineId ?? null,
          createdById:        userId,
        },
        include: INCLUDE,
      });
    });
  }

  return prisma.paymentOrder.create({
    data: {
      number,
      orderType:          data.orderType ?? 'SERVICIO',
      payingCompany:      data.payingCompany,
      supplierId:         data.supplierId,
      projectId:          data.projectId,
      amount:             data.amount,
      currency:           data.currency ?? 'RD$',
      concept:            data.concept,
      notes:              data.notes,
      generatedText,
      payrollId:          data.orderType === 'PAYROLL' ? (data.payrollId ?? null) : null,
      contratoAjustadoId: data.contratoAjustadoId ?? null,
      quotationId:        data.orderType === 'SERVICIO' ? (data.quotationId ?? null) : null,
      batchItemId:        batchItemId ?? null,
      creditLineId:       data.creditLineId ?? null,
      createdById:        userId,
    },
    include: INCLUDE,
  });
}

// ── Actualizar ────────────────────────────────────────────────
export async function updatePaymentOrder(id: string, data: UpdatePaymentOrderInput, userRole?: string) {
  const po = await getPaymentOrderById(id);
  if (po.status === 'VOIDED')
    throw new AppError(400, 'No se puede editar una orden anulada', 'ORDER_VOIDED');
  if (po.status === 'PAID' && userRole !== 'admin')
    throw new AppError(400, 'Solo un administrador puede editar una orden pagada', 'ORDER_CLOSED');

  const supplierId = data.supplierId ?? po.supplierId;
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  const project  = await prisma.project.findUnique({ where: { id: data.projectId ?? po.projectId } });

  // Resolve bank account for regenerated text
  const bankAccount =
    await prisma.supplierBankAccount.findFirst({ where: { supplierId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] })
    ?? (supplier?.bank ? { bank: supplier.bank, accountType: supplier.accountType, accountNumber: supplier.accountNumber! } : null)
    ?? { bank: (po.supplier as any).bank ?? '', accountType: (po.supplier as any).accountType ?? '', accountNumber: (po.supplier as any).accountNumber ?? '' };

  const merged = {
    payingCompany: data.payingCompany ?? po.payingCompany,
    currency:      data.currency      ?? po.currency,
    amount:        Number(data.amount ?? po.amount),
    concept:       data.concept       ?? po.concept,
    project:       `${project!.code} — ${project!.name}`,
    bank:          bankAccount.bank,
    accountType:   bankAccount.accountType ?? '',
    accountNumber: bankAccount.accountNumber ?? '',
    holderName:    supplier!.name,
    cedula:        supplier!.cedula,
    rnc:           supplier!.rnc,
  };

  const { payrollId, batchItemId: rawItemId, projectItemId: _legacyItemId, ...rest } = data as any;

  const resolvedItemId = rawItemId !== undefined
    ? await resolveBatchItemId(po.projectId, rawItemId, { inherited: true })
    : _legacyItemId !== undefined
    ? await resolveBatchItemId(po.projectId, _legacyItemId, { inherited: true })
    : undefined;

  return prisma.paymentOrder.update({
    where:   { id },
    data:    {
      ...rest,
      generatedText: buildOrderText(merged),
      ...(resolvedItemId !== undefined && { batchItemId: resolvedItemId }),
    },
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
export async function markAsPaid(id: string, userId: string, fiscalVoucher?: FiscalVoucherInput | null, paymentInfo?: PaymentInfoInput | null) {
  const po = await getPaymentOrderById(id);
  if (po.status === 'PAID')   throw new AppError(400, 'La orden ya está marcada como pagada', 'ALREADY_PAID');
  if (po.status === 'VOIDED') throw new AppError(400, 'La orden está anulada', 'ORDER_VOIDED');

  const result = await prisma.$transaction(async (tx) => {
    await tx.paymentOrder.update({
      where: { id },
      data: {
        status:                  'PAID',
        paidAt:                  new Date(),
        paidById:                userId,
        paymentBank:             paymentInfo?.paymentBank      ?? null,
        paymentReference:        paymentInfo?.paymentReference ?? null,
        paymentMethod:           (paymentInfo?.paymentMethod ?? 'TRANSFER') as any,
        exchangeRate:            paymentInfo?.exchangeRate ?? null,
        exchangeRateValidatedBy: (paymentInfo?.exchangeRate != null && paymentInfo?.exchangeRateValidated)
                                   ? userId : null,
        exchangeRateValidatedAt: (paymentInfo?.exchangeRate != null && paymentInfo?.exchangeRateValidated)
                                   ? new Date() : null,
      },
    });

    // When paying a PAYROLL order, also mark the linked payroll as PAID
    if (po.orderType === 'PAYROLL' && (po as any).payrollId) {
      const payroll = await tx.payroll.findUnique({ where: { id: (po as any).payrollId } });
      if (payroll && payroll.status === 'APPROVED') {
        await tx.payroll.update({
          where: { id: (po as any).payrollId },
          data: {
            status:           'PAID',
            paidAt:           new Date(),
            paymentMethod:    paymentInfo?.paymentBank ? 'TRANSFER' : 'CASH',
            paymentDate:      new Date(),
            paymentBank:      paymentInfo?.paymentBank      ?? null,
            paymentReference: paymentInfo?.paymentReference ?? null,
          },
        });
      }
    }

    // Auto-record credit payment if linked to a credit line
    if ((po as any).creditLineId) {
      const dateStr = new Date().toISOString().split('T')[0];
      await tx.supplierCreditPayment.create({
        data: {
          creditLineId:  (po as any).creditLineId,
          amount:        Number(po.amount),
          paymentDate:   new Date(dateStr),
          paymentMethod: (paymentInfo?.paymentMethod ?? 'TRANSFER') as any,
          reference:     paymentInfo?.paymentReference ?? null,
          notes:         `Auto-registrado desde Orden de Pago #${po.number ?? po.id}`,
          createdById:   userId,
        },
      });
    }

    if (!po.expenseId && po.orderType !== 'PAYROLL') {
      const categoryName = po.orderType === 'MATERIALS' ? 'Materiales' : po.orderType === 'PETTY_CASH' ? 'Caja Chica' : 'Servicios';
      const category = await tx.expenseCategory.upsert({
        where:  { name: categoryName },
        update: { isActive: true },
        create: { name: categoryName, description: 'Auto-creada para órdenes de pago', isActive: true },
      });

      const opRef      = `OP-${String(po.number).padStart(3, '0')}`;
      const hasFiscal  = !!(fiscalVoucher?.ncf);

      // Resolve amount: if foreign currency, convert to DOP using exchangeRate
      const isForeign      = po.currency !== 'RD$';
      const exchangeRate   = paymentInfo?.exchangeRate ?? null;
      const amountDOP      = isForeign && exchangeRate
        ? Number(po.amount) * exchangeRate
        : Number(po.amount);
      // Map order currency symbol to ISO code for Expense model
      const foreignCurrencyISO = po.currency === 'US$' ? 'USD' : po.currency === '€' ? 'EUR' : null;

      const expense = await tx.expense.create({
        data: {
          ...buildExpenseData({
            projectId:          po.projectId,
            categoryId:         category.id,
            userId,
            expenseDate:        new Date(),
            amount:             amountDOP,
            description:        `[${opRef}] ${po.concept}`,
            paymentMethod:      paymentInfo?.paymentMethod ?? 'TRANSFER',
            hasFiscalDoc:       hasFiscal,
            notes:              `Auto-generado al confirmar ${opRef}. Suplidor: ${(po as any).supplier?.name ?? po.supplierId}. Empresa: ${po.payingCompany}.${isForeign ? ` Divisa original: ${po.currency} ${Number(po.amount).toFixed(2)}${exchangeRate ? ` (TC: ${exchangeRate})` : ''}.` : ''}`,
            contratoAjustadoId: (po as any).contratoAjustadoId ?? null,
            batchItemId:        (po as any).batchItemId ?? null,
            ...(isForeign && foreignCurrencyISO ? {
              foreignAmount:   po.amount,
              foreignCurrency: foreignCurrencyISO,
              exchangeRate:    exchangeRate ?? undefined,
            } : {}),
          }),
          ...(hasFiscal && fiscalVoucher ? {
            fiscalVoucher: {
              create: {
                ncf:          fiscalVoucher.ncf,
                ncfType:      extractNCFType(fiscalVoucher.ncf),
                isElectronic: isElectronicNCF(fiscalVoucher.ncf),
                supplierRnc:  fiscalVoucher.supplierRnc,
                supplierName: fiscalVoucher.supplierName,
                itbisAmount:  fiscalVoucher.itbisAmount ?? 0,
              },
            },
          } : {}),
        } as any,
      });

      // Link expense to quotation if this SERVICIO order has a quotation linked
      if ((po as any).quotationId) {
        // Also create a QuotationPayment so it appears in the cotización module
        const quotation = await tx.quotation.findUnique({ where: { id: (po as any).quotationId } });
        if (quotation) {
          const lastPayment = await tx.quotationPayment.findFirst({
            where:   { quotationId: (po as any).quotationId },
            orderBy: { sequence: 'desc' },
          });
          const nextSeq = (lastPayment?.sequence ?? 0) + 1;

          // Amount in quotation currency: use po.amount directly if currencies match,
          // otherwise store the foreign amount (quotation curator resolves equivalence)
          const quotationAmount = isForeign && exchangeRate
            ? amountDOP  // store DOP equivalent so totals add up in quotation
            : Number(po.amount);

          await tx.quotationPayment.create({
            data: {
              quotationId:   (po as any).quotationId,
              expenseId:     expense.id,
              sequence:      nextSeq,
              amount:        quotationAmount,
              paymentDate:   new Date(),
              paymentMethod: 'TRANSFER',
              description:   `Pago desde ${opRef}${isForeign ? ` (${po.currency} ${Number(po.amount).toFixed(2)}${exchangeRate ? ` × TC ${exchangeRate}` : ''})` : ''}`,
              notes:         isForeign ? `Divisa: ${po.currency} ${Number(po.amount).toFixed(2)}${exchangeRate ? `. Tasa de cambio: 1 ${po.currency} = RD$ ${exchangeRate}` : ''}` : null,
              createdById:   userId,
            },
          });
        }

        await tx.quotationExpenseLink.create({
          data: {
            quotationId: (po as any).quotationId,
            expenseId:   expense.id,
            linkType:    'PARTIAL_INVOICE',
            notes:       `Auto-vinculado desde ${opRef}${isForeign ? ` | ${po.currency} ${Number(po.amount).toFixed(2)}` : ''}`,
            createdById: userId,
          },
        });
      }

      // Register advance in contrato ajustado if linked
      if ((po as any).contratoAjustadoId) {
        await tx.contratoAjustadoPago.create({
          data: {
            contratoAjustadoId: (po as any).contratoAjustadoId,
            ordenPagoId:        po.id,
            gastoId:            expense.id,
            monto:              po.amount,
            fecha:              new Date(),
            creadoPorId:        userId,
          },
        });
      }

      await tx.paymentOrder.update({ where: { id }, data: { expenseId: expense.id } });
    }

    return tx.paymentOrder.findUniqueOrThrow({ where: { id }, include: INCLUDE });
  });

  // Auto-update quotation status outside the transaction (needs fresh reads)
  if ((po as any).quotationId) {
    await autoUpdateQuotationStatus((po as any).quotationId).catch(() => {});
  }

  return result;
}

// ── Generar gasto retroactivo ─────────────────────────────────
export async function generateExpenseForOrder(id: string, userId: string) {
  const po = await getPaymentOrderById(id);
  if (po.status !== 'PAID')       throw new AppError(400, 'Solo se puede generar gasto para órdenes pagadas', 'ORDER_NOT_PAID');
  if (po.expenseId)               throw new AppError(409, 'Esta orden ya tiene un gasto vinculado', 'ALREADY_HAS_EXPENSE');
  if (po.orderType === 'PAYROLL') throw new AppError(400, 'Las órdenes de nómina no generan gasto individual', 'PAYROLL_NO_EXPENSE');

  const categoryName = po.orderType === 'MATERIALS' ? 'Materiales' : po.orderType === 'PETTY_CASH' ? 'Caja Chica' : 'Servicios';
  const category = await prisma.expenseCategory.upsert({
    where:  { name: categoryName },
    update: { isActive: true },
    create: { name: categoryName, description: 'Auto-creada para órdenes de pago', isActive: true },
  });

  return prisma.$transaction(async (tx) => {
    const opRef = `OP-${String(po.number).padStart(3, '0')}`;
    const expense = await tx.expense.create({
      data: buildExpenseData({
        projectId:          po.projectId,
        categoryId:         category.id,
        userId,
        expenseDate:        po.paidAt ?? new Date(),
        amount:             po.amount,
        description:        `[${opRef}] ${po.concept}`,
        notes:              `Generado retroactivamente para ${opRef}. Suplidor: ${(po as any).supplier?.name ?? po.supplierId}.`,
        contratoAjustadoId: (po as any).contratoAjustadoId ?? null,
        batchItemId:        (po as any).batchItemId ?? null,
      }),
    });

    if ((po as any).contratoAjustadoId) {
      await tx.contratoAjustadoPago.create({
        data: {
          contratoAjustadoId: (po as any).contratoAjustadoId,
          ordenPagoId:        po.id,
          gastoId:            expense.id,
          monto:              po.amount,
          fecha:              po.paidAt ?? new Date(),
          creadoPorId:        userId,
        },
      });
    }

    await tx.paymentOrder.update({ where: { id }, data: { expenseId: expense.id } });
    return tx.paymentOrder.findUniqueOrThrow({ where: { id }, include: INCLUDE });
  });
}

// ── Revertir a PENDING (cuando gasto vinculado fue rechazado) ─
export async function revertToPending(id: string) {
  const po = await getPaymentOrderById(id);
  if (po.status !== 'PAID') throw new AppError(400, 'Solo se pueden revertir órdenes pagadas', 'INVALID_STATUS');

  // Only allow revert if the linked expense is REJECTED (or there's no expense)
  if (po.expenseId) {
    const expense = await prisma.expense.findUnique({ where: { id: po.expenseId } });
    if (expense && expense.status !== 'REJECTED') {
      throw new AppError(400, 'Solo se puede revertir si el gasto vinculado fue rechazado', 'EXPENSE_NOT_REJECTED');
    }
  }

  return prisma.paymentOrder.update({
    where:   { id },
    data:    { status: 'PENDING', paidAt: null, paidById: null, paymentBank: null, paymentReference: null },
    include: INCLUDE,
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

// ── Sugerir concepto con IA ───────────────────────────────────
export async function suggestConcept(input: {
  orderType: string;
  supplierName?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  amount?: number | null;
  currency?: string | null;
}): Promise<{ concept: string }> {
  const fallback = buildFallbackConcept(input);
  if (!aiClient) return { concept: fallback };

  const typeLabel = input.orderType === 'SERVICIO' ? 'servicio' : input.orderType === 'MATERIALS' ? 'materiales/insumos' : input.orderType === 'PETTY_CASH' ? 'caja chica' : 'nómina';

  try {
    const msg = await aiClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Genera un concepto conciso (máx 15 palabras) para una orden de pago de construcción en República Dominicana.
Tipo: ${typeLabel}
Suplidor: ${input.supplierName ?? 'No especificado'}
Proyecto: ${input.projectCode ? `${input.projectCode} – ${input.projectName ?? ''}` : 'No especificado'}
Monto: ${input.currency ?? 'RD$'} ${input.amount?.toLocaleString('es-DO') ?? '0'}

Solo el texto del concepto, sin comillas ni explicaciones. Ejemplo: "Pago por suministro de materiales pétreos para proyecto Santiago"`,
      }],
    });
    const text = ((msg.content[0] as any).text ?? '').trim().replace(/^["']|["']$/g, '');
    return { concept: text || fallback };
  } catch {
    return { concept: fallback };
  }
}

function buildFallbackConcept(input: { orderType: string; supplierName?: string | null; projectCode?: string | null; projectName?: string | null }) {
  const type = input.orderType === 'SERVICIO' ? 'Pago por servicios' : input.orderType === 'MATERIALS' ? 'Pago por materiales' : input.orderType === 'PETTY_CASH' ? 'Pago de caja chica' : 'Pago de nómina';
  const parts = [type];
  if (input.supplierName) parts.push(`a ${input.supplierName}`);
  if (input.projectCode)  parts.push(`— Proyecto ${input.projectCode}`);
  return parts.join(' ');
}

// ── Helper ────────────────────────────────────────────────────
function buildOrderText(p: {
  payingCompany: string; currency: string; amount: number;
  concept: string; project: string; bank: string;
  accountType: string; accountNumber: string; holderName: string;
  cedula?: string | null; rnc?: string | null;
}) {
  const monto = p.amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fecha = new Date().toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const identificacion = p.cedula || p.rnc;

  return [
    p.payingCompany,
    `💰 ${p.currency} ${monto}`,
    `📌 Concepto: ${p.concept}`,
    `📍 Proyecto: ${p.project}`,
    `Banco: ${p.bank}`,
    `${p.accountType}: ${p.accountNumber}`,
    `nombre: ${p.holderName}`,
    ...(identificacion ? [`Cédula/RNC: ${identificacion}`] : []),
    `📅 Fecha: ${fecha.charAt(0).toUpperCase() + fecha.slice(1)}`,
  ].join('\n');
}
