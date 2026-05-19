import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import prisma from '../../config/database';

// ─── Helpers de formato ───────────────────────────────────────────────────────

function fmtMoney(n: number | string) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency', currency: 'DOP', minimumFractionDigits: 2,
  }).format(Number(n));
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('es-DO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo', TRANSFER: 'Transferencia',
  CARD: 'Tarjeta', CHECK: 'Cheque', OTHER: 'Otro',
};

// ─── Estilos Excel reutilizables ─────────────────────────────────────────────

function headerStyle(wb: ExcelJS.Workbook): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      bottom: { style: 'thin', color: { argb: 'FF1D4ED8' } },
    },
  };
}

function addLogoRow(ws: ExcelJS.Worksheet, title: string, subtitle: string) {
  ws.mergeCells('A1:H1');
  ws.getCell('A1').value   = title;
  ws.getCell('A1').font    = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
  ws.getCell('A1').fill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:H2');
  ws.getCell('A2').value     = subtitle;
  ws.getCell('A2').font      = { size: 10, color: { argb: 'FF6B7280' } };
  ws.getCell('A2').alignment = { horizontal: 'center' };
  ws.getRow(2).height = 18;

  // Blank row
  ws.getRow(3).height = 6;
}

// ─── REPORTE 1: Gastos de un proyecto ────────────────────────────────────────

export interface ProjectReportFilters {
  projectId: string;
  startDate?: string;
  endDate?:   string;
  status?:    string;
}

async function fetchProjectExpenses(filters: ProjectReportFilters) {
  const where: any = {
    projectId: filters.projectId,
    status: filters.status || 'ACTIVE',
  };
  if (filters.startDate || filters.endDate) {
    where.expenseDate = {};
    if (filters.startDate) where.expenseDate.gte = new Date(filters.startDate);
    if (filters.endDate)   where.expenseDate.lte = new Date(filters.endDate);
  }

  const [project, expenses] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: filters.projectId },
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.expense.findMany({
      where,
      include: {
        category:    true,
        registeredBy: { select: { name: true } },
        fiscalVoucher: true,
      },
      orderBy: { expenseDate: 'asc' },
    }),
  ]);

  return { project, expenses };
}

export async function generateProjectExpensesExcel(
  filters: ProjectReportFilters,
  res: Response,
) {
  const { project, expenses } = await fetchProjectExpenses(filters);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema Control de Gastos';
  wb.created = new Date();

  const ws = wb.addWorksheet('Gastos del Proyecto', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  // Encabezado del reporte
  addLogoRow(ws,
    `Reporte de Gastos — ${project.name}`,
    `Código: ${project.code}  |  Generado: ${fmtDate(new Date().toISOString())}`,
  );

  // Info del proyecto
  ws.mergeCells('A4:D4');
  ws.getCell('A4').value = `Cliente: ${project.client ?? 'N/A'}`;
  ws.mergeCells('E4:H4');
  ws.getCell('E4').value = `Presupuesto estimado: ${fmtMoney(project.estimatedBudget)}`;
  ws.getRow(4).font = { size: 10, color: { argb: 'FF374151' } };

  ws.getRow(5).height = 6; // espacio

  // Cabeceras de tabla
  const headers = [
    { header: 'Fecha',          key: 'date',     width: 13 },
    { header: 'Descripción',    key: 'desc',     width: 35 },
    { header: 'Categoría',      key: 'cat',      width: 20 },
    { header: 'Método pago',    key: 'method',   width: 16 },
    { header: 'Monto (RD$)',    key: 'amount',   width: 16 },
    { header: 'NCF',            key: 'ncf',      width: 16 },
    { header: 'Suplidor',       key: 'supplier', width: 25 },
    { header: 'Registrado por', key: 'by',       width: 20 },
  ];

  ws.columns = headers.map(h => ({ key: h.key, width: h.width }));
  const hRow = ws.getRow(6);
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h.header;
    Object.assign(cell, headerStyle(wb));
  });
  hRow.height = 22;

  // Datos
  let totalAmount = 0;
  expenses.forEach((e, idx) => {
    const row = ws.addRow({
      date:     fmtDate(e.expenseDate),
      desc:     e.description,
      cat:      e.category.name,
      method:   PAYMENT_LABELS[e.paymentMethod] ?? e.paymentMethod,
      amount:   Number(e.amount),
      ncf:      e.fiscalVoucher?.ncf ?? '',
      supplier: e.fiscalVoucher?.supplierName ?? '',
      by:       e.registeredBy.name,
    });

    totalAmount += Number(e.amount);

    // Zebra
    const fill = idx % 2 === 0
      ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF9FAFB' } }
      : { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } };
    row.eachCell(cell => { cell.fill = fill; cell.alignment = { vertical: 'middle' }; });

    // Monto — formato número
    const amountCell = row.getCell('amount');
    amountCell.numFmt = '"RD$"#,##0.00';
    amountCell.alignment = { horizontal: 'right' };

    if (e.status === 'VOIDED') {
      row.eachCell(cell => {
        cell.font = { color: { argb: 'FFEF4444' }, strike: true };
      });
    }
  });

  // Fila total
  const totalRow = ws.addRow({
    desc:   'TOTAL',
    amount: totalAmount,
  });
  totalRow.getCell('desc').font  = { bold: true };
  totalRow.getCell('amount').numFmt = '"RD$"#,##0.00';
  totalRow.getCell('amount').font   = { bold: true, color: { argb: 'FF1D4ED8' } };
  totalRow.getCell('amount').alignment = { horizontal: 'right' };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

  // Resumen financiero (columnas J-K)
  const summaryData = [
    ['Presupuesto estimado', Number(project.estimatedBudget)],
    ['Total gastado',        totalAmount],
    ['Disponible',           Number(project.estimatedBudget) - totalAmount],
    ['% Utilizado',          Number(project.estimatedBudget) > 0
      ? (totalAmount / Number(project.estimatedBudget)) * 100 : 0],
  ];

  summaryData.forEach(([label, val], i) => {
    const r = ws.getRow(6 + i);
    const labelCell  = r.getCell(10);
    const valueCell  = r.getCell(11);
    labelCell.value  = label as string;
    labelCell.font   = { bold: true, size: 10 };
    labelCell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    labelCell.alignment = { horizontal: 'right' };

    if (label === '% Utilizado') {
      valueCell.value  = (val as number) / 100;
      valueCell.numFmt = '0.0%';
    } else {
      valueCell.value  = val as number;
      valueCell.numFmt = '"RD$"#,##0.00';
    }
    valueCell.alignment = { horizontal: 'right' };

    if (label === 'Disponible' && (val as number) < 0) {
      valueCell.font = { color: { argb: 'FFEF4444' }, bold: true };
    }
  });

  ws.getColumn(10).width = 22;
  ws.getColumn(11).width = 18;

  // Bordes de tabla
  const firstDataRow = 7;
  const lastDataRow  = 6 + expenses.length;
  for (let r = firstDataRow; r <= lastDataRow; r++) {
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
    });
  }

  // Enviar
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="gastos-${project.code}-${Date.now()}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

