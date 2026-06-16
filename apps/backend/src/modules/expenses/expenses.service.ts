import prisma from '../../config/database';
import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../../middlewares/errorHandler';
import { buildPaginatedResponse, parsePagination } from '../../utils/pagination';
import { extractNCFType, isElectronicNCF } from '../../utils/fiscal.utils';
import { createNotification } from '../notifications/notifications.service';
import { logAudit } from '../../services/audit.service';
import { env } from '../../config/env';
import { resolveBatchItemId, BATCH_ITEM_SELECT } from '../../utils/batchItems';
import type { CreateExpenseInput, UpdateExpenseInput, VoidExpenseInput, ExpenseQuery } from './expenses.schema';

const aiClient = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

const EXPENSE_INCLUDE = {
  project:      { select: { id: true, code: true, name: true } },
  category:     { select: { id: true, name: true, icon: true } },
  registeredBy: { select: { id: true, name: true } },
  companyCard:  { select: { id: true, holderName: true, lastFour: true, cardType: true, bank: true } },
  approvedBy:   { select: { id: true, name: true } },
  rejectedBy:   { select: { id: true, name: true } },
  fiscalVoucher: true,
  attachments:  { select: { id: true, fileName: true, mimeType: true, isPrimary: true, createdAt: true } },
  paymentOrder: { select: { id: true, paymentBank: true, paymentReference: true, paidAt: true } },
  batchItem:    BATCH_ITEM_SELECT,
  creditLine: {
    select: {
      id: true,
      supplierId: true,
      creditLimit: true,
      supplier: { select: { name: true } },
    },
  },
} as const;

// Roles que requieren aprobación al crear gastos
// Solo operadores necesitan aprobación. Supervisores y admin auto-aprueban.
// Además, gastos con comprobante fiscal se auto-aprueban (validación externa)
const ROLES_NEED_APPROVAL = new Set(['operator']);

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

  // Lógica de aprobación:
  // - Con comprobante fiscal: ACTIVE (validación externa)
  // - Sin comprobante y rol que necesita aprobación: PENDING_APPROVAL
  // - Sino: ACTIVE
  const needsApproval = !data.hasFiscalDoc && ROLES_NEED_APPROVAL.has(userRole ?? '');
  const status = needsApproval ? 'PENDING_APPROVAL' : 'ACTIVE';

  // Validate credit line if provided
  if (data.creditLineId) {
    const line = await prisma.supplierCreditLine.findUnique({
      where: { id: data.creditLineId },
    });
    if (!line || !line.isActive) {
      throw new AppError(400, 'Línea de crédito no encontrada o inactiva', 'INVALID_CREDIT_LINE');
    }
  }

  const batchItemId = await resolveBatchItemId(data.projectId, data.batchItemId ?? data.projectItemId);

  const expense = await prisma.expense.create({
    data: {
      projectId:     data.projectId,
      categoryId:    data.categoryId,
      userId,
      expenseDate:   new Date(data.expenseDate),
      amount:        data.amount,
      description:   data.description,
      paymentMethod: data.paymentMethod,
      companyCardId:   data.companyCardId   ?? null,
      hasFiscalDoc:    data.hasFiscalDoc,
      notes:           data.notes,
      status,
      batchItemId:     batchItemId ?? null,
      foreignAmount:   data.foreignAmount   ?? null,
      foreignCurrency: data.foreignCurrency ?? null,
      exchangeRate:    data.exchangeRate    ?? null,
      creditLineId:    data.creditLineId    ?? null,
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

  // Notificar a financiero y admin si el gasto requiere aprobación
  if (needsApproval) {
    const approvers = await prisma.user.findMany({
      where: { isActive: true, role: { name: { in: ['admin', 'financiero'] } } },
      select: { id: true },
    });
    const title   = 'Gasto pendiente de aprobación';
    const message = `${expense.registeredBy.name} registró un gasto de RD $${Number(expense.amount).toLocaleString('es-DO')} en ${expense.project.name}.`;
    const link    = `/expenses/${expense.id}`;
    for (const u of approvers) {
      await createNotification({ userId: u.id, type: 'EXPENSE_PENDING', title, message, link, entityId: expense.id });
    }
  }

  logAudit({ tableName: 'expenses', recordId: expense.id, action: 'INSERT', userId,
    newData: { amount: expense.amount, description: expense.description, expenseDate: expense.expenseDate, status: expense.status } });

  return expense;
}

// ---------------------------------------------------------------
// Actualizar gasto
// ---------------------------------------------------------------
export async function updateExpense(id: string, data: UpdateExpenseInput, userId: string, userRole: string) {
  const expense = await getExpenseById(id);

  if (expense.status === 'VOIDED') {
    throw new AppError(400, 'No se puede editar un gasto anulado', 'EXPENSE_VOIDED');
  }
  if (expense.status === 'ACTIVE' && !['admin', 'supervisor'].includes(userRole)) {
    throw new AppError(403, 'No puedes editar un gasto ya aprobado', 'FORBIDDEN');
  }

  // Operadores y supervisores pueden editar sus propios gastos rechazados o pendientes
  if (['operator', 'supervisor'].includes(userRole)) {
    if (expense.userId !== userId) {
      throw new AppError(403, 'Solo puedes editar tus propios gastos', 'FORBIDDEN');
    }
    if (expense.status === 'ACTIVE') {
      throw new AppError(403, 'No puedes editar un gasto ya aprobado', 'FORBIDDEN');
    }
  }

  // Operadores: ventana de 24h solo para gastos PENDING (no para REJECTED, que siempre pueden corregir)
  if (userRole === 'operator' && expense.status === 'PENDING_APPROVAL') {
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

  // Validate credit line if being changed
  if (data.creditLineId !== undefined) {
    if (data.creditLineId !== null) {
      const line = await prisma.supplierCreditLine.findUnique({
        where: { id: data.creditLineId },
      });
      if (!line || !line.isActive) {
        throw new AppError(400, 'Línea de crédito no encontrada o inactiva', 'INVALID_CREDIT_LINE');
      }
    }
  }

  const { fiscalVoucher, batchItemId: rawItemId, projectItemId: _legacyItemId, ...expenseData } = data;

  const resolvedItemId = await resolveBatchItemId(
    expense.projectId,
    rawItemId !== undefined ? rawItemId : (expense as any).batchItemId,
    { inherited: true },
  );

  // Si el gasto estaba REJECTED y se edita, vuelve a PENDING_APPROVAL
  const statusReset = expense.status === 'REJECTED'
    ? { status: 'PENDING_APPROVAL' as const, rejectionReason: null, rejectedById: null, rejectedAt: null }
    : {};

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      ...expenseData,
      batchItemId: resolvedItemId,
      expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
      ...fiscalVoucherOp,
      ...statusReset,
    },
    include: EXPENSE_INCLUDE,
  });
  logAudit({ tableName: 'expenses', recordId: id, action: 'UPDATE', userId,
    oldData: { amount: expense.amount, description: expense.description, expenseDate: expense.expenseDate, status: expense.status },
    newData: { amount: updated.amount, description: updated.description, expenseDate: updated.expenseDate, status: updated.status } });
  return updated;
}

