import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { buildExpenseData } from '../payment-orders/payment-orders.service';
import { buildPaginatedResponse, parsePagination } from '../../utils/pagination';
import ExcelJS from 'exceljs';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber,
} from 'docx';
import type { Response } from 'express';
import type {
  CreatePayrollInput,
  UpdatePayrollInput,
  UpsertLineInput,
  MarkPaidInput,
  VoidPayrollInput,
  PayrollQuery,
} from './payroll.schema';

// ─── Include helper ──────────────────────────────────────────
const PAYROLL_INCLUDE = {
  project:    { select: { id: true, code: true, name: true } },
  createdBy:  { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  voidedBy:   { select: { id: true, name: true } },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: {
      contratoAjustado: {
        select: { id: true, descripcionTrabajo: true, montoContratado: true },
      },
      expense: {
        select: { id: true, amount: true, expenseDate: true, description: true, status: true },
      },
    },
  },
  paymentOrder: {
    select: { id: true, concept: true, amount: true, status: true, orderType: true, createdAt: true },
  },
} as const;

// ─── Next payroll number per project ─────────────────────────
async function nextPayrollNumber(projectId: string): Promise<number> {
  const last = await prisma.payroll.findFirst({
    where: { projectId },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

// ─── Compute total from lines ─────────────────────────────────
function computeTotal(lines: { quantity: number; unitPrice: number }[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
}

// ─── LIST ─────────────────────────────────────────────────────
export async function getPayrolls(query: PayrollQuery, userId: string, userRole: string) {
  const { page, limit, skip } = parsePagination(query);

  const where: any = {};

  if (userRole === 'operator') {
    const assignments = await prisma.projectAssignment.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const projectIds = assignments.map((a) => a.projectId);
    // Si el operador filtra por un proyecto específico, verificar que esté asignado a él
    if (query.projectId) {
      where.projectId = projectIds.includes(query.projectId) ? query.projectId : { in: [] };
    } else {
      where.projectId = { in: projectIds };
    }
  } else {
    if (query.projectId) where.projectId = query.projectId;
  }
  if (query.status)    where.status    = query.status;
  if (query.type)      where.type      = query.type;

  if (query.dateFrom || query.dateTo) {
    where.periodStart = {};
    if (query.dateFrom) where.periodStart.gte = new Date(query.dateFrom);
    if (query.dateTo)   where.periodStart.lte = new Date(query.dateTo);
  }

  const [data, total] = await Promise.all([
    prisma.payroll.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [query.orderBy]: query.order },
      include: {
        project:    { select: { id: true, code: true, name: true } },
        createdBy:  { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.payroll.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, { page, limit, skip });
}

// ─── GET ONE ──────────────────────────────────────────────────
export async function getPayrollById(id: string) {
  const p = await prisma.payroll.findUnique({ where: { id }, include: PAYROLL_INCLUDE });
  if (!p) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  return p;
}

// ─── CREATE ───────────────────────────────────────────────────
export async function createPayroll(data: CreatePayrollInput, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: data.projectId } });
  if (!project) throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');
  if (project.status === 'CANCELLED' || project.status === 'COMPLETED') {
    throw new AppError(400, 'No se puede crear nómina en un proyecto cerrado', 'PROJECT_CLOSED');
  }

  const number = await nextPayrollNumber(data.projectId);
  const total  = computeTotal(data.lines);

  const payroll = await prisma.$transaction(async (tx) => {
    const created = await tx.payroll.create({
      data: {
        projectId:   data.projectId,
        number,
        periodStart: new Date(data.periodStart),
        periodEnd:   new Date(data.periodEnd),
        type:        data.type,
        description: data.description,
        notes:       data.notes,
        totalAmount: total,
        createdById: userId,
        lines: {
          create: data.lines.map((l, idx) => ({
            lineNumber:   idx + 1,
            description:  l.description,
            quantity:     l.quantity,
            unit:         l.unit,
            unitPrice:    l.unitPrice,
            subtotal:     parseFloat((l.quantity * l.unitPrice).toFixed(2)),
            notes:        l.notes,
            supplierName: l.supplierName,
            bankName:     l.bankName,
            bankAccount:  l.bankAccount,
          })),
        },
      },
      include: PAYROLL_INCLUDE,
    });
    return created;
  });

  return payroll;
}

// ─── UPDATE (DRAFT only) ──────────────────────────────────────
export async function updatePayroll(id: string, data: UpdatePayrollInput) {
  const payroll = await prisma.payroll.findUnique({ where: { id } });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (payroll.status !== 'DRAFT') {
    throw new AppError(400, 'Solo se pueden editar nóminas en borrador', 'INVALID_STATUS');
  }

  return prisma.payroll.update({
    where: { id },
    data: {
      periodStart: data.periodStart ? new Date(data.periodStart) : undefined,
      periodEnd:   data.periodEnd   ? new Date(data.periodEnd)   : undefined,
      type:        data.type,
      description: data.description,
      notes:       data.notes,
    },
    include: PAYROLL_INCLUDE,
  });
}

// ─── ADD LINE ─────────────────────────────────────────────────
export async function addLine(payrollId: string, data: UpsertLineInput) {
  const payroll = await prisma.payroll.findUnique({
    where: { id: payrollId },
    include: { lines: { select: { lineNumber: true }, orderBy: { lineNumber: 'desc' }, take: 1 } },
  });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (payroll.status !== 'DRAFT') throw new AppError(400, 'Solo se modifican nóminas en borrador', 'INVALID_STATUS');

  const nextLine = (payroll.lines[0]?.lineNumber ?? 0) + 1;
  const subtotal = parseFloat((data.quantity * data.unitPrice).toFixed(2));

  await prisma.$transaction(async (tx) => {
    await tx.payrollLine.create({
      data: {
        payrollId,
        lineNumber:   nextLine,
        description:  data.description,
        quantity:     data.quantity,
        unit:         data.unit,
        unitPrice:    data.unitPrice,
        subtotal,
        notes:        data.notes,
        supplierName: data.supplierName,
        bankName:     data.bankName,
        bankAccount:  data.bankAccount,
      },
    });
    const allLines = await tx.payrollLine.findMany({ where: { payrollId } });
    const newTotal = allLines.reduce((s, l) => s + Number(l.subtotal), 0);
    await tx.payroll.update({ where: { id: payrollId }, data: { totalAmount: newTotal } });
  });

  return getPayrollById(payrollId);
}

// ─── UPDATE LINE ──────────────────────────────────────────────
export async function updateLine(payrollId: string, lineId: string, data: UpsertLineInput) {
  const payroll = await prisma.payroll.findUnique({ where: { id: payrollId } });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (payroll.status !== 'DRAFT') throw new AppError(400, 'Solo se modifican nóminas en borrador', 'INVALID_STATUS');

  const line = await prisma.payrollLine.findFirst({ where: { id: lineId, payrollId } });
  if (!line) throw new AppError(404, 'Línea no encontrada', 'NOT_FOUND');

  const subtotal = parseFloat((data.quantity * data.unitPrice).toFixed(2));

  await prisma.$transaction(async (tx) => {
    await tx.payrollLine.update({
      where: { id: lineId },
      data: {
        description:  data.description,
        quantity:     data.quantity,
        unit:         data.unit,
        unitPrice:    data.unitPrice,
        subtotal,
        notes:        data.notes,
        supplierName: data.supplierName,
        bankName:     data.bankName,
        bankAccount:  data.bankAccount,
      },
    });
    const allLines = await tx.payrollLine.findMany({ where: { payrollId } });
    const newTotal = allLines.reduce((s, l) => s + Number(l.subtotal), 0);
    await tx.payroll.update({ where: { id: payrollId }, data: { totalAmount: newTotal } });
  });

  return getPayrollById(payrollId);
}

// ─── DELETE LINE ──────────────────────────────────────────────
export async function deleteLine(payrollId: string, lineId: string) {
  const payroll = await prisma.payroll.findUnique({ where: { id: payrollId } });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (!['DRAFT', 'APPROVED'].includes(payroll.status)) throw new AppError(400, 'No se pueden eliminar líneas en este estado', 'INVALID_STATUS');

  const line = await prisma.payrollLine.findFirst({ where: { id: lineId, payrollId } });
  if (!line) throw new AppError(404, 'Línea no encontrada', 'NOT_FOUND');

  await prisma.$transaction(async (tx) => {
    await tx.payrollLine.delete({ where: { id: lineId } });
    const allLines = await tx.payrollLine.findMany({ where: { payrollId } });
    const newTotal = allLines.reduce((s, l) => s + Number(l.subtotal), 0);
    await tx.payroll.update({ where: { id: payrollId }, data: { totalAmount: newTotal } });
  });

  return getPayrollById(payrollId);
}

// ─── UPDATE LINE CONTRATO AJUSTADO ─────────────────────────────
export async function updateLineContratoAjustado(payrollId: string, lineId: string, contratoAjustadoId: string | null) {
  const payroll = await prisma.payroll.findUnique({ where: { id: payrollId } });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');

  const line = await prisma.payrollLine.findFirst({ where: { id: lineId, payrollId } });
  if (!line) throw new AppError(404, 'Línea no encontrada', 'NOT_FOUND');

  if (contratoAjustadoId) {
    const contrato = await prisma.contratoAjustado.findUnique({ where: { id: contratoAjustadoId } });
    if (!contrato) throw new AppError(404, 'Contrato ajustado no encontrado', 'NOT_FOUND');
  }

  await prisma.payrollLine.update({
    where: { id: lineId },
    data: { contratoAjustadoId },
  });

  return getPayrollById(payrollId);
}

// ─── REVERT TO DRAFT (APPROVED → DRAFT) ──────────────────────
export async function revertToDraft(id: string) {
  const payroll = await getPayrollById(id);
  if (payroll.status !== 'APPROVED') throw new AppError(400, 'Solo se puede revertir a borrador una nómina aprobada', 'INVALID_STATUS');
  return prisma.payroll.update({
    where: { id },
    data:  { status: 'DRAFT', approvedById: null, approvedAt: null },
    include: PAYROLL_INCLUDE,
  });
}

// ─── REVERT TO APPROVED (PAID → APPROVED) — ADMIN ONLY ────────
export async function revertToApproved(id: string) {
  const payroll = await getPayrollById(id);
  if (payroll.status !== 'PAID') throw new AppError(400, 'Solo se puede revertir a aprobada una nómina pagada', 'INVALID_STATUS');
  return prisma.payroll.update({
    where: { id },
    data: {
      status: 'APPROVED',
      paidAt: null,
      paymentMethod: null,
      paymentDate: null,
      paymentBank: null,
      paymentReference: null,
      receiptNumber: null,
      receivedBy: null,
    },
    include: PAYROLL_INCLUDE,
  });
}

// ─── APPROVE (DRAFT → APPROVED) + auto-create Expense ────────
export async function approvePayroll(id: string, approvedById: string) {
  const payroll = await prisma.payroll.findUnique({ where: { id }, include: { lines: true, project: true } });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (payroll.status !== 'DRAFT') throw new AppError(400, 'Solo se aprueban nóminas en borrador', 'INVALID_STATUS');
  if (payroll.lines.length === 0) throw new AppError(400, 'La nómina no tiene líneas', 'EMPTY_PAYROLL');

  let category = await prisma.expenseCategory.findFirst({
    where: {
      name: { contains: payroll.type === 'LABOR' ? 'Mano de obra' : 'Servicios', mode: 'insensitive' },
      isActive: true,
    },
  });
  if (!category) {
    category = await prisma.expenseCategory.findFirst({ where: { isActive: true } });
  }
  if (!category) throw new AppError(500, 'No hay categorías de gasto configuradas', 'NO_CATEGORY');

  const updated = await prisma.$transaction(async (tx) => {
    // Create individual expense for each payroll line
    for (const line of payroll.lines) {
      const lineAmount = parseFloat((Number(line.quantity) * Number(line.unitPrice)).toFixed(2));
      const expense = await tx.expense.create({
        data: buildExpenseData({
          projectId:   payroll.projectId,
          categoryId:  category!.id,
          userId:      approvedById,
          expenseDate: payroll.periodEnd,
          amount:      lineAmount,
          description: `NOM-${String(payroll.number).padStart(3, '0')} — ${line.supplierName || 'Sin suplidor'}: ${line.description}`,
          notes:       `Línea ${line.lineNumber} de nómina. Generado automáticamente al aprobar nómina.`,
        }),
      });

      // Link expense to payroll line
      await tx.payrollLine.update({
        where: { id: line.id },
        data: { expenseId: expense.id },
      });

      // If line is linked to a contrato ajustado, create payment record
      if ((line as any).contratoAjustadoId) {
        await tx.contratoAjustadoPago.create({
          data: {
            contratoAjustadoId: (line as any).contratoAjustadoId,
            nominaId: payroll.id,
            gastoId: expense.id,
            monto: lineAmount,
            fecha: payroll.periodEnd,
            creadoPorId: approvedById,
          },
        });
      }
    }

    return tx.payroll.update({
      where: { id },
      data: {
        status:      'APPROVED',
        approvedById,
        approvedAt:  new Date(),
      },
      include: PAYROLL_INCLUDE,
    });
  });

  return updated;
}

// ─── MARK AS PAID (APPROVED → PAID) ──────────────────────────
export async function markPayrollPaid(id: string, data: MarkPaidInput) {
  const payroll = await prisma.payroll.findUnique({ where: { id } });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (payroll.status !== 'APPROVED') throw new AppError(400, 'Solo se marcan como pagadas las nóminas aprobadas', 'INVALID_STATUS');

  return prisma.payroll.update({
    where: { id },
    data: {
      status:           'PAID',
      paidAt:           new Date(),
      paymentMethod:    data.paymentMethod,
      paymentDate:      new Date(data.paymentDate),
      paymentBank:      data.paymentBank       || null,
      paymentReference: data.paymentReference  || null,
      receiptNumber:    data.receiptNumber     || null,
      receivedBy:       data.receivedBy        || null,
    },
    include: PAYROLL_INCLUDE,
  });
}

// ─── VOID ─────────────────────────────────────────────────────
export async function voidPayroll(id: string, voidedById: string, data: VoidPayrollInput) {
  const payroll = await prisma.payroll.findUnique({ where: { id }, include: { lines: true } });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (payroll.status === 'VOIDED') throw new AppError(400, 'La nómina ya está anulada', 'INVALID_STATUS');

  return prisma.$transaction(async (tx) => {
    // Collect all expense IDs from all payroll lines
    const expenseIds = payroll.lines
      .map((line) => (line as any).expenseId)
      .filter((id): id is string => id !== null && id !== undefined);

    // Void all line expenses in bulk
    if (expenseIds.length > 0) {
      await tx.expense.updateMany({
        where: { id: { in: expenseIds } },
        data: {
          status:     'VOIDED',
          voidedAt:   new Date(),
          voidedById,
          voidReason: `Nómina anulada: ${data.voidReason}`,
        },
      });
    }

    return tx.payroll.update({
      where: { id },
      data: {
        status:    'VOIDED',
        voidedAt:  new Date(),
        voidedById,
        voidReason: data.voidReason,
      },
      include: PAYROLL_INCLUDE,
    });
  });
}

// ─── REGISTRAR COMPROBANTE POR LÍNEA ─────────────────────────
export async function recordLinePayment(
  payrollId: string,
  lineId:    string,
  data: { paymentBank?: string; paymentReference?: string; paidAt?: string },
) {
  const payroll = await prisma.payroll.findUnique({ where: { id: payrollId } });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (!['APPROVED', 'PAID'].includes(payroll.status)) {
    throw new AppError(400, 'Solo se registran comprobantes en nóminas aprobadas o pagadas', 'INVALID_STATUS');
  }
  const line = await prisma.payrollLine.findFirst({ where: { id: lineId, payrollId } });
  if (!line) throw new AppError(404, 'Línea no encontrada', 'NOT_FOUND');

  return prisma.payrollLine.update({
    where: { id: lineId },
    data:  {
      paymentBank:      data.paymentBank      ?? null,
      paymentReference: data.paymentReference ?? null,
      paidAt:           data.paidAt ? new Date(data.paidAt + 'T12:00:00.000Z') : null,
    },
  });
}

// ─── IMPORTAR LÍNEAS DESDE ÓRDENES DE PAGO VINCULADAS ────────
export async function importLinesFromOrders(payrollId: string) {
  const payroll = await prisma.payroll.findUnique({ where: { id: payrollId } });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (!['DRAFT', 'APPROVED'].includes(payroll.status)) {
    throw new AppError(400, 'Solo se puede importar en nóminas en borrador o aprobadas', 'INVALID_STATUS');
  }

  // Buscar todas las órdenes de pago vinculadas a esta nómina
  const orders = await prisma.paymentOrder.findMany({
    where:   { payrollId },
    include: { supplier: true },
  });

  if (orders.length === 0) throw new AppError(400, 'No hay órdenes de pago vinculadas a esta nómina', 'NO_ORDERS');

  // Obtener número de línea actual más alto
  const lastLine = await prisma.payrollLine.findFirst({
    where:   { payrollId },
    orderBy: { lineNumber: 'desc' },
  });
  let lineNum = (lastLine?.lineNumber ?? 0) + 1;

  const created = [];
  for (const order of orders) {
    const amount = Number(order.amount);
    const line = await prisma.payrollLine.create({
      data: {
        payrollId,
        lineNumber:   lineNum++,
        supplierName: order.supplier?.name ?? order.payingCompany,
        description:  order.concept,
        quantity:     1,
        unit:         'PA',
        unitPrice:    amount,
        subtotal:     amount,
        bankName:     order.supplier?.bank ?? '',
        bankAccount:  order.supplier?.accountNumber ?? '',
      },
    });
    created.push(line);
  }

  // Recalcular total de la nómina
  const allLines = await prisma.payrollLine.findMany({ where: { payrollId } });
  const newTotal = allLines.reduce((s, l) => s + Number(l.subtotal), 0);
  await prisma.payroll.update({ where: { id: payrollId }, data: { totalAmount: newTotal } });

  return getPayrollById(payrollId);
}

// ─── DELETE (DRAFT only) ──────────────────────────────────────
export async function deletePayroll(id: string) {
  const payroll = await prisma.payroll.findUnique({ where: { id } });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (payroll.status !== 'DRAFT') throw new AppError(400, 'Solo se eliminan nóminas en borrador', 'INVALID_STATUS');

  await prisma.payroll.delete({ where: { id } });
}

// ═══════════════════════════════════════════════════════════════
// ─── EXCEL EXPORT ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
const GOLD    = 'FFF5C218';
const DARK    = 'FF1C1C1C';
const WHITE   = 'FFFFFFFF';
const GRAY_BG = 'FFF2F2F2';

function addTitle(ws: ExcelJS.Worksheet, title: string, cols: number) {
  ws.addRow(['SERVINGMI — Servicios de Ingeniería & Minería']);
  ws.addRow([title]);
  ws.addRow([`Generado: ${new Date().toLocaleString('es-DO')}`]);
  ws.addRow([]);
  [1, 2, 3].forEach((r) => {
    ws.mergeCells(r, 1, r, cols);
    const cell = ws.getCell(r, 1);
    cell.font  = { bold: true, color: { argb: r === 1 ? WHITE : DARK }, size: r === 1 ? 13 : r === 2 ? 11 : 9 };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 1 ? DARK : r === 2 ? GOLD : GRAY_BG } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(r).height = r === 1 ? 22 : 18;
  });
}

function styleHeader(ws: ExcelJS.Worksheet, row: number) {
  const r = ws.getRow(row);
  r.eachCell((cell) => {
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } };
    cell.font  = { bold: true, color: { argb: DARK }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  r.height = 20;
}

export async function exportPayrollExcel(id: string, res: Response) {
  const payroll = await prisma.payroll.findUnique({ where: { id }, include: PAYROLL_INCLUDE });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SERVINGMI';
  wb.created = new Date();

  const typeLabel  = payroll.type === 'LABOR' ? 'Mano de Obra' : 'Servicios';
  const statusMap: Record<string, string> = {
    DRAFT: 'Borrador', APPROVED: 'Aprobada', PAID: 'Pagada', VOIDED: 'Anulada',
  };

  // ── Sheet 1: Detalle de nómina (con suplidor y cuenta bancaria) ──
  const ws1 = wb.addWorksheet('Nómina');
  ws1.columns = [
    { key: 'a', width: 6  },   // #
    { key: 'b', width: 26 },   // Suplidor
    { key: 'c', width: 30 },   // Concepto
    { key: 'd', width: 10 },   // Unidad
    { key: 'e', width: 10 },   // Cantidad
    { key: 'f', width: 16 },   // Precio Unit.
    { key: 'g', width: 18 },   // Monto a Pagar
    { key: 'h', width: 20 },   // Banco
    { key: 'i', width: 24 },   // No. Cuenta
    { key: 'j', width: 18 },   // Proyecto
  ];
  const COLS1 = 10;
  addTitle(ws1, `Nómina NOM-${String(payroll.number).padStart(3, '0')} — ${payroll.project.name}`, COLS1);

  // Info block
  const infoRows = [
    ['Proyecto',    `${payroll.project.code} — ${payroll.project.name}`],
    ['Período',     `${payroll.periodStart.toISOString().slice(0,10)} al ${payroll.periodEnd.toISOString().slice(0,10)}`],
    ['Tipo',        typeLabel],
    ['Estado',      statusMap[payroll.status] ?? payroll.status],
    ['Descripción', payroll.description],
    ['Creado por',  payroll.createdBy.name],
    ...(payroll.approvedBy ? [['Aprobado por',   payroll.approvedBy.name]] : []),
    ...(payroll.paidAt     ? [['Pagado el',       (payroll as any).paymentDate
                                                    ? new Date((payroll as any).paymentDate).toISOString().slice(0,10)
                                                    : payroll.paidAt.toISOString().slice(0,10)]] : []),
    ...((payroll as any).paymentMethod ? [['Forma de pago', (payroll as any).paymentMethod === 'CASH' ? 'Efectivo' : 'Transferencia']] : []),
    ...((payroll as any).paymentBank      ? [['Banco de pago',    (payroll as any).paymentBank]]      : []),
    ...((payroll as any).paymentReference ? [['No. transacción',  (payroll as any).paymentReference]] : []),
    ...((payroll as any).receiptNumber    ? [['No. de recibo',    (payroll as any).receiptNumber]]    : []),
    ...((payroll as any).receivedBy       ? [['Recibido por',     (payroll as any).receivedBy]]       : []),
  ];
  infoRows.forEach(([label, value]) => {
    const row = ws1.addRow([label, value]);
    ws1.mergeCells(row.number, 2, row.number, COLS1);
    row.getCell(1).font = { bold: true, size: 9 };
    row.getCell(2).font = { size: 9 };
    row.height = 16;
  });
  ws1.addRow([]);

  // Lines header
  const headerRow1 = ws1.addRow([
    '#', 'Nombre Suplidor', 'Concepto de Servicio',
    'Unidad', 'Cantidad', 'Precio Unit.',
    'Monto a Pagar', 'Banco', 'No. Cuenta Bancaria', 'Proyecto',
  ]);
  styleHeader(ws1, headerRow1.number);
  ws1.views = [{ state: 'frozen', ySplit: headerRow1.number }];

  payroll.lines.forEach((line, i) => {
    const r = ws1.addRow([
      line.lineNumber,
      (line as any).supplierName ?? '',
      line.description,
      line.unit,
      Number(line.quantity),
      Number(line.unitPrice),
      Number(line.subtotal),
      (line as any).bankName    ?? '',
      (line as any).bankAccount ?? '',
      payroll.project.name,
    ]);
    if (i % 2 === 1) {
      r.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } }; });
    }
    r.getCell(5).numFmt = '#,##0.000';
    r.getCell(6).numFmt = '#,##0.00';
    r.getCell(7).numFmt = '#,##0.00';
    r.height = 16;
  });

  // Total row
  ws1.addRow([]);
  const totalRow = ws1.addRow(['', '', '', '', '', 'TOTAL', Number(payroll.totalAmount), '', '', '']);
  ws1.mergeCells(totalRow.number, 1, totalRow.number, 5);
  totalRow.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } };
    c.font = { bold: true, color: { argb: DARK }, size: 11 };
    c.alignment = { horizontal: 'right' };
  });
  totalRow.getCell(7).numFmt = '#,##0.00';

  // ── Sheet 2: Resumen ─────────────────────────────────────
  const ws2 = wb.addWorksheet('Resumen');
  ws2.columns = [
    { key: 'a', width: 22 },
    { key: 'b', width: 40 },
  ];
  addTitle(ws2, 'Resumen de Nómina', 2);
  const summaryData = [
    ['Número',       `NOM-${String(payroll.number).padStart(3, '0')}`],
    ['Proyecto',     `${payroll.project.code} — ${payroll.project.name}`],
    ['Tipo',         typeLabel],
    ['Estado',       statusMap[payroll.status]],
    ['Período',      `${payroll.periodStart.toISOString().slice(0,10)} al ${payroll.periodEnd.toISOString().slice(0,10)}`],
    ['Total líneas', String(payroll.lines.length)],
    ['Monto Total',  `RD$ ${Number(payroll.totalAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`],
    ['Creado por',   payroll.createdBy.name],
    ['Aprobado por', payroll.approvedBy?.name ?? '—'],
    ['Pagado el',    payroll.paidAt ? payroll.paidAt.toISOString().slice(0,10) : '—'],
    ['Notas',        payroll.notes ?? '—'],
  ];
  summaryData.forEach(([label, value]) => {
    const row = ws2.addRow([label, value]);
    row.getCell(1).font = { bold: true, size: 10, color: { argb: DARK } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } };
    row.getCell(2).font = { size: 10 };
    row.height = 18;
  });

  const filename = `SERVINGMI-nomina-${String(payroll.number).padStart(3,'0')}-${payroll.project.code}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// ═══════════════════════════════════════════════════════════════
// ─── WORD EXPORT ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
const BORDER_COLOR = 'CCCCCC';
const HEADER_FILL  = 'F5C218';
const DARK_TEXT    = '1C1C1C';
const ROW_ALT      = 'F9F9F9';

function makeBorders(color = BORDER_COLOR) {
  const b = { style: BorderStyle.SINGLE, size: 1, color } as const;
  return { top: b, bottom: b, left: b, right: b };
}

function hCell(text: string, width: number): TableCell {
  return new TableCell({
    borders: makeBorders(),
    width:   { size: width, type: WidthType.DXA },
    shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 18, font: 'Arial', color: DARK_TEXT })],
    })],
  });
}

function dCell(text: string, width: number, alt = false, align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.LEFT): TableCell {
  return new TableCell({
    borders: makeBorders(),
    width:   { size: width, type: WidthType.DXA },
    shading: { fill: alt ? ROW_ALT : 'FFFFFF', type: ShadingType.CLEAR },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text, size: 17, font: 'Arial', color: DARK_TEXT })],
    })],
  });
}

function infoRow(label: string, value: string, tableWidth: number): TableRow {
  const labelW = 2000;
  const valueW = tableWidth - labelW;
  return new TableRow({
    children: [
      new TableCell({
        borders: makeBorders(),
        width: { size: labelW, type: WidthType.DXA },
        shading: { fill: 'F2F2F2', type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: label, bold: true, size: 17, font: 'Arial', color: DARK_TEXT })],
        })],
      }),
      new TableCell({
        borders: makeBorders(),
        width: { size: valueW, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({ text: value, size: 17, font: 'Arial', color: DARK_TEXT })],
        })],
      }),
    ],
  });
}

export async function exportPayrollDocx(id: string, res: Response) {
  const payroll = await prisma.payroll.findUnique({ where: { id }, include: PAYROLL_INCLUDE });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');

  const typeLabel  = payroll.type === 'LABOR' ? 'Mano de Obra' : 'Servicios';
  const statusMap: Record<string, string> = {
    DRAFT: 'Borrador', APPROVED: 'Aprobada', PAID: 'Pagada', VOIDED: 'Anulada',
  };
  const nomNum  = `NOM-${String(payroll.number).padStart(3, '0')}`;
  const dateStr = new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' });

  // Page: Letter (12240 x 15840), 1" margins → content width = 9360 DXA
  const PAGE_W     = 12240;
  const PAGE_H     = 15840;
  const MARGIN     = 1080; // 0.75"
  const CONTENT_W  = PAGE_W - MARGIN * 2; // 10080 DXA

  // Column widths for lines table (10 cols), must sum to CONTENT_W = 10080 DXA
  // #(400) | Suplidor(1500) | Concepto(1800) | Unidad(600) | Cant(600) | P.Unit(1000) | Monto(1000) | Banco(1200) | No.Cuenta(1280) | Proyecto(700)
  // 400+1500+1800+600+600+1000+1000+1200+1280+700 = 10080 ✓
  const COL_W = [400, 1500, 1800, 600, 600, 1000, 1000, 1200, 1280, 700];

  // ─ Info table ────────────────────────────────────────────
  const INFO_W = CONTENT_W;
  const infoTableRows = [
    infoRow('Número:', nomNum, INFO_W),
    infoRow('Proyecto:', `${payroll.project.code} — ${payroll.project.name}`, INFO_W),
    infoRow('Período:', `${payroll.periodStart.toISOString().slice(0,10)} al ${payroll.periodEnd.toISOString().slice(0,10)}`, INFO_W),
    infoRow('Tipo:', typeLabel, INFO_W),
    infoRow('Estado:', statusMap[payroll.status] ?? payroll.status, INFO_W),
    infoRow('Descripción:', payroll.description, INFO_W),
    ...(payroll.approvedBy ? [infoRow('Aprobado por:', payroll.approvedBy.name, INFO_W)] : []),
    ...(payroll.paidAt     ? [infoRow('Pagado el:', (payroll as any).paymentDate
                                ? new Date((payroll as any).paymentDate).toISOString().slice(0,10)
                                : payroll.paidAt.toISOString().slice(0,10), INFO_W)] : []),
    ...((payroll as any).paymentMethod    ? [infoRow('Forma de pago:',   (payroll as any).paymentMethod === 'CASH' ? 'Efectivo' : 'Transferencia', INFO_W)] : []),
    ...((payroll as any).paymentBank      ? [infoRow('Banco de pago:',   (payroll as any).paymentBank, INFO_W)]      : []),
    ...((payroll as any).paymentReference ? [infoRow('No. transacción:', (payroll as any).paymentReference, INFO_W)] : []),
    ...((payroll as any).receiptNumber    ? [infoRow('No. de recibo:',   (payroll as any).receiptNumber, INFO_W)]    : []),
    ...((payroll as any).receivedBy       ? [infoRow('Recibido por:',    (payroll as any).receivedBy, INFO_W)]       : []),
    ...(payroll.notes      ? [infoRow('Notas:', payroll.notes, INFO_W)] : []),
  ];

  // ─ Lines table ────────────────────────────────────────────
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      hCell('#',                    COL_W[0]),
      hCell('Nombre Suplidor',      COL_W[1]),
      hCell('Concepto de Servicio', COL_W[2]),
      hCell('Unidad',               COL_W[3]),
      hCell('Cantidad',             COL_W[4]),
      hCell('Precio Unit.',         COL_W[5]),
      hCell('Monto a Pagar',        COL_W[6]),
      hCell('Banco',                COL_W[7]),
      hCell('No. Cuenta',           COL_W[8]),
      hCell('Proyecto',             COL_W[9]),
    ],
  });

  const dataRows = payroll.lines.map((line, i) => {
    const alt = i % 2 === 1;
    return new TableRow({
      children: [
        dCell(String(line.lineNumber),                        COL_W[0], alt, AlignmentType.CENTER),
        dCell((line as any).supplierName ?? '—',              COL_W[1], alt),
        dCell(line.description,                               COL_W[2], alt),
        dCell(line.unit,                                      COL_W[3], alt, AlignmentType.CENTER),
        dCell(Number(line.quantity).toFixed(3),               COL_W[4], alt, AlignmentType.RIGHT),
        dCell(`RD$ ${Number(line.unitPrice).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,  COL_W[5], alt, AlignmentType.RIGHT),
        dCell(`RD$ ${Number(line.subtotal).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,   COL_W[6], alt, AlignmentType.RIGHT),
        dCell((line as any).bankName    ?? '—',               COL_W[7], alt),
        dCell((line as any).bankAccount ?? '—',               COL_W[8], alt),
        dCell(payroll.project.name,                           COL_W[9], alt),
      ],
    });
  });

  // Total row
  const totalTableRow = new TableRow({
    children: [
      new TableCell({
        columnSpan: 6,
        borders: makeBorders(),
        width: { size: COL_W.slice(0, 6).reduce((a, b) => a + b, 0), type: WidthType.DXA },
        shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'TOTAL NÓMINA', bold: true, size: 20, font: 'Arial', color: DARK_TEXT })],
        })],
      }),
      new TableCell({
        columnSpan: 4,
        borders: makeBorders(),
        width: { size: COL_W.slice(6).reduce((a, b) => a + b, 0), type: WidthType.DXA },
        shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({
            text: `RD$ ${Number(payroll.totalAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
            bold: true, size: 20, font: 'Arial', color: DARK_TEXT,
          })],
        })],
      }),
    ],
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'SERVINGMI — Servicios de Ingeniería & Minería', bold: true, size: 18, font: 'Arial', color: DARK_TEXT }),
                new TextRun({ text: `\t${dateStr}`, size: 17, font: 'Arial', color: '666666' }),
              ],
              tabStops: [{ type: 'right' as any, position: CONTENT_W }],
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: HEADER_FILL, space: 1 } },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: `Nómina ${nomNum} — ${payroll.project.name}`, size: 16, font: 'Arial', color: '888888' }),
                new TextRun({ text: '\tPágina ', size: 16, font: 'Arial', color: '888888' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '888888' }),
                new TextRun({ text: ' de ', size: 16, font: 'Arial', color: '888888' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: 'Arial', color: '888888' }),
              ],
              tabStops: [{ type: 'right' as any, position: CONTENT_W }],
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: HEADER_FILL, space: 1 } },
            }),
          ],
        }),
      },
      children: [
        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [
            new TextRun({ text: `NÓMINA ${nomNum}`, bold: true, size: 32, font: 'Arial', color: DARK_TEXT }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 400 },
          children: [
            new TextRun({ text: `${typeLabel} — ${statusMap[payroll.status] ?? payroll.status}`, size: 22, font: 'Arial', color: '555555' }),
          ],
        }),

        // Info table
        new Paragraph({
          spacing: { before: 0, after: 160 },
          children: [new TextRun({ text: 'Información General', bold: true, size: 22, font: 'Arial', color: DARK_TEXT })],
        }),
        new Table({
          width: { size: INFO_W, type: WidthType.DXA },
          columnWidths: [2000, INFO_W - 2000],
          rows: infoTableRows,
        }),

        // Lines table
        new Paragraph({
          spacing: { before: 400, after: 160 },
          children: [new TextRun({ text: 'Detalle de Líneas', bold: true, size: 22, font: 'Arial', color: DARK_TEXT })],
        }),
        new Table({
          width: { size: CONTENT_W, type: WidthType.DXA },
          columnWidths: COL_W,
          rows: [headerRow, ...dataRows, totalTableRow],
        }),

        // Signature block
        new Paragraph({ spacing: { before: 600, after: 0 }, children: [new TextRun('')] }),
        new Paragraph({
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: 'Firma y sello de aprobación', size: 18, font: 'Arial', color: '888888', italics: true })],
        }),
        new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR } },
          spacing: { before: 600, after: 80 },
          children: [new TextRun({ text: 'Nombre: ___________________________________', size: 18, font: 'Arial', color: DARK_TEXT })],
        }),
        new Paragraph({
          spacing: { before: 80, after: 80 },
          children: [new TextRun({ text: 'Cargo: ____________________________________', size: 18, font: 'Arial', color: DARK_TEXT })],
        }),
        new Paragraph({
          spacing: { before: 80, after: 0 },
          children: [new TextRun({ text: `Fecha: ____________________________________`, size: 18, font: 'Arial', color: DARK_TEXT })],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `SERVINGMI-nomina-${String(payroll.number).padStart(3,'0')}-${payroll.project.code}.docx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}