// ─── REPORTE 2: Reporte fiscal NCF ───────────────────────────────────────────

export interface FiscalReportFilters {
  projectId?: string;
  startDate?: string;
  endDate?:   string;
}

export async function generateFiscalReportExcel(
  filters: FiscalReportFilters,
  res: Response,
) {
  const where: any = {
    hasFiscalDoc: true,
    status: 'ACTIVE',
    fiscalVoucher: { isNot: null },
  };
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.startDate || filters.endDate) {
    where.expenseDate = {};
    if (filters.startDate) where.expenseDate.gte = new Date(filters.startDate);
    if (filters.endDate)   where.expenseDate.lte = new Date(filters.endDate);
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      project:      { select: { code: true, name: true } },
      category:     true,
      fiscalVoucher: true,
    },
    orderBy: { expenseDate: 'asc' },
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Comprobantes Fiscales', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  });

  const subtitle = `Período: ${filters.startDate ? fmtDate(filters.startDate) : 'Inicio'} → ${filters.endDate ? fmtDate(filters.endDate) : 'Hoy'}  |  Generado: ${fmtDate(new Date().toISOString())}`;
  addLogoRow(ws, 'Reporte de Comprobantes Fiscales (NCF)', subtitle);

  const headers = [
    { header: 'Fecha',         key: 'date',         width: 13 },
    { header: 'Proyecto',      key: 'project',      width: 18 },
    { header: 'Descripción',   key: 'desc',         width: 30 },
    { header: 'NCF',           key: 'ncf',          width: 16 },
    { header: 'Tipo NCF',      key: 'ncfType',      width: 15 },
    { header: 'RNC Suplidor',  key: 'rnc',          width: 14 },
    { header: 'Suplidor',      key: 'supplier',     width: 28 },
    { header: 'ITBIS (RD$)',   key: 'itbis',        width: 15 },
    { header: 'Monto (RD$)',   key: 'amount',       width: 16 },
  ];

  ws.columns = headers.map(h => ({ key: h.key, width: h.width }));
  const hRow = ws.getRow(6);
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h.header;
    Object.assign(cell, headerStyle(wb));
  });
  hRow.height = 22;

  let totalMonto = 0;
  let totalITBIS = 0;

  expenses.forEach((e, idx) => {
    const fv = e.fiscalVoucher!;
    const row = ws.addRow({
      date:     fmtDate(e.expenseDate),
      project:  e.project.code,
      desc:     e.description,
      ncf:      fv.ncf,
      ncfType:  fv.isElectronic ? 'e-NCF' : 'NCF Trad.',
      rnc:      fv.supplierRnc,
      supplier: fv.supplierName,
      itbis:    Number(fv.itbisAmount ?? 0),
      amount:   Number(e.amount),
    });

    totalMonto += Number(e.amount);
    totalITBIS += Number(fv.itbisAmount ?? 0);

    const fill = idx % 2 === 0
      ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF9FAFB' } }
      : { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } };
    row.eachCell(cell => { cell.fill = fill; cell.alignment = { vertical: 'middle' }; });
    row.getCell('itbis').numFmt  = '"RD$"#,##0.00';
    row.getCell('amount').numFmt = '"RD$"#,##0.00';
    row.getCell('itbis').alignment  = { horizontal: 'right' };
    row.getCell('amount').alignment = { horizontal: 'right' };

    // Resaltar e-NCF en azul claro
    if (fv.isElectronic) {
      row.getCell('ncfType').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      row.getCell('ncfType').font = { color: { argb: 'FF1D4ED8' }, bold: true };
    }
  });

  // Total
  const totalRow = ws.addRow({
    desc:   `TOTAL (${expenses.length} comprobantes)`,
    itbis:  totalITBIS,
    amount: totalMonto,
  });
  totalRow.getCell('desc').font    = { bold: true };
  totalRow.getCell('itbis').numFmt  = '"RD$"#,##0.00';
  totalRow.getCell('amount').numFmt = '"RD$"#,##0.00';
  totalRow.getCell('itbis').font    = { bold: true };
  totalRow.getCell('amount').font   = { bold: true, color: { argb: 'FF1D4ED8' } };
  totalRow.getCell('itbis').alignment  = { horizontal: 'right' };
  totalRow.getCell('amount').alignment = { horizontal: 'right' };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="reporte-fiscal-${Date.now()}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

