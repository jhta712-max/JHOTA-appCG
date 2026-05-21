import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { buildPaginatedResponse, parsePagination } from '../../utils/pagination';
import type {
  CreateQuotationInput, UpdateQuotationInput, UpdateStatusInput,
  CreatePaymentInput, LinkExpenseInput, QuotationQuery,
} from './quotations.schema';

// ── Include base reutilizable ──────────────────────────────────

const QUOTATION_INCLUDE = {
  project:      { select: { id: true, code: true, name: true } },
  category:     { select: { id: true, name: true, icon: true } },
  createdBy:    { select: { id: true, name: true } },
  payments: {
    orderBy: { sequence: 'asc' as const },
    include: {
      expense: { select: { id: true, description: true, status: true, amount: true } },
      createdBy: { select: { id: true, name: true } },
    },
  },
  expenseLinks: {
    include: {
      expense: {
        select: {
          id: true, description: true, amount: true,
          hasFiscalDoc: true, status: true, expenseDate: true,
          fiscalVoucher: { select: { ncf: true, supplierName: true } },
        },
      },
    },
  },
  attachments: {
    select: { id: true, fileName: true, mimeType: true, isPrimary: true, createdAt: true },
  },
} as const;

// ── Listar cotizaciones ────────────────────────────────────────

export async function getQuotations(query: QuotationQuery, requestingUser: { userId: string; role: string }) {
  const { page, limit, skip } = parsePagination(query);

  const where: any = {};
  if (query.projectId)    where.projectId    = query.projectId;
  if (query.categoryId)   where.categoryId   = query.categoryId;
  if (query.status)       where.status       = query.status;
  if (query.supplierName) where.supplierName = { contains: query.supplierName, mode: 'insensitive' };

  if (query.dateFrom || query.dateTo) {
    where.quotationDate = {};
    if (query.dateFrom) where.quotationDate.gte = new Date(query.dateFrom);
    if (query.dateTo)   where.quotationDate.lte = new Date(query.dateTo);
  }

  if (query.search) {
    where.OR = [
      { supplierName:     { contains: query.search, mode: 'insensitive' } },
      { description:      { contains: query.search, mode: 'insensitive' } },
      { quotationNumber:  { contains: query.search, mode: 'insensitive' } },
    ];
  }

  // Operadores solo ven cotizaciones de proyectos asignados
  if (requestingUser.role === 'operator') {
    where.project = { assignments: { some: { userId: requestingUser.userId } } };
  }

  const [data, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      skip,
      take:     limit,
      orderBy:  { [query.orderBy]: query.order },
      include:  QUOTATION_INCLUDE,
    }),
    prisma.quotation.count({ where }),
  ]);

  return buildPaginatedResponse(
    data.map(serializeQuotation),
    total,
    { page, limit, skip },
  );
}

// ── Obtener una cotización ─────────────────────────────────────

export async function getQuotationById(id: string, requestingUser?: { userId: string; role: string }) {
  const q = await prisma.quotation.findUnique({ where: { id }, include: QUOTATION_INCLUDE });
  if (!q) throw new AppError(404, 'Cotización no encontrada', 'NOT_FOUND');

  if (requestingUser?.role === 'operator') {
    const assigned = await prisma.projectAssignment.findUnique({
      where: { projectId_userId: { projectId: q.projectId, userId: requestingUser.userId } },
    });
    if (!assigned) throw new AppError(403, 'No tienes acceso a esta cotización', 'FORBIDDEN');
  }

  return serializeQuotation(q);
}

// ── Resumen financiero de una cotización ───────────────────────