// ---------------------------------------------------------------
// Aprobar gasto
// ---------------------------------------------------------------
export async function approveExpense(id: string, approverId: string) {
  const expense = await getExpenseById(id);
  if (expense.status !== 'PENDING_APPROVAL') {
    throw new AppError(400, 'Solo se pueden aprobar gastos pendientes', 'INVALID_STATUS');
  }
  const updated = await prisma.expense.update({
    where: { id },
    data:  { status: 'ACTIVE', approvedById: approverId, approvedAt: new Date() },
    include: EXPENSE_INCLUDE,
  });
  // Notificar al creador
  await createNotification({
    userId:   expense.userId,
    type:     'EXPENSE_APPROVED',
    title:    'Gasto aprobado',
    message:  `Tu gasto de RD $${Number(expense.amount).toLocaleString('es-DO')} fue aprobado.`,
    link:     `/expenses/${id}`,
    entityId: id,
  });
  logAudit({ tableName: 'expenses', recordId: id, action: 'UPDATE', userId: approverId,
    oldData: { status: 'PENDING_APPROVAL' }, newData: { status: 'ACTIVE', approvedById: approverId } });
  return updated;
}

// ---------------------------------------------------------------
// Rechazar gasto
// ---------------------------------------------------------------
export async function rejectExpense(id: string, rejectorId: string, reason: string) {
  const expense = await getExpenseById(id);
  if (expense.status !== 'PENDING_APPROVAL') {
    throw new AppError(400, 'Solo se pueden rechazar gastos pendientes', 'INVALID_STATUS');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const rejectedExpense = await tx.expense.update({
      where:   { id },
      data:    { status: 'REJECTED', rejectedById: rejectorId, rejectedAt: new Date(), rejectionReason: reason },
      include: EXPENSE_INCLUDE,
    });

    // Si el gasto está vinculado a una orden de pago, revertirla a PENDING
    const linkedOrder = await tx.paymentOrder.findFirst({ where: { expenseId: id } });
    if (linkedOrder && linkedOrder.status === 'PAID') {
      await tx.paymentOrder.update({
        where: { id: linkedOrder.id },
        data:  {
          status:           'PENDING',
          paidAt:           null,
          paidById:         null,
          paymentBank:      null,
          paymentReference: null,
        },
      });
    }

    return rejectedExpense;
  });

  // Notificar al creador
  await createNotification({
    userId:   expense.userId,
    type:     'EXPENSE_REJECTED',
    title:    'Gasto rechazado',
    message:  `Tu gasto de RD $${Number(expense.amount).toLocaleString('es-DO')} fue rechazado. Motivo: ${reason}`,
    link:     `/expenses/${id}`,
    entityId: id,
  });
  logAudit({ tableName: 'expenses', recordId: id, action: 'UPDATE', userId: rejectorId,
    oldData: { status: 'PENDING_APPROVAL' }, newData: { status: 'REJECTED', rejectionReason: reason } });
  return updated;
}

