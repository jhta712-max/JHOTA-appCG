import prisma from '../../config/database';
import { Response } from 'express';
import ExcelJS from 'exceljs';

export interface CreditLineSummaryItem {
  supplierId: string;
  supplierName: string;
  supplierRnc: string | null;
  creditLineId: string;
  creditLimit: number;
  consumed: number;
  paid: number;
  pending: number;
  available: number;
  isActive: boolean;
  updatedAt: Date;
}

export interface CreditSummary {
  totalPending: number;
  totalAvailable: number;
  totalLimit: number;
  activeLines: number;
  lines: CreditLineSummaryItem[];
}

function lineStatus(item: CreditLineSummaryItem): string {
  if (item.pending === 0) return 'SIN DEUDA';
  const ratio = item.available / item.creditLimit;
  if (ratio >= 0.2) return 'EN ORDEN';
  if (ratio >= 0.1) return 'BAJO';
  return 'CRÍTICO';
}

export async function getCreditSummary(includeInactive = false): Promise<CreditSummary> {
  const lines = await prisma.supplierCreditLine.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      payments: { select: { amount: true } },
      supplier: { select: { id: true, name: true, rnc: true } },
    },
  });

  const items: CreditLineSummaryItem[] = await Promise.all(
    lines.map(async (line) => {
      const agg = await prisma.expense.aggregate({
        where: { creditLineId: line.id, status: { not: 'VOIDED' } },
        _sum: { amount: true },
      });
      const consumed = Number(agg._sum.amount ?? 0);
      const paid = line.payments.reduce((s, p) => s + Number(p.amount), 0);
      const pending = Math.max(consumed - paid, 0);
      const available = Math.max(Number(line.creditLimit) - pending, 0);

      return {
        supplierId: line.supplier.id,
        supplierName: line.supplier.name,
        supplierRnc: line.supplier.rnc ?? null,
        creditLineId: line.id,
        creditLimit: Number(line.creditLimit),
        consumed,
        paid,
        pending,
        available,
        isActive: line.isActive,
        updatedAt: line.updatedAt,
      };
    })
  );

  items.sort((a, b) => b.pending - a.pending);

  return {
    totalPending: items.reduce((s, l) => s + l.pending, 0),
    totalAvailable: items.reduce((s, l) => s + l.available, 0),
    totalLimit: items.reduce((s, l) => s + l.creditLimit, 0),
    activeLines: items.filter((l) => l.isActive).length,
    lines: items,
  };
}

export async function generateCreditReportXlsx(res: Response, includeInactive = false): Promise<void> {
  const summary = await getCreditSummary(includeInactive);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Estado de Crédito');

  ws.mergeCells('A1:J1');
  ws.getCell('A1').value = 'ESTADO DE CRÉDITO POR SUPLIDOR — JHOTA Construcciones';
  ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:J2');
  ws.getCell('A2').value = `Generado: ${new Date().toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })}`;
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.getRow(2).height = 18;

  const headerRow = ws.addRow([
    'Suplidor',
    'RNC',
    'Límite Crédito',
    'Consumido',
    'Pagado',
    'Pendiente (Deuda)',
    'Disponible',
    '% Utilización',
    'Estado',
    'Última Actividad',
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C1C1C' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  ws.getRow(3).height = 22;

  const fmt = (n: number) => Number(n.toFixed(2));

  for (const item of summary.lines) {
    const pct = item.creditLimit > 0 ? ((item.pending / item.creditLimit) * 100).toFixed(1) : '0.0';
    const status = lineStatus(item);
    const row = ws.addRow([
      item.supplierName,
      item.supplierRnc ?? '',
      fmt(item.creditLimit),
      fmt(item.consumed),
      fmt(item.paid),
      fmt(item.pending),
      fmt(item.available),
      `${pct}%`,
      status,
      item.updatedAt.toLocaleDateString('es-DO'),
    ]);

    const statusCell = row.getCell(9);
    const pendingCell = row.getCell(6);
    if (status === 'CRÍTICO') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
      statusCell.font = { bold: true, color: { argb: 'FF991B1B' } };
      pendingCell.font = { bold: true, color: { argb: 'FF991B1B' } };
    } else if (status === 'BAJO') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      statusCell.font = { bold: true, color: { argb: 'FF854D0E' } };
    } else if (status === 'EN ORDEN') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      statusCell.font = { bold: true, color: { argb: 'FF166534' } };
    }
  }

  const totalsRow = ws.addRow([
    'TOTALES',
    '',
    fmt(summary.totalLimit),
    '',
    '',
    fmt(summary.totalPending),
    fmt(summary.totalAvailable),
    '',
    '',
    '',
  ]);
  totalsRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });

  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 18;
  ws.getColumn(7).width = 14;
  ws.getColumn(8).width = 14;
  ws.getColumn(9).width = 12;
  ws.getColumn(10).width = 18;
  [3, 4, 5, 6, 7].forEach((col) => {
    ws.getColumn(col).numFmt = '#,##0.00';
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="credito-suplidores-${Date.now()}.xlsx"`
  );
  await wb.xlsx.write(res);
  res.end();
}