// ─── REPORTE 3: Resumen de todos los proyectos ───────────────────────────────

export async function generateProjectsSummaryExcel(res: Response) {
  const projects = await prisma.project.findMany({
    where: { status: { not: 'CANCELLED' } },
    include: {
      _count: { select: { expenses: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const summaries = await Promise.all(projects.map(async (p) => {
    const agg = await prisma.expense.aggregate({
      where: { projectId: p.id, status: 'ACTIVE' },
      _sum: { amount: true },
    });
    const spent = Number(agg._sum.amount ?? 0);
    return {
      ...p,
      totalSpent: spent,
      remaining:  Number(p.estimatedBudget) - spent,
      pctUsed:    Number(p.estimatedBudget) > 0 ? spent / Number(p.estimatedBudget) : 0,
    };
  }));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Resumen de Proyectos');

  addLogoRow(ws,
    'Resumen Financiero — Todos los Proyectos',
    `Generado: ${fmtDate(new Date().toISOString())}`,
  );

  const headers = [
    { header: 'Código',        key: 'code',      width: 18 },
    { header: 'Proyecto',      key: 'name',      width: 35 },
    { header: 'Estado',        key: 'status',    width: 14 },
    { header: 'Cliente',       key: 'client',    width: 22 },
    { header: 'Presupuesto',   key: 'budget',    width: 18 },
    { header: 'Gastado',       key: 'spent',     width: 18 },
    { header: 'Disponible',    key: 'remaining', width: 18 },
    { header: '% Utilizado',   key: 'pct',       width: 14 },
    { header: 'N° Gastos',     key: 'count',     width: 12 },
  ];

  ws.columns = headers.map(h => ({ key: h.key, width: h.width }));
  const hRow = ws.getRow(6);
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h.header;
    Object.assign(cell, headerStyle(wb));
  });
  hRow.height = 22;

  const STATUS_LABELS: Record<string, string> = {
    ACTIVE: 'Activo', PAUSED: 'Pausado', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
  };

  summaries.forEach((p, idx) => {
    const row = ws.addRow({
      code:      p.code,
      name:      p.name,
      status:    STATUS_LABELS[p.status] ?? p.status,
      client:    p.client ?? '',
      budget:    Number(p.estimatedBudget),
      spent:     p.totalSpent,
      remaining: p.remaining,
      pct:       p.pctUsed,
      count:     p._count.expenses,
    });

    const fill = idx % 2 === 0
      ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF9FAFB' } }
      : { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } };
    row.eachCell(cell => { cell.fill = fill; cell.alignment = { vertical: 'middle' }; });

    ['budget', 'spent', 'remaining'].forEach(k => {
      row.getCell(k).numFmt = '"RD$"#,##0.00';
      row.getCell(k).alignment = { horizontal: 'right' };
    });
    row.getCell('pct').numFmt = '0.0%';
    row.getCell('pct').alignment = { horizontal: 'center' };

    // Color semáforo en % utilizado
    const pctVal = p.pctUsed;
    const pctCell = row.getCell('pct');
    if (pctVal >= 1) {
      pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      pctCell.font = { color: { argb: 'FFDC2626' }, bold: true };
    } else if (pctVal >= 0.8) {
      pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
      pctCell.font = { color: { argb: 'FFD97706' }, bold: true };
    } else {
      pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      pctCell.font = { color: { argb: 'FF16A34A' } };
    }

    // Disponible negativo = rojo
    if (p.remaining < 0) {
      row.getCell('remaining').font = { color: { argb: 'FFDC2626' }, bold: true };
    }
  });

  // Totales globales
  const totalBudget  = summaries.reduce((a, p) => a + Number(p.estimatedBudget), 0);
  const totalSpent   = summaries.reduce((a, p) => a + p.totalSpent, 0);
  const totalRow = ws.addRow({
    name:      `TOTAL (${summaries.length} proyectos)`,
    budget:    totalBudget,
    spent:     totalSpent,
    remaining: totalBudget - totalSpent,
    pct:       totalBudget > 0 ? totalSpent / totalBudget : 0,
  });
  totalRow.getCell('name').font = { bold: true };
  ['budget', 'spent', 'remaining'].forEach(k => {
    totalRow.getCell(k).numFmt = '"RD$"#,##0.00';
    totalRow.getCell(k).font   = { bold: true };
    totalRow.getCell(k).alignment = { horizontal: 'right' };
  });
  totalRow.getCell('pct').numFmt = '0.0%';
  totalRow.getCell('pct').alignment = { horizontal: 'center' };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="resumen-proyectos-${Date.now()}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

// ─── REPORTE 4: Exportación completa multi-hoja ─────────────────────────────

export interface FullExportFilters {
  projectId?:    string;
  categoryId?:   string;
  paymentMethod?: string;
  status?:       string;
  startDate?:    string;
  endDate?:      string;
}

export async function generateFullExpensesExcel(
  filters: FullExportFilters,
  res: Response,
) {
  // Construir where clause
  const where: any = {};
  if (filters.projectId)    where.projectId    = filters.projectId;
  if (filters.categoryId)   where.categoryId   = Number(filters.categoryId);
  if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;
  if (filters.status)       where.status        = filters.status;
  else                      where.status        = 'ACTIVE';

  if (filters.startDate || filters.endDate) {
    where.expenseDate = {};
    if (filters.startDate) where.expenseDate.gte = new Date(filters.startDate);
    if (filters.endDate)   where.expenseDate.lte = new Date(filters.endDate);
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      project:      { select: { id: true, code: true, name: true, estimatedBudget: true } },
      category:     { select: { id: true, name: true } },
      registeredBy: { select: { name: true } },
      fiscalVoucher: true,
    },
    orderBy: [{ project: { code: 'asc' } }, { expenseDate: 'asc' }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator  = 'Sistema Control de Gastos — SERVINGMI';
  wb.created  = new Date();
  wb.modified = new Date();

  const generatedAt = fmtDate(new Date().toISOString());
  const periodLabel = `${filters.startDate ? fmtDate(filters.startDate) : 'Inicio'} → ${filters.endDate ? fmtDate(filters.endDate) : 'Hoy'}`;

  // ── Estilo de encabezado dorado (brand SERVINGMI) ──────────────────────────
  const goldHeader = (): Partial<ExcelJS.Style> => ({
    font:      { bold: true, color: { argb: 'FF1A1A1A' }, size: 10 },
    fill:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5C218' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border:    { bottom: { style: 'thin', color: { argb: 'FFB8940A' } } },
  });

  function addSheetTitle(ws: ExcelJS.Worksheet, title: string, cols: number) {
    const endCol = String.fromCharCode(64 + cols);
    ws.mergeCells(`A1:${endCol}1`);
    ws.getCell('A1').value     = `SERVINGMI — ${title}`;
    ws.getCell('A1').font      = { bold: true, size: 13, color: { argb: 'FF1A1A1A' } };
    ws.getCell('A1').fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5C218' } };
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 32;

    ws.mergeCells(`A2:${endCol}2`);
    ws.getCell('A2').value     = `Período: ${periodLabel}  |  Generado: ${generatedAt}  |  Registros: ${expenses.length}`;
    ws.getCell('A2').font      = { size: 9, color: { argb: 'FF6B7280' } };
    ws.getCell('A2').alignment = { horizontal: 'center' };
    ws.getRow(2).height = 16;
    ws.getRow(3).height = 6;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 1 — Gastos detallados
  // ══════════════════════════════════════════════════════════════════════════
  const wsDetail = wb.addWorksheet('Gastos Detallados', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  addSheetTitle(wsDetail, 'Exportación de Gastos', 10);

  const detailHeaders = [
    { header: 'Fecha',          key: 'date',     width: 13 },
    { header: 'Proyecto',       key: 'project',  width: 20 },
    { header: 'Descripción',    key: 'desc',     width: 32 },
    { header: 'Categoría',      key: 'cat',      width: 18 },
    { header: 'Método pago',    key: 'method',   width: 15 },
    { header: 'Monto (RD$)',    key: 'amount',   width: 16 },
    { header: 'NCF',            key: 'ncf',      width: 16 },
    { header: 'RNC Suplidor',   key: 'rnc',      width: 14 },
    { header: 'Suplidor',       key: 'supplier', width: 25 },
    { header: 'Registrado por', key: 'by',       width: 18 },
  ];

  wsDetail.columns = detailHeaders.map(h => ({ key: h.key, width: h.width }));
  const hRowDetail = wsDetail.getRow(4);
  detailHeaders.forEach((h, i) => {
    const cell = hRowDetail.getCell(i + 1);
    cell.value = h.header;
    Object.assign(cell, goldHeader());
  });
  hRowDetail.height = 22;

  let grandTotal = 0;
  expenses.forEach((e, idx) => {
    const row = wsDetail.addRow({
      date:     fmtDate(e.expenseDate),
      project:  `${e.project.code}`,
      desc:     e.description,
      cat:      e.category.name,
      method:   PAYMENT_LABELS[e.paymentMethod] ?? e.paymentMethod,
      amount:   Number(e.amount),
      ncf:      e.fiscalVoucher?.ncf      ?? '',
      rnc:      e.fiscalVoucher?.supplierRnc ?? '',
      supplier: e.fiscalVoucher?.supplierName ?? '',
      by:       e.registeredBy.name,
    });

    const fill = idx % 2 === 0
      ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFAFAFA' } }
      : { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } };
    row.eachCell(cell => { cell.fill = fill; cell.alignment = { vertical: 'middle' }; });

    row.getCell('amount').numFmt    = '"RD$"#,##0.00';
    row.getCell('amount').alignment = { horizontal: 'right' };

    if (e.status === 'VOIDED') {
      row.eachCell(cell => { cell.font = { color: { argb: 'FFEF4444' }, strike: true }; });
    } else {
      grandTotal += Number(e.amount);
    }
  });

  // Fila de total
  const totalRowD = wsDetail.addRow({ desc: `TOTAL ACTIVOS (${expenses.filter(e => e.status === 'ACTIVE').length} registros)`, amount: grandTotal });
  totalRowD.getCell('desc').font = { bold: true, size: 11 };
  totalRowD.getCell('amount').numFmt = '"RD$"#,##0.00';
  totalRowD.getCell('amount').font   = { bold: true, size: 11, color: { argb: 'FF1A1A1A' } };
  totalRowD.getCell('amount').alignment = { horizontal: 'right' };
  totalRowD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0A0' } };

  // Freeze header
  wsDetail.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 2 — Resumen por Proyecto
  // ══════════════════════════════════════════════════════════════════════════
  const wsProj = wb.addWorksheet('Por Proyecto');
  addSheetTitle(wsProj, 'Resumen por Proyecto', 6);

  const projHeaders = [
    { header: 'Código',       key: 'code',    width: 16 },
    { header: 'Proyecto',     key: 'name',    width: 36 },
    { header: 'N° Gastos',    key: 'count',   width: 12 },
    { header: 'Presupuesto',  key: 'budget',  width: 18 },
    { header: 'Total Gastado',key: 'spent',   width: 18 },
    { header: '% Utilizado',  key: 'pct',     width: 14 },
  ];
  wsProj.columns = projHeaders.map(h => ({ key: h.key, width: h.width }));
  const hRowProj = wsProj.getRow(4);
  projHeaders.forEach((h, i) => {
    const cell = hRowProj.getCell(i + 1);
    cell.value = h.header;
    Object.assign(cell, goldHeader());
  });
  hRowProj.height = 22;

  // Agrupar por proyecto
  const byProject = new Map<string, { code: string; name: string; budget: number; spent: number; count: number }>();
  expenses.filter(e => e.status === 'ACTIVE').forEach(e => {
    const key = e.project.id;
    if (!byProject.has(key)) {
      byProject.set(key, { code: e.project.code, name: e.project.name, budget: Number(e.project.estimatedBudget), spent: 0, count: 0 });
    }
    const p = byProject.get(key)!;
    p.spent += Number(e.amount);
    p.count += 1;
  });

  Array.from(byProject.values()).sort((a, b) => a.code.localeCompare(b.code)).forEach((p, idx) => {
    const pct = p.budget > 0 ? p.spent / p.budget : 0;
    const row = wsProj.addRow({ code: p.code, name: p.name, count: p.count, budget: p.budget, spent: p.spent, pct });
    const fill = idx % 2 === 0
      ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFAFAFA' } }
      : { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } };
    row.eachCell(cell => { cell.fill = fill; cell.alignment = { vertical: 'middle' }; });
    row.getCell('budget').numFmt = '"RD$"#,##0.00';
    row.getCell('budget').alignment = { horizontal: 'right' };
    row.getCell('spent').numFmt  = '"RD$"#,##0.00';
    row.getCell('spent').alignment  = { horizontal: 'right' };
    row.getCell('pct').numFmt    = '0.0%';
    row.getCell('pct').alignment = { horizontal: 'center' };
    // Semáforo
    const pctCell = row.getCell('pct');
    if (pct >= 1)       { pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; pctCell.font = { color: { argb: 'FFDC2626' }, bold: true }; }
    else if (pct >= 0.8){ pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } }; pctCell.font = { color: { argb: 'FFD97706' }, bold: true }; }
    else                { pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }; pctCell.font = { color: { argb: 'FF16A34A' } }; }
  });

  wsProj.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 3 — Resumen por Categoría
  // ══════════════════════════════════════════════════════════════════════════
  const wsCat = wb.addWorksheet('Por Categoría');
  addSheetTitle(wsCat, 'Resumen por Categoría', 4);

  const catHeaders = [
    { header: 'Categoría',     key: 'name',   width: 28 },
    { header: 'N° Gastos',     key: 'count',  width: 13 },
    { header: 'Total (RD$)',   key: 'total',  width: 18 },
    { header: '% del Total',   key: 'pct',    width: 14 },
  ];
  wsCat.columns = catHeaders.map(h => ({ key: h.key, width: h.width }));
  const hRowCat = wsCat.getRow(4);
  catHeaders.forEach((h, i) => {
    const cell = hRowCat.getCell(i + 1);
    cell.value = h.header;
    Object.assign(cell, goldHeader());
  });
  hRowCat.height = 22;

  const byCat = new Map<string, { name: string; count: number; total: number }>();
  expenses.filter(e => e.status === 'ACTIVE').forEach(e => {
    const key = e.category.name;
    if (!byCat.has(key)) byCat.set(key, { name: key, count: 0, total: 0 });
    const c = byCat.get(key)!;
    c.total += Number(e.amount);
    c.count += 1;
  });

  const catTotal = Array.from(byCat.values()).reduce((s, c) => s + c.total, 0);
  Array.from(byCat.values()).sort((a, b) => b.total - a.total).forEach((c, idx) => {
    const row = wsCat.addRow({ name: c.name, count: c.count, total: c.total, pct: catTotal > 0 ? c.total / catTotal : 0 });
    const fill = idx % 2 === 0
      ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFAFAFA' } }
      : { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } };
    row.eachCell(cell => { cell.fill = fill; cell.alignment = { vertical: 'middle' }; });
    row.getCell('total').numFmt = '"RD$"#,##0.00';
    row.getCell('total').alignment = { horizontal: 'right' };
    row.getCell('pct').numFmt   = '0.0%';
    row.getCell('pct').alignment = { horizontal: 'center' };
  });

  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 4 — Comprobantes Fiscales (NCF)
  // ══════════════════════════════════════════════════════════════════════════
  const wsNcf   = wb.addWorksheet('Comprobantes Fiscales');
  const ncfData = expenses.filter(e => e.status === 'ACTIVE' && e.fiscalVoucher);
  addSheetTitle(wsNcf, 'Comprobantes Fiscales (NCF)', 8);

  const ncfHeaders = [
    { header: 'Fecha',        key: 'date',     width: 13 },
    { header: 'Proyecto',     key: 'project',  width: 18 },
    { header: 'NCF',          key: 'ncf',      width: 16 },
    { header: 'Tipo',         key: 'ncfType',  width: 12 },
    { header: 'RNC Suplidor', key: 'rnc',      width: 14 },
    { header: 'Suplidor',     key: 'supplier', width: 28 },
    { header: 'ITBIS (RD$)',  key: 'itbis',    width: 15 },
    { header: 'Monto (RD$)',  key: 'amount',   width: 16 },
  ];
  wsNcf.columns = ncfHeaders.map(h => ({ key: h.key, width: h.width }));
  const hRowNcf = wsNcf.getRow(4);
  ncfHeaders.forEach((h, i) => {
    const cell = hRowNcf.getCell(i + 1);
    cell.value = h.header;
    Object.assign(cell, goldHeader());
  });
  hRowNcf.height = 22;

  let ncfTotal = 0; let itbisTotal = 0;
  ncfData.forEach((e, idx) => {
    const fv  = e.fiscalVoucher!;
    const row = wsNcf.addRow({
      date:     fmtDate(e.expenseDate),
      project:  e.project.code,
      ncf:      fv.ncf,
      ncfType:  fv.isElectronic ? 'e-NCF' : 'Tradicional',
      rnc:      fv.supplierRnc,
      supplier: fv.supplierName,
      itbis:    Number(fv.itbisAmount ?? 0),
      amount:   Number(e.amount),
    });
    const fill = idx % 2 === 0
      ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFAFAFA' } }
      : { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } };
    row.eachCell(cell => { cell.fill = fill; cell.alignment = { vertical: 'middle' }; });
    row.getCell('itbis').numFmt  = '"RD$"#,##0.00';
    row.getCell('amount').numFmt = '"RD$"#,##0.00';
    row.getCell('itbis').alignment  = { horizontal: 'right' };
    row.getCell('amount').alignment = { horizontal: 'right' };
    if (fv.isElectronic) {
      row.getCell('ncfType').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
      row.getCell('ncfType').font = { color: { argb: 'FF1D4ED8' }, bold: true };
    }
    ncfTotal   += Number(e.amount);
    itbisTotal += Number(fv.itbisAmount ?? 0);
  });

  const ncfTotalRow = wsNcf.addRow({ supplier: `TOTAL (${ncfData.length} comprobantes)`, itbis: itbisTotal, amount: ncfTotal });
  ncfTotalRow.getCell('supplier').font    = { bold: true };
  ncfTotalRow.getCell('itbis').numFmt     = '"RD$"#,##0.00';
  ncfTotalRow.getCell('amount').numFmt    = '"RD$"#,##0.00';
  ncfTotalRow.getCell('itbis').font       = { bold: true };
  ncfTotalRow.getCell('amount').font      = { bold: true };
  ncfTotalRow.getCell('itbis').alignment  = { horizontal: 'right' };
  ncfTotalRow.getCell('amount').alignment = { horizontal: 'right' };
  ncfTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0A0' } };
  wsNcf.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

  // ── Enviar respuesta ────────────────────────────────────────────────────────
  const filename = `SERVINGMI-gastos-${filters.startDate ?? 'todo'}_${filters.endDate ?? new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// ─── REPORTE 5 (anterior 4): PDF de un proyecto ──────────────────────────────

export async function generateProjectPDF(
  filters: ProjectReportFilters,
  res: Response,
) {
  const { project, expenses } = await fetchProjectExpenses(filters);

  const totalSpent = expenses.reduce((a, e) => a + Number(e.amount), 0);
  const remaining  = Number(project.estimatedBudget) - totalSpent;
  const pctUsed    = Number(project.estimatedBudget) > 0
    ? (totalSpent / Number(project.estimatedBudget)) * 100 : 0;

  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="reporte-${project.code}-${Date.now()}.pdf"`);
  doc.pipe(res);

  const W = 515; // ancho útil A4 con márgenes de 40

  // ─── Encabezado ───────────────────────────────────────────────────────────
  doc.rect(40, 40, W, 60).fill('#2563EB');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16)
     .text('REPORTE DE GASTOS', 50, 52, { width: W - 20 });
  doc.font('Helvetica').fontSize(11)
     .text(project.name, 50, 72, { width: W - 20 });
  doc.moveDown(0.5);

  // ─── Info del proyecto ────────────────────────────────────────────────────
  doc.fillColor('#1F2937').font('Helvetica').fontSize(9);
  let y = 115;

  const infoItems: [string, string][] = [
    ['Código',     project.code],
    ['Estado',     project.status],
    ['Cliente',    project.client ?? 'N/A'],
    ['Ubicación',  project.location ?? 'N/A'],
    ['Inicio',     fmtDate(project.startDate)],
    ['Generado',   fmtDate(new Date().toISOString())],
  ];

  infoItems.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? 40 : 310;
    if (i % 2 === 0 && i > 0) y += 16;
    doc.font('Helvetica-Bold').text(label + ': ', x, y, { continued: true });
    doc.font('Helvetica').text(value);
  });

  y += 24;

  // ─── Resumen financiero ───────────────────────────────────────────────────
  doc.rect(40, y, W, 18).fill('#DBEAFE');
  doc.fillColor('#1E3A5F').font('Helvetica-Bold').fontSize(10)
     .text('RESUMEN FINANCIERO', 50, y + 4);
  y += 22;

  const colW = W / 3;
  const financialItems = [
    { label: 'Presupuesto',      value: fmtMoney(project.estimatedBudget), color: '#1F2937' },
    { label: 'Total Gastado',    value: fmtMoney(totalSpent),               color: '#DC2626' },
    { label: remaining >= 0 ? 'Disponible' : 'Exceso', value: fmtMoney(Math.abs(remaining)), color: remaining >= 0 ? '#16A34A' : '#DC2626' },
  ];

  financialItems.forEach((item, i) => {
    const x = 40 + i * colW;
    doc.rect(x, y, colW - 4, 44).fill('#F9FAFB').stroke('#E5E7EB');
    doc.fillColor('#6B7280').font('Helvetica').fontSize(8).text(item.label, x + 6, y + 6, { width: colW - 16 });
    doc.fillColor(item.color).font('Helvetica-Bold').fontSize(13).text(item.value, x + 6, y + 18, { width: colW - 16 });
  });

  y += 52;

  // Barra de progreso
  const barW = W - 10;
  const fillW = Math.min(pctUsed / 100, 1) * barW;
  const barColor = pctUsed >= 100 ? '#DC2626' : pctUsed >= 80 ? '#D97706' : '#16A34A';
  doc.rect(45, y, barW, 10).fill('#E5E7EB');
  if (fillW > 0) doc.rect(45, y, fillW, 10).fill(barColor);
  doc.fillColor('#4B5563').font('Helvetica').fontSize(8)
     .text(`${pctUsed.toFixed(1)}% del presupuesto utilizado`, 45, y + 14);
  y += 28;

  // ─── Tabla de gastos ──────────────────────────────────────────────────────
  doc.rect(40, y, W, 18).fill('#2563EB');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
     .text('DETALLE DE GASTOS', 50, y + 4);
  y += 22;

  // Cabeceras de tabla
  const cols = [
    { label: 'Fecha',       x: 40,  w: 60  },
    { label: 'Descripción', x: 104, w: 155 },
    { label: 'Categoría',   x: 263, w: 90  },
    { label: 'Método',      x: 357, w: 70  },
    { label: 'Monto',       x: 431, w: 68  },
  ];

  doc.rect(40, y, W, 16).fill('#DBEAFE');
  cols.forEach(col => {
    doc.fillColor('#1E3A5F').font('Helvetica-Bold').fontSize(8)
       .text(col.label, col.x + 3, y + 3, { width: col.w - 4 });
  });
  y += 18;

  expenses.forEach((e, idx) => {
    if (y > 750) {
      doc.addPage();
      y = 40;
    }
    const rowH = 15;
    const bg = idx % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
    doc.rect(40, y, W, rowH).fill(bg);

    const textColor = e.status === 'VOIDED' ? '#EF4444' : '#1F2937';
    doc.fillColor(textColor).font('Helvetica').fontSize(7.5);

    const rowData: [number, number, number, string][] = [
      [cols[0].x, y + 3, cols[0].w - 4, fmtDate(e.expenseDate)],
      [cols[1].x, y + 3, cols[1].w - 4, e.description],
      [cols[2].x, y + 3, cols[2].w - 4, e.category.name],
      [cols[3].x, y + 3, cols[3].w - 4, PAYMENT_LABELS[e.paymentMethod]],
    ];
    rowData.forEach(([rx, ry, rw, rv]) => doc.text(rv, rx + 3, ry, { width: rw }));

    doc.font('Helvetica-Bold')
       .text(fmtMoney(Number(e.amount)), cols[4].x + 3, y + 3, { width: cols[4].w - 4, align: 'right' });

    doc.moveTo(40, y + rowH).lineTo(555, y + rowH).stroke('#E5E7EB');
    y += rowH;
  });

  // Fila total
  doc.rect(40, y, W, 18).fill('#DBEAFE');
  doc.fillColor('#1E3A5F').font('Helvetica-Bold').fontSize(9)
     .text('TOTAL', cols[0].x + 3, y + 4)
     .text(fmtMoney(totalSpent), cols[4].x + 3, y + 4, { width: cols[4].w - 4, align: 'right' });

  // ─── Pie de página ────────────────────────────────────────────────────────
  doc.fillColor('#9CA3AF').font('Helvetica').fontSize(7)
     .text(
       `Sistema Control de Gastos | ${fmtDate(new Date().toISOString())} | ${expenses.length} registros`,
       40, doc.page.height - 30, { width: W, align: 'center' },
     );

  doc.end();
}
