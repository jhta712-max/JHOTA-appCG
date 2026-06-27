import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { buildPaginatedResponse } from '../../utils/pagination';
import { calculateLine } from './admin-payroll.calculations';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import type {
  CreatePayrollInput, ListPayrollsInput,
  MarkPaidInput, VoidPayrollInput, UpdateLineInput,
} from './admin-payrolls.schema';

const PAYROLL_INCLUDE = {
  createdBy:  { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  voidedBy:   { select: { id: true, name: true } },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: { employee: { select: { id: true, name: true, position: true, bankName: true, bankAccount: true } } },
  },
} as const;

function periodTypeToFrequency(pt: string): 'MONTHLY' | 'BIWEEKLY' {
  return pt === 'MONTHLY' ? 'MONTHLY' : 'BIWEEKLY';
}

export async function listPayrolls(query: ListPayrollsInput) {
  const where: any = {};
  if (query.status)     where.status     = query.status;
  if (query.periodType) where.periodType = query.periodType;
  if (query.year) {
    where.periodStart = {
      gte: new Date(`${query.year}-01-01`),
      lte: new Date(`${query.year}-12-31`),
    };
  }

  const pagination = { page: query.page, limit: query.limit, skip: (query.page - 1) * query.limit };

  const [data, total] = await Promise.all([
    prisma.administrativePayroll.findMany({
      where,
      include: {
        createdBy:  { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.administrativePayroll.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, pagination);
}

export async function getPayrollById(id: string) {
  const p = await prisma.administrativePayroll.findUnique({ where: { id }, include: PAYROLL_INCLUDE });
  if (!p) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  return p;
}

export async function createPayroll(data: CreatePayrollInput, userId: string) {
  const frequency = periodTypeToFrequency(data.periodType);

  const employees = await prisma.administrativeEmployee.findMany({
    where: { status: 'ACTIVE', paymentFrequency: frequency, deletedAt: null },
    include: { benefits: { where: { isActive: true } } },
    orderBy: { name: 'asc' },
  });

  if (employees.length === 0) {
    throw new AppError(400, `No hay empleados activos con frecuencia ${frequency}`, 'NO_EMPLOYEES');
  }

  return prisma.$transaction(async (tx) => {
    const maxNum = await tx.administrativePayroll.aggregate({ _max: { number: true } });
    const number = (maxNum._max.number ?? 0) + 1;

    const payroll = await tx.administrativePayroll.create({
      data: {
        number,
        periodType:  data.periodType,
        periodStart: new Date(data.periodStart),
        periodEnd:   new Date(data.periodEnd),
        notes:       data.notes ?? null,
        createdById: userId,
      },
    });

    let totalGross = 0, totalDeductions = 0, totalNet = 0;

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const benefits = emp.benefits.map((b) => ({
        name:       b.name,
        amount:     Number(b.amount),
        affectsISR: b.affectsISR,
      }));

      const calc = calculateLine(Number(emp.baseSalary), benefits, data.periodType as any);

      await tx.administrativePayrollLine.create({
        data: {
          payrollId:        payroll.id,
          employeeId:       emp.id,
          lineNumber:       i + 1,
          baseSalary:       emp.baseSalary,
          benefitsTotal:    calc.benefitsTotal,
          benefitsSnapshot: benefits,
          taxableBase:      calc.taxableBase,
          afpEmployee:      calc.afpEmployee,
          tssEmployee:      calc.tssEmployee,
          isr:              calc.isr,
          otherDeductions:  0,
          grossAmount:      calc.grossAmount,
          netAmount:        calc.netAmount,
        },
      });

      totalGross      += calc.grossAmount;
      totalDeductions += calc.afpEmployee + calc.tssEmployee + calc.isr;
      totalNet        += calc.netAmount;
    }

    return tx.administrativePayroll.update({
      where: { id: payroll.id },
      data: {
        totalGross:      Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalNet:        Math.round(totalNet * 100) / 100,
      },
      include: PAYROLL_INCLUDE,
    });
  });
}

export async function updateLine(payrollId: string, lineId: string, data: UpdateLineInput) {
  const payroll = await prisma.administrativePayroll.findUnique({ where: { id: payrollId } });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (payroll.status !== 'DRAFT') throw new AppError(400, 'Solo se editan líneas en borrador', 'INVALID_STATUS');

  const line = await prisma.administrativePayrollLine.findFirst({
    where: { id: lineId, payrollId },
  });
  if (!line) throw new AppError(404, 'Línea no encontrada', 'NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    const gross = Number(line.grossAmount);
    const afp   = Number(line.afpEmployee);
    const tss   = Number(line.tssEmployee);
    const isr   = Number(line.isr);
    const newNet = Math.round((gross - afp - tss - isr - data.otherDeductions) * 100) / 100;

    await tx.administrativePayrollLine.update({
      where: { id: lineId },
      data: {
        otherDeductions:     data.otherDeductions,
        otherDeductionsNote: data.otherDeductionsNote ?? null,
        netAmount:           newNet,
      },
    });

    // Recalcular totales del header
    const lines = await tx.administrativePayrollLine.findMany({ where: { payrollId } });
    const totalGross      = lines.reduce((s, l) => s + Number(l.grossAmount), 0);
    const totalDeductions = lines.reduce((s, l) => s + Number(l.afpEmployee) + Number(l.tssEmployee) + Number(l.isr) + Number(l.otherDeductions), 0);
    const totalNet        = lines.reduce((s, l) => s + Number(l.netAmount), 0);

    return tx.administrativePayroll.update({
      where: { id: payrollId },
      data: {
        totalGross:      Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalNet:        Math.round(totalNet * 100) / 100,
      },
      include: PAYROLL_INCLUDE,
    });
  });
}

export async function approvePayroll(id: string, userId: string) {
  const p = await prisma.administrativePayroll.findUnique({ where: { id } });
  if (!p) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (p.status !== 'DRAFT') throw new AppError(400, 'Solo se aprueban nóminas en borrador', 'INVALID_STATUS');

  return prisma.administrativePayroll.update({
    where: { id },
    data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() },
    include: PAYROLL_INCLUDE,
  });
}

export async function markPayrollPaid(id: string, data: MarkPaidInput) {
  const p = await prisma.administrativePayroll.findUnique({ where: { id } });
  if (!p) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (p.status !== 'APPROVED') throw new AppError(400, 'Solo se pagan nóminas aprobadas', 'INVALID_STATUS');

  return prisma.administrativePayroll.update({
    where: { id },
    data: {
      status:           'PAID',
      paidAt:           new Date(),
      paymentMethod:    data.paymentMethod,
      paymentDate:      new Date(data.paymentDate),
      paymentBank:      data.paymentBank      ?? null,
      paymentReference: data.paymentReference ?? null,
    },
    include: PAYROLL_INCLUDE,
  });
}

export async function voidPayroll(id: string, data: VoidPayrollInput, userId: string) {
  const p = await prisma.administrativePayroll.findUnique({ where: { id } });
  if (!p) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (p.status === 'VOIDED') throw new AppError(400, 'La nómina ya está anulada', 'ALREADY_VOIDED');

  return prisma.administrativePayroll.update({
    where: { id },
    data: { status: 'VOIDED', voidReason: data.voidReason, voidedById: userId, voidedAt: new Date() },
    include: PAYROLL_INCLUDE,
  });
}

export async function exportExcel(id: string, res: Response) {
  const p = await prisma.administrativePayroll.findUnique({ where: { id }, include: PAYROLL_INCLUDE });
  if (!p) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');

  const wb = new ExcelJS.Workbook();

  // ── Hoja 1: Resumen ──────────────────────────────────────────
  const ws1 = wb.addWorksheet('Resumen');
  ws1.addRow(['JHOTA CONSTRUCCIONES — NÓMINA ADMINISTRATIVA']);
  ws1.getRow(1).font = { bold: true, size: 14 };
  ws1.addRow([]);
  ws1.addRow(['Número', `NOM-ADMIN-${String(p.number).padStart(3, '0')}`]);
  ws1.addRow(['Período', `${p.periodStart.toISOString().slice(0,10)} al ${p.periodEnd.toISOString().slice(0,10)}`]);
  ws1.addRow(['Tipo', p.periodType]);
  ws1.addRow(['Estado', p.status]);
  ws1.addRow([]);
  ws1.addRow(['Total Bruto', Number(p.totalGross)]);
  ws1.addRow(['Total Deducciones', Number(p.totalDeductions)]);
  ws1.addRow(['Total Neto', Number(p.totalNet)]);
  ['H8', 'H9', 'H10'].forEach((ref) => { ws1.getCell(ref).numFmt = '#,##0.00'; });

  // ── Hoja 2: Detalle ──────────────────────────────────────────
  const ws2 = wb.addWorksheet('Detalle');
  const headers = ['#','Empleado','Cargo','Salario Base','Beneficios','Bruto','AFP','TSS','ISR','Otros Desc.','Neto','Banco','Cuenta'];
  ws2.addRow(headers);
  ws2.getRow(1).font = { bold: true };
  ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C1C1C' } };
  ws2.getRow(1).font = { bold: true, color: { argb: 'FFF5C218' } };

  for (const line of p.lines) {
    ws2.addRow([
      line.lineNumber,
      line.employee.name,
      line.employee.position,
      Number(line.baseSalary),
      Number(line.benefitsTotal),
      Number(line.grossAmount),
      Number(line.afpEmployee),
      Number(line.tssEmployee),
      Number(line.isr),
      Number(line.otherDeductions),
      Number(line.netAmount),
      line.employee.bankName   ?? '',
      line.employee.bankAccount ?? '',
    ]);
  }

  // Formato numérico columnas D-K
  ws2.columns.forEach((col, i) => {
    if (i >= 3 && i <= 10) col.numFmt = '#,##0.00';
    col.width = i === 1 ? 30 : i === 2 ? 20 : 15;
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="nomina-admin-${p.number}.xlsx"`);
  await wb.xlsx.write(res);
}