export async function getQuotationSummary(id: string) {
  const q = await prisma.quotation.findUnique({
    where:   { id },
    include: {
      payments:     { select: { id: true, amount: true, expenseId: true } },
      expenseLinks: { select: { id: true, expenseId: true, linkType: true,
                                expense: { select: { amount: true, status: true } } } },
    },
  });
  if (!q) throw new AppError(404, 'Cotización no encontrada', 'NOT_FOUND');

  const total = Number(q.total);

  // Suma de pagos directos
  const totalPayments = q.payments.reduce((s, p) => s + Number(p.amount), 0);

  // Suma de gastos vinculados que NO son anticipos ya registrados como payments
  const paymentExpenseIds = new Set(q.payments.map((p) => p.expenseId).filter(Boolean));
  const linkedExpenses    = q.expenseLinks.filter(
    (l) => !paymentExpenseIds.has(l.expenseId) && l.expense.status === 'ACTIVE',
  );
  const totalLinked = linkedExpenses.reduce((s, l) => s + Number(l.expense.amount), 0);

  const totalApplied    = totalPayments + totalLinked;
  const pendingBalance  = Math.max(total - totalApplied, 0);
  const isOverpaid      = totalApplied > total;

  // Estructura plana para el frontend
  return {
    quotationId:    q.id,
    total:          Math.round(total * 100) / 100,
    totalPaid:      Math.round(totalPayments * 100) / 100,
    totalLinked:    Math.round(totalLinked * 100) / 100,
    pendingBalance: Math.round(pendingBalance * 100) / 100,
    advanceAmount:  Math.round(totalPayments * 100) / 100,
    paymentsCount:  q.payments.length,
    linksCount:     q.expenseLinks.length,
    paidPct:        total > 0 ? Math.round((totalApplied / total) * 10000) / 100 : 0,
    isOverpaid,
  };
}

// ── Crear cotización ───────────────────────────────────────────

export async function createQuotation(data: CreateQuotationInput, userId: string, userRole?: string) {
  const project = await prisma.project.findUnique({
    where:   { id: data.projectId },
    include: { assignments: { select: { userId: true } } },
  });
  if (!project)                    throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');
  if (project.status !== 'ACTIVE') throw new AppError(400, 'Solo se pueden registrar cotizaciones en proyectos activos', 'PROJECT_INACTIVE');

  if (userRole === 'operator') {
    const isAssigned = project.assignments.some((a) => a.userId === userId);
    if (!isAssigned) throw new AppError(403, 'No tienes acceso a este proyecto', 'FORBIDDEN');
  }

  if (data.categoryId) {
    const cat = await prisma.expenseCategory.findUnique({ where: { id: data.categoryId } });
    if (!cat || !cat.isActive) throw new AppError(404, 'Categoría no encontrada o inactiva', 'NOT_FOUND');
  }

  // Número autoincremental por proyecto
  const last = await prisma.quotation.findFirst({
    where:   { projectId: data.projectId },
    orderBy: { number: 'desc' },
    select:  { number: true },
  });
  const nextNumber = (last?.number ?? 0) + 1;

  const q = await prisma.quotation.create({
    data: {
      projectId:      data.projectId,
      categoryId:     data.categoryId,
      number:         nextNumber,
      supplierName:   data.supplierName,
      supplierRnc:    data.supplierRnc,
      quotationNumber: data.quotationNumber,
      quotationDate:  new Date(data.quotationDate),
      validUntil:     data.validUntil ? new Date(data.validUntil) : undefined,
      currency:       data.currency ?? 'DOP',
      subtotal:       data.subtotal,
      itbisAmount:    data.itbisAmount ?? 0,
      total:          data.total,
      description:    data.description,
      paymentTerms:   data.paymentTerms,
      advancePct:     data.advancePct,
      deliveryDays:   data.deliveryDays,
      observations:   data.observations,
      notes:          data.notes,
      createdById:    userId,
    },
    include: QUOTATION_INCLUDE,
  });

  return serializeQuotation(q);
}

// ── Actualizar cotización ──────────────────────────────────────

