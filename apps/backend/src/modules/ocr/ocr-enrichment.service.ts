/**
 * OCR Enrichment Agent
 *
 * Nivel 1 — Alta confianza (bloquea o pre-rellena):
 *   - Match de proveedor por RNC
 *   - Duplicado de NCF/eNCF
 *   - Cruce con cotización abierta del mismo proveedor
 *   - Clasificación de tipo NCF/eNCF con descripción
 *
 * Nivel 2 — Baja confianza (aviso amarillo, nunca bloquea):
 *   - Validación de ITBIS (18% en RD — muchas facturas informales no lo desglosan)
 *   - Coherencia de tipo de comprobante vs. tipo de gasto
 */

import prisma from '../../config/database';

// ── Tipos NCF y eNCF de la DGII ─────────────────────────────────────────────

const NCF_TYPES: Record<string, string> = {
  // NCF tradicionales
  B01: 'Factura de Crédito Fiscal',
  B02: 'Factura de Consumo',
  B03: 'Nota de Débito',
  B04: 'Nota de Crédito',
  B11: 'Comprobante de Compras',
  B12: 'Registro de Proveedores Informales',
  B13: 'Registro Único de Ingresos',
  B14: 'Regímenes Especiales',
  B15: 'Gubernamentales',
  B16: 'Comprobante para Gastos Menores',
  // eNCF electrónicos (Ley 32-23, Norma 05-19 DGII)
  E31: 'Factura de Crédito Fiscal Electrónica',
  E32: 'Factura de Consumo Electrónica',
  E33: 'Nota de Débito Electrónica',
  E34: 'Nota de Crédito Electrónica',
  E41: 'Compras Electrónicas',
  E43: 'Gastos Menores Electrónicos',
  E44: 'Regímenes Especiales Electrónicos',
  E45: 'Gubernamentales Electrónicos',
};

// Tipos deducibles de ITBIS (aplica 18%)
const ITBIS_DEDUCTIBLE_NCF = new Set(['B01', 'B11', 'E31', 'E41']);

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface SupplierMatch {
  id:         string;
  name:       string;
  rnc:        string | null;
  confidence: 'exact' | 'rnc';   // exact = RNC match exacto
}

export interface NcfDuplicate {
  expenseId:   string | null;
  expenseCode: string | null;
  date:        string;
  source:      'expense' | 'fiscal_voucher';
}

export interface CotizacionAlert {
  cotizacionId:   string;
  cotizacionCode: string;
  cotizacionAmt:  number;
  invoiceAmt:     number;
  diffPct:        number;    // positivo = factura supera cotización
}

export interface NcfInfo {
  code:          string;          // 'B01', 'E31', etc.
  description:   string;          // 'Factura de Crédito Fiscal Electrónica'
  isElectronic:  boolean;
  itbisDeductible: boolean;
}

export interface OcrEnrichmentResult {
  // Nivel 1 — alta confianza
  supplierMatch:   SupplierMatch | null;
  ncfDuplicate:    NcfDuplicate | null;     // null = no hay duplicado
  ncfInfo:         NcfInfo | null;          // clasificación del tipo de comprobante
  cotizacionAlert: CotizacionAlert | null;

  // Nivel 2 — baja confianza (solo warnings, nunca bloquea)
  warnings: string[];
}

// ── Función principal ────────────────────────────────────────────────────────

export async function enrichOcrResult(opts: {
  supplierRnc?:  string | null;
  supplierName?: string | null;
  ncf?:          string | null;
  amount?:       number | null;
  itbisAmount?:  number | null;
  projectId?:    string | null;
}): Promise<OcrEnrichmentResult> {
  const result: OcrEnrichmentResult = {
    supplierMatch:   null,
    ncfDuplicate:    null,
    ncfInfo:         null,
    cotizacionAlert: null,
    warnings:        [],
  };

  await Promise.all([
    matchSupplier(opts.supplierRnc, opts.supplierName).then(m => { result.supplierMatch = m; }),
    checkNcfDuplicate(opts.ncf).then(d => { result.ncfDuplicate = d; }),
    classifyNcf(opts.ncf, opts.itbisAmount, opts.amount, result.warnings).then(i => { result.ncfInfo = i; }),
    checkCotizacion(opts.supplierRnc, opts.amount, opts.projectId).then(a => { result.cotizacionAlert = a; }),
  ]);

  return result;
}