// ---------------------------------------------------------------
// Anular gasto
// ---------------------------------------------------------------
export async function voidExpense(id: string, data: VoidExpenseInput, userId: string) {
  const expense = await getExpenseById(id);
  if (expense.status === 'VOIDED') {
    throw new AppError(400, 'El gasto ya está anulado', 'ALREADY_VOIDED');
  }
  const voided = await prisma.expense.update({
    where: { id },
    data: {
      status:     'VOIDED',
      voidedAt:   new Date(),
      voidedById: userId,
      voidReason: data.reason,
    },
    include: EXPENSE_INCLUDE,
  });
  logAudit({ tableName: 'expenses', recordId: id, action: 'UPDATE', userId,
    oldData: { status: expense.status }, newData: { status: 'VOIDED', voidReason: data.reason } });
  return voided;
}

// ── Borrado permanente (solo admin) ───────────────────────────
export async function hardDeleteExpense(id: string) {
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) throw new AppError(404, 'Gasto no encontrado', 'NOT_FOUND');
  // Eliminar registros dependientes primero
  await prisma.fiscalVoucher.deleteMany({ where: { expenseId: id } });
  await prisma.attachment.deleteMany({ where: { expenseId: id } });
  // Desvincular de órdenes de pago sin borrarlas
  await prisma.paymentOrder.updateMany({ where: { expenseId: id }, data: { expenseId: null } });
  await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ── Importación masiva desde CSV ──────────────────────────────
export interface BulkExpenseRow {
  fecha:        string;   // YYYY-MM-DD
  descripcion:  string;
  proveedor?:   string;
  categoria:    string;   // nombre de categoría
  monto:        number;
  metodo_pago?: string;   // CASH | TRANSFER | CARD | CHECK | OTHER
  proyecto:     string;   // código del proyecto
  notas?:       string;
}

export async function bulkImportExpenses(rows: BulkExpenseRow[], userId: string) {
  const results: { index: number; status: 'ok' | 'error'; error?: string }[] = [];

  // Pre-load all projects for flexible matching (exact → CSV-starts-with-project-code → remove-suffix)
  const allProjects = await prisma.project.findMany({ select: { id: true, code: true } });
  const projectByCode = new Map(allProjects.map((p) => [p.code.toLowerCase(), p.id]));
  const resolvedProjectCache = new Map<string, string>(); // raw CSV value → projectId
  const categoryCache = new Map<string, number>(); // lowercase name → id

  function resolveProject(csvCode: string): string {
    const cached = resolvedProjectCache.get(csvCode);
    if (cached) return cached;
    const lower = csvCode.toLowerCase();
    // 1. Exact match
    if (projectByCode.has(lower)) {
      resolvedProjectCache.set(csvCode, projectByCode.get(lower)!);
      return projectByCode.get(lower)!;
    }
    // 2. CSV code starts with a known project code (project code is prefix of CSV value)
    for (const [code, id] of projectByCode.entries()) {
      if (lower.startsWith(code + '-') || lower === code) {
        resolvedProjectCache.set(csvCode, id);
        return id;
      }
    }
    // 3. Remove trailing segment(s) and try again
    const parts = csvCode.split('-');
    for (let trim = 1; trim < parts.length; trim++) {
      const candidate = parts.slice(0, -trim).join('-').toLowerCase();
      if (projectByCode.has(candidate)) {
        resolvedProjectCache.set(csvCode, projectByCode.get(candidate)!);
        return projectByCode.get(candidate)!;
      }
    }
    throw new Error(`Proyecto '${csvCode}' no encontrado. Proyectos disponibles: ${allProjects.map((p) => p.code).join(', ')}`);
  }

  const VALID_METHODS = new Set(['CASH', 'TRANSFER', 'CARD', 'CHECK', 'OTHER']);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Proyecto
      const projectId = resolveProject(row.proyecto);

      // Categoría: busca por nombre case-insensitive para evitar duplicados
      const catName = (row.categoria ?? '').normalize('NFC').trim() || 'General';
      let categoryId = categoryCache.get(catName.toLowerCase());
      if (!categoryId) {
        // Try case-insensitive match against existing categories
        const existing = await prisma.expenseCategory.findFirst({
          where: { name: { equals: catName, mode: 'insensitive' } },
        });
        if (existing) {
          categoryCache.set(catName.toLowerCase(), existing.id);
          categoryId = existing.id;
        } else {
          const cat = await prisma.expenseCategory.create({ data: { name: catName, isActive: true } });
          categoryCache.set(catName.toLowerCase(), cat.id);
          categoryId = cat.id;
        }
      }

      // Método de pago
      const method = VALID_METHODS.has((row.metodo_pago ?? '').toUpperCase())
        ? (row.metodo_pago!.toUpperCase() as any)
        : 'CASH';

      // Fecha (mediodía UTC para evitar desfase de zona horaria)
      const expenseDate = new Date(row.fecha + 'T12:00:00.000Z');

      const desc = row.proveedor
        ? `[${row.proveedor}] ${row.descripcion}`
        : row.descripcion;

      await prisma.expense.create({
        data: {
          projectId,
          categoryId,
          userId,
          expenseDate,
          amount:        row.monto,
          description:   desc.slice(0, 500),
          paymentMethod: method,
          hasFiscalDoc:  false,
          notes:         row.notas?.slice(0, 1000) ?? null,
        },
      });

      results.push({ index: i, status: 'ok' });
    } catch (err: any) {
      results.push({ index: i, status: 'error', error: err.message });
    }
  }

  const ok  = results.filter((r) => r.status === 'ok').length;
  const err = results.filter((r) => r.status === 'error').length;
  return { ok, err, results };
}