export async function updateQuotation(id: string, data: UpdateQuotationInput) {
  const q = await prisma.quotation.findUnique({ where: { id } });
  if (!q) throw new AppError(404, 'Cotización no encontrada', 'NOT_FOUND');

  if (q.status === 'CANCELLED') throw new AppError(400, 'No se puede editar una cotización cancelada', 'QUOTATION_CANCELLED');
  if (q.status === 'PAID')      throw new AppError(400, 'No se puede editar una cotización ya pagada', 'QUOTATION_PAID');

  const updated = await prisma.quotation.update({
    where: { id },
    data: {
      ...(data.supplierName    !== undefined && { supplierName:    data.supplierName }),
      ...(data.supplierRnc     !== undefined && { supplierRnc:     data.supplierRnc }),
      ...(data.quotationNumber !== undefined && { quotationNumber: data.quotationNumber }),
      ...(data.quotationDate   !== undefined && { quotationDate:   new Date(data.quotationDate) }),
      ...(data.validUntil      !== undefined && { validUntil:      new Date(data.validUntil) }),
      ...(data.currency        !== undefined && { currency:        data.currency }),
      ...(data.subtotal        !== undefined && { subtotal:        data.subtotal }),
      ...(data.itbisAmount     !== undefined && { itbisAmount:     data.itbisAmount }),
      ...(data.total           !== undefined && { total:           data.total }),
      ...(data.description     !== undefined && { description:     data.description }),
      ...(data.paymentTerms    !== undefined && { paymentTerms:    data.paymentTerms }),
      ...(data.advancePct      !== undefined && { advancePct:      data.advancePct }),
      ...(data.deliveryDays    !== undefined && { deliveryDays:    data.deliveryDays }),
      ...(data.observations    !== undefined && { observations:    data.observations }),
      ...(data.notes           !== undefined && { notes:           data.notes }),
      ...(data.categoryId      !== undefined && { categoryId:      data.categoryId }),
    },
    include: QUOTATION_INCLUDE,
  });

  return serializeQuotation(updated);
}

// ── Cambiar estado manualmente ─────────────────────────────────

export async function updateStatus(id: string, data: UpdateStatusInput) {
  const q = await prisma.quotation.findUnique({ where: { id } });
  if (!q) throw new AppError(404, 'Cotización no encontrada', 'NOT_FOUND');

  if (q.status === 'CANCELLED') throw new AppError(400, 'No se puede cambiar el estado de una cotización cancelada', 'QUOTATION_CANCELLED');

  const updated = await prisma.quotation.update({
    where: { id },
    data:  { status: data.status, ...(data.notes && { notes: data.notes }) },
    include: QUOTATION_INCLUDE,
  });

  return serializeQuotation(updated);
}

// ── Eliminar cotización ────────────────────────────────────────

export async function deleteQuotation(id: string) {
  const q = await prisma.quotation.findUnique({
    where:   { id },
    include: { payments: { select: { id: true } } },
  });
  if (!q) throw new AppError(404, 'Cotización no encontrada', 'NOT_FOUND');

  if (q.payments.length > 0) {
    throw new AppError(
      409,
      `No se puede eliminar la cotización. Tiene ${q.payments.length} pago(s) registrado(s). Cámbiala a estado CANCELLED en su lugar.`,
      'HAS_PAYMENTS',
    );
  }

  await prisma.quotation.delete({ where: { id } });
  return { id: q.id, supplierName: q.supplierName };
}

// ── Registrar pago / anticipo ──────────────────────────────────