// ── Match de proveedor por RNC ───────────────────────────────────────────────

async function matchSupplier(
  rnc?:  string | null,
  name?: string | null,
): Promise<SupplierMatch | null> {
  if (!rnc) return null;

  const supplier = await prisma.supplier.findFirst({
    where: { rnc, isActive: true },
    select: { id: true, name: true, rnc: true },
  });

  if (supplier) {
    return { id: supplier.id, name: supplier.name, rnc: supplier.rnc, confidence: 'rnc' };
  }

  return null;
}

// ── Detección de NCF duplicado ───────────────────────────────────────────────

async function checkNcfDuplicate(ncf?: string | null): Promise<NcfDuplicate | null> {
  if (!ncf) return null;

  // Buscar en FiscalVoucher (gastos de proyectos)
  const voucher = await prisma.fiscalVoucher.findFirst({
    where: { ncf },
    select: {
      expenseId: true,
      createdAt: true,
    },
  });

  if (voucher) {
    return {
      expenseId:   voucher.expenseId,
      expenseCode: null,
      date:        voucher.createdAt.toISOString().split('T')[0],
      source:      'fiscal_voucher',
    };
  }

  return null;
}

// ── Clasificación de NCF/eNCF ────────────────────────────────────────────────

async function classifyNcf(
  ncf?:        string | null,
  itbisAmt?:   number | null,
  totalAmt?:   number | null,
  warnings:    string[] = [],
): Promise<NcfInfo | null> {
  if (!ncf) return null;

  // Extraer código de tipo: primeros 3 chars (B01, E31, etc.)
  const code = ncf.slice(0, 3).toUpperCase();
  const description = NCF_TYPES[code];

  if (!description) {
    warnings.push(`Tipo de comprobante "${code}" no reconocido en el catálogo DGII`);
    return null;
  }

  const isElectronic    = code.startsWith('E');
  const itbisDeductible = ITBIS_DEDUCTIBLE_NCF.has(code);

  // Nivel 2: validación suave de ITBIS si tenemos los datos
  // Solo aplica a tipos con ITBIS deducible y cuando ambos montos están disponibles
  if (itbisDeductible && itbisAmt != null && totalAmt != null && totalAmt > 0 && itbisAmt > 0) {
    const subtotalImplied = totalAmt - itbisAmt;
    if (subtotalImplied > 0) {
      const itbisRate = itbisAmt / subtotalImplied;
      // Tolerancia amplia (10%-26%) por heterogeneidad de facturas en RD
      if (itbisRate < 0.10 || itbisRate > 0.26) {
        warnings.push(`ITBIS posiblemente incorrecto (${(itbisRate * 100).toFixed(0)}% del subtotal) — verificar`);
      }
    }
  }

  // Nivel 2: tipos no habituales para gastos de proyectos de construcción
  if (['B15', 'E45'].includes(code)) {
    warnings.push(`Comprobante gubernamental (${code}) — inusual para gastos de construcción`);
  }

  return { code, description, isElectronic, itbisDeductible };
}

// ── Cruce con cotización abierta ─────────────────────────────────────────────

async function checkCotizacion(
  supplierRnc?: string | null,
  amount?:      number | null,
  projectId?:   string | null,
): Promise<CotizacionAlert | null> {
  if (!supplierRnc || !amount || !projectId) return null;

  // Buscar cotizaciones aprobadas/pendientes del mismo proveedor en ese proyecto
  const cotizacion = await prisma.quotation.findFirst({
    where: {
      projectId,
      status:      { in: ['PENDING', 'APPROVED'] },
      supplierRnc,
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, number: true, total: true },
  });

  if (!cotizacion) return null;

  const cotizacionAmt = Number(cotizacion.total);
  if (cotizacionAmt <= 0) return null;

  const diffPct = ((amount - cotizacionAmt) / cotizacionAmt) * 100;

  // Solo alertar si la factura supera la cotización en más del 10%
  if (diffPct <= 10) return null;

  return {
    cotizacionId:   cotizacion.id,
    cotizacionCode: String(cotizacion.number),
    cotizacionAmt,
    invoiceAmt:     amount,
    diffPct:        Math.round(diffPct),
  };
}