// ── Dashboard stats ──────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [monthlyRaw, categoryRaw] = await Promise.all([
    prisma.$queryRaw<Array<{ month_label: string; month_date: Date; total: string; count: bigint }>>`
      SELECT
        TO_CHAR(expense_date, 'Mon YYYY') AS month_label,
        DATE_TRUNC('month', expense_date)  AS month_date,
        SUM(amount)::text                  AS total,
        COUNT(*)                           AS count
      FROM expenses
      WHERE status = 'ACTIVE' AND expense_date >= ${sixMonthsAgo}
      GROUP BY month_date, TO_CHAR(expense_date, 'Mon YYYY')
      ORDER BY month_date
    `,
    prisma.expense.groupBy({
      by:      ['categoryId'],
      where:   { status: 'ACTIVE' },
      _sum:    { amount: true },
      _count:  { _all: true },
      orderBy: { _sum: { amount: 'desc' } },
      take:    7,
    }),
  ]);

  const catIds    = categoryRaw.map((c) => c.categoryId);
  const cats      = await prisma.expenseCategory.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } });
  const catMap    = Object.fromEntries(cats.map((c) => [c.id, c.name]));
  const grandTotal = categoryRaw.reduce((s, c) => s + Number(c._sum.amount ?? 0), 0);

  return {
    byMonth: monthlyRaw.map((m) => ({
      month: m.month_label,
      total: Number(m.total),
      count: Number(m.count),
    })),
    byCategory: categoryRaw.map((c) => ({
      name:  catMap[c.categoryId] ?? 'Sin categoría',
      total: Number(c._sum.amount ?? 0),
      count: c._count._all,
      pct:   grandTotal > 0 ? Math.round((Number(c._sum.amount ?? 0) / grandTotal) * 100) : 0,
    })),
  };
}

const CATEGORY_NAMES = [
  'Materiales', 'Servicios', 'Mano de obra', 'Equipos',
  'Transporte', 'Combustible', 'Dietas', 'Otros',
];

export async function suggestCategory(description: string): Promise<{ categoryName: string | null; confidence: 'high' | 'medium' | 'low' }> {
  if (!aiClient) return { categoryName: null, confidence: 'low' };

  try {
    const msg = await aiClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Clasifica este gasto de construcción en una sola de estas categorías: ${CATEGORY_NAMES.join(', ')}.
Descripción: "${description}"
Responde SOLO con el nombre exacto de la categoría y opcionalmente "alta", "media" o "baja" confianza, separados por |.
Ejemplo: Materiales|alta`,
      }],
    });

    const text = (msg.content[0] as any).text?.trim() ?? '';
    const [rawCat, rawConf] = text.split('|').map((s: string) => s.trim());
    const categoryName = CATEGORY_NAMES.find((c) => c.toLowerCase() === rawCat.toLowerCase()) ?? null;
    const confidence = rawConf === 'alta' ? 'high' : rawConf === 'baja' ? 'low' : 'medium';
    return { categoryName, confidence };
  } catch {
    return { categoryName: null, confidence: 'low' };
  }
}