export async function createPayment(quotationId: string, data: CreatePaymentInput, userId: string) {
  const quotation = await prisma.quotation.findUnique({
    where:   { id: quotationId },
    include: { payments: { select: { amount: true, sequence: true } } },
  });
  if (!quotation) throw new AppError(404, 'Cotización no encontrada', 'NOT_FOUND');
  if (quotation.status === 'CANCELLED') throw new AppError(400, 'No se puede registrar pagos en una cotización cancelada', 'QUOTATION_CANCELLED');
  if (quotation.status === 'PAID')      throw new AppError(400, 'La cotización ya está completamente pagada', 'QUOTATION_PAID');

  const totalPaid    = quotation.payments.reduce((s, p) => s + Number(p.amount), 0);
  const nextSequence = (quotation.payments.reduce((max, p) => Math.max(max, p.sequence), 0)) + 1;
  const quotTotal    = Number(quotation.total);

  // Advertencia si se supera el total (no bloquea, pero registra en notes)
  const warnings: string[] = [];
  if (totalPaid + data.amount > quotTotal) {
    warnings.push(`Atención: el pago (${data.amount}) sumado a pagos anteriores (${totalPaid}) supera el total de la cotización (${quotTotal})`);
  }

  let expenseId: string | undefined = data.expenseId;

  // Si se pidió crear un Expense automáticamente
  if (!expenseId && data.createExpense) {
    const defaultCategoryId = await getDefaultCategoryId();
    const newExpense = await prisma.expense.create({
      data: {
        projectId:     quotation.projectId,
        categoryId:    quotation.categoryId ?? defaultCategoryId,
        userId,
        expenseDate:   new Date(data.paymentDate),
        amount:        data.amount,
        description:   `Anticipo cotización #${quotation.number} — ${quotation.supplierName}: ${data.description}`,
        paymentMethod: data.paymentMethod,
        hasFiscalDoc:  false,
        notes:         warnings.join('. ') || data.notes,
      },
    });
    expenseId = newExpense.id;
  }

  // Verificar que el expense externo no esté ya vinculado
  if (expenseId) {
    const alreadyLinked = await prisma.quotationPayment.findUnique({ where: { expenseId } });
    if (alreadyLinked) throw new AppError(409, 'Este gasto ya está vinculado a otro pago de cotización', 'EXPENSE_ALREADY_LINKED');
  }

  // Crear el pago
  const payment = await prisma.quotationPayment.create({
    data: {
      quotationId,
      expenseId,
      sequence:      nextSequence,
      amount:        data.amount,
      paymentDate:   new Date(data.paymentDate),
      paymentMethod: data.paymentMethod,
      description:   data.description,
      notes:         warnings.length > 0 ? warnings.join('. ') : data.notes,
      createdById:   userId,
    },
    include: {
      expense:   { select: { id: true, description: true, status: true, amount: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  // Auto-actualizar estado de la cotización
  await autoUpdateStatus(quotationId);

  return { ...payment, amount: Number(payment.amount), warnings };
}

// ── Eliminar pago ──────────────────────────────────────────────

export async function deletePayment(quotationId: string, paymentId: string) {
  const payment = await prisma.quotationPayment.findFirst({
    where: { id: paymentId, quotationId },
  });
  if (!payment) throw new AppError(404, 'Pago no encontrado', 'NOT_FOUND');

  if (payment.expenseId) {
    // Si el expense fue auto-creado (solo vinculado aquí), anularlo en lugar de eliminarlo
    const expense = await prisma.expense.findUnique({ where: { id: payment.expenseId } });
    if (expense && expense.status === 'ACTIVE') {
      throw new AppError(
        409,
        'Este pago tiene un gasto vinculado activo. Anula el gasto primero desde el módulo de gastos antes de eliminar el pago.',
        'HAS_ACTIVE_EXPENSE',
      );
    }
  }

  await prisma.quotationPayment.delete({ where: { id: paymentId } });
  await autoUpdateStatus(quotationId);

  return { id: paymentId };
}

// ── Vincular gasto/factura final ───────────────────────────────

export async function linkExpense(quotationId: string, data: LinkExpenseInput, userId: string) {
  const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
  if (!quotation) throw new AppError(404, 'Cotización no encontrada', 'NOT_FOUND');

  const expense = await prisma.expense.findUnique({
    where:   { id: data.expenseId },
    include: { quotationLink: true, quotationPayment: true },
  });
  if (!expense) throw new AppError(404, 'Gasto no encontrado', 'NOT_FOUND');

  // Verificar que el gasto pertenece al mismo proyecto
  if (expense.projectId !== quotation.projectId) {
    throw new AppError(400, 'El gasto debe pertenecer al mismo proyecto que la cotización', 'DIFFERENT_PROJECT');
  }

  // Verificar que el gasto no esté ya vinculado a otra cotización
  if (expense.quotationLink) {
    throw new AppError(409, 'Este gasto ya está vinculado a otra cotización', 'EXPENSE_ALREADY_LINKED');
  }
  if (expense.quotationPayment) {
    throw new AppError(409, 'Este gasto ya está registrado como pago de cotización', 'EXPENSE_ALREADY_LINKED');
  }

  const link = await prisma.quotationExpenseLink.create({
    data: {
      quotationId,
      expenseId:   data.expenseId,
      linkType:    data.linkType,
      notes:       data.notes,
      createdById: userId,
    },
    include: {
      expense: {
        select: {
          id: true, description: true, amount: true,
          hasFiscalDoc: true, status: true, expenseDate: true,
          fiscalVoucher: { select: { ncf: true, supplierName: true } },
        },
      },
    },
  });

  await autoUpdateStatus(quotationId);

  return link;
}

// ── Desvincular gasto ──────────────────────────────────────────

export async function unlinkExpense(quotationId: string, linkId: string) {
  const link = await prisma.quotationExpenseLink.findFirst({
    where: { id: linkId, quotationId },
  });
  if (!link) throw new AppError(404, 'Vínculo no encontrado', 'NOT_FOUND');

  await prisma.quotationExpenseLink.delete({ where: { id: linkId } });
  await autoUpdateStatus(quotationId);

  return { id: linkId };
}

// ── Sugerir cotizaciones candidatas para un gasto ──────────────

export async function suggestQuotations(projectId: string, supplierName?: string, amount?: number) {
  const where: any = {
    projectId,
    status: { in: ['APPROVED', 'ADVANCE_PAID', 'IN_PROGRESS', 'PENDING'] },
  };

  if (supplierName) {
    where.supplierName = { contains: supplierName, mode: 'insensitive' };
  }

  const candidates = await prisma.quotation.findMany({
    where,
    orderBy: { quotationDate: 'desc' },
    take:    10,
    select: {
      id: true, number: true, supplierName: true, total: true,
      status: true, quotationDate: true, description: true,
      currency: true, quotationNumber: true,
      project: { select: { id: true, code: true, name: true } },
      _count: { select: { payments: true, expenseLinks: true, attachments: true } },
    },
  });

  // Filtrar por proximidad de monto si se proporciona (±20%)
  if (amount && amount > 0) {
    return candidates.filter((c) => {
      const t = Number(c.total);
      return Math.abs(t - amount) / t <= 0.20;
    });
  }

  return candidates;
}

// ── Helpers internos ───────────────────────────────────────────

/** Auto-transición de estado según pagos y vínculos */
async function autoUpdateStatus(quotationId: string): Promise<void> {
  const q = await prisma.quotation.findUnique({
    where:   { id: quotationId },
    include: {
      payments:     { select: { amount: true } },
      expenseLinks: { include: { expense: { select: { amount: true, status: true, hasFiscalDoc: true } } } },
    },
  });
  if (!q || q.status === 'CANCELLED') return;

  const total         = Number(q.total);
  const totalPayments = q.payments.reduce((s, p) => s + Number(p.amount), 0);
  const activeLinks   = q.expenseLinks.filter((l) => l.expense.status === 'ACTIVE');
  const hasFiscalLink = activeLinks.some((l) => l.expense.hasFiscalDoc);
  const totalLinked   = activeLinks.reduce((s, l) => s + Number(l.expense.amount), 0);
  const totalApplied  = totalPayments + totalLinked;

  let newStatus = q.status;

  if (hasFiscalLink && totalApplied >= total) {
    // Factura recibida que cubre el total → INVOICED (PAID lo marca el usuario manualmente)
    newStatus = 'INVOICED';
  } else if (hasFiscalLink && totalApplied < total) {
    // Factura parcial
    newStatus = 'PARTIAL_INVOICED';
  } else if (totalPayments > 0 && (q.status === 'APPROVED' || q.status === 'PENDING')) {
    // Al menos un anticipo registrado
    newStatus = 'ADVANCE_PAID';
  }

  if (newStatus !== q.status) {
    await prisma.quotation.update({
      where: { id: quotationId },
      data:  { status: newStatus },
    });
  }
}

/** Obtiene el ID de categoría "Otros" como fallback para expenses auto-creados */
async function getDefaultCategoryId(): Promise<number> {
  const cat = await prisma.expenseCategory.findFirst({
    where: { name: { contains: 'Otros', mode: 'insensitive' }, isActive: true },
  });
  if (cat) return cat.id;
  // Si no existe, tomar cualquier categoría activa
  const any = await prisma.expenseCategory.findFirst({ where: { isActive: true } });
  if (any) return any.id;
  throw new AppError(500, 'No hay categorías de gasto disponibles', 'NO_CATEGORIES');
}

/** Serializa Decimals a números para evitar problemas de JSON */
function serializeQuotation(q: any): any {
  return {
    ...q,
    subtotal:    Number(q.subtotal),
    itbisAmount: Number(q.itbisAmount),
    total:       Number(q.total),
    advancePct:  q.advancePct != null ? Number(q.advancePct) : null,
    payments: (q.payments ?? []).map((p: any) => ({
      ...p,
      amount: Number(p.amount),
    })),
  };
}
