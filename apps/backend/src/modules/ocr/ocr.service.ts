import Anthropic from '@anthropic-ai/sdk';
import { Agent as HttpsAgent } from 'https';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler';
import { persistAiUsage } from '../../services/ai-usage.service';

// ── Tipos de documento detectables ────────────────────────────

export type DocumentType =
  | 'INVOICE'          // Factura con NCF fiscal
  | 'QUOTATION'        // Cotización / Propuesta comercial
  | 'PURCHASE_ORDER'   // Orden de compra
  | 'RECEIPT'          // Recibo simple (sin NCF)
  | 'ADVANCE_RECEIPT'  // Recibo de anticipo / depósito
  | 'DELIVERY_NOTE'    // Nota de entrega / Conducción
  | 'CONTRACT'         // Contrato
  | 'OTHER';           // Otro documento comercial

// ── Resultado de análisis de documento ─────────────────────────
// Extiende el OcrResult original — 100% retro-compatible.
// Los campos previos (date, supplierName, ncf, etc.) se mantienen intactos.

export interface DocumentAnalysisResult {
  // ─── Clasificación ────────────────────────────────────────
  documentType:      DocumentType;
  documentTypeLabel: string;          // Etiqueta legible en español

  // ─── Campos comunes (factura Y cotización) ────────────────
  date:              string | null;   // YYYY-MM-DD
  supplierName:      string | null;
  supplierRnc:       string | null;
  amount:            number | null;   // Total (con ITBIS si aplica)
  itbisAmount:       number | null;
  paymentMethod:     'CASH' | 'TRANSFER' | 'CARD' | 'CHECK' | 'OTHER' | null;
  description:       string | null;
  suggestedCategory: string | null;
  confidence:        'high' | 'medium' | 'low';
  warnings:          string[];
  fieldsDetected:    number;

  // ─── Campos exclusivos de factura fiscal ──────────────────
  ncf:               string | null;   // NCF o e-NCF dominicano

  // ─── Campos exclusivos de cotización ──────────────────────
  quotationNumber:   string | null;   // Nro del suplidor en su cotización
  validUntil:        string | null;   // YYYY-MM-DD — vigencia de la cotización
  subtotal:          number | null;   // Antes de ITBIS
  paymentTerms:      string | null;   // "50% anticipo, 50% contraentrega"
  advancePct:        number | null;   // Porcentaje de anticipo requerido (0-100)
  pendingBalance:    number | null;   // Saldo pendiente según el documento
  deliveryDays:      number | null;   // Tiempo de entrega en días
  currency:          string | null;   // "DOP", "USD", "EUR"
  observations:      string | null;   // Observaciones o condiciones especiales
}

// Alias de compatibilidad con código anterior
export type OcrResult = DocumentAnalysisResult;

// ── Etiquetas legibles de tipo de documento ────────────────────

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  INVOICE:        'Factura Fiscal',
  QUOTATION:      'Cotización',
  PURCHASE_ORDER: 'Orden de Compra',
  RECEIPT:        'Recibo',
  ADVANCE_RECEIPT:'Recibo de Anticipo',
  DELIVERY_NOTE:  'Nota de Entrega',
  CONTRACT:       'Contrato',
  OTHER:          'Otro Documento',
};

// ── Prompt de extracción multi-documento ───────────────────────

const EXTRACTION_PROMPT = `Eres un experto en documentos comerciales y fiscales de la República Dominicana.
Analiza esta imagen o PDF y extrae todos los datos relevantes.

PASO 1 — IDENTIFICA EL TIPO DE DOCUMENTO:
Determina si es uno de: INVOICE, QUOTATION, PURCHASE_ORDER, RECEIPT, ADVANCE_RECEIPT, DELIVERY_NOTE, CONTRACT, OTHER

Criterios de clasificación:
- INVOICE: tiene NCF (B01..., E31...), dice "FACTURA", tiene datos fiscales DGII
- QUOTATION: dice "COTIZACIÓN", "PRESUPUESTO", "PROFORMA", "PROPUESTA COMERCIAL", tiene vigencia, condiciones de pago, no tiene NCF
- PURCHASE_ORDER: dice "ORDEN DE COMPRA", "O/C", tiene número de orden
- RECEIPT: dice "RECIBO", "COMPROBANTE DE PAGO", sin NCF completo
- ADVANCE_RECEIPT: dice "RECIBO DE ANTICIPO", "DEPÓSITO", "AVANCE"
- DELIVERY_NOTE: dice "NOTA DE ENTREGA", "CONDUCCIÓN", "REMISIÓN"
- CONTRACT: dice "CONTRATO", "ACUERDO", tiene firmas, cláusulas
- OTHER: cualquier otro documento comercial

PASO 2 — EXTRAE LOS DATOS SEGÚN EL TIPO:

REGLAS CRÍTICAS GENERALES:
- Si un campo no es legible con certeza, devuelve null (NO inventes datos)
- Para "date" usa siempre formato YYYY-MM-DD. Si solo ves mes/año, usa el día 1
- Para suggestedCategory elige UNA de: Materiales, Servicios, Mano de obra, Equipos, Transporte, Combustible, Dietas, Otros
  * Materiales: ferreterías, construcción, pinturas, cemento
  * Servicios: consultoría, reparaciones, limpieza, electricistas
  * Mano de obra: jornales, labor, trabajo manual
  * Equipos: maquinaria, herramientas, alquiler de equipo
  * Transporte: flete, envío, mudanza, courier
  * Combustible: gasolineras, gasolina, diesel, gas
  * Dietas: restaurantes, hotel, alimentación, hospedaje
  * Otros: cuando no encaja en ninguna categoría anterior

REGLAS PARA FACTURAS (INVOICE):
- NCF tradicional: exactamente 1 letra + 10 dígitos (ej: B0100000001)
- e-NCF electrónico: exactamente la letra E + 12 dígitos (ej: E310000000001)
- RNC: exactamente 9 u 11 dígitos numéricos (sin guiones ni espacios)
- "amount" = TOTAL pagado incluyendo ITBIS
- ITBIS en RD es 18% del subtotal gravado
- paymentMethod: "efectivo"=CASH, "tarjeta"/"visa"/"mastercard"=CARD, "transferencia"=TRANSFER, "cheque"=CHECK

REGLAS PARA COTIZACIONES (QUOTATION):
- "amount" = total de la cotización (subtotal + itbisAmount)
- "subtotal" = monto antes de ITBIS
- "quotationNumber" = número o código de cotización del suplidor
- "validUntil" = fecha de vigencia o vencimiento
- "advancePct" = porcentaje de anticipo requerido (solo el número, ej: 50 para "50%")
- "pendingBalance" = saldo o balance pendiente indicado en el documento
- "deliveryDays" = días de entrega o plazo de ejecución (solo el número)
- "paymentTerms" = condiciones de pago tal como aparecen en el documento
- "currency" = moneda (busca "DOP", "RD$"=DOP, "USD", "US$"=USD, "EUR")
- "observations" = notas, condiciones especiales, garantías

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional:
{
  "documentType": "INVOICE" | "QUOTATION" | "PURCHASE_ORDER" | "RECEIPT" | "ADVANCE_RECEIPT" | "DELIVERY_NOTE" | "CONTRACT" | "OTHER",
  "date": "YYYY-MM-DD o null",
  "supplierName": "nombre completo del suplidor o null",
  "supplierRnc": "solo dígitos o null",
  "amount": número o null,
  "itbisAmount": número o null,
  "subtotal": número o null,
  "paymentMethod": "CASH" | "TRANSFER" | "CARD" | "CHECK" | "OTHER" | null,
  "description": "descripción breve del contenido en 5-10 palabras o null",
  "suggestedCategory": "una de las categorías o null",
  "ncf": "NCF en MAYÚSCULAS o null",
  "quotationNumber": "número de cotización del suplidor o null",
  "validUntil": "YYYY-MM-DD o null",
  "paymentTerms": "condiciones de pago tal como aparecen o null",
  "advancePct": número entre 0 y 100 o null,
  "pendingBalance": número o null,
  "deliveryDays": número o null,
  "currency": "DOP" | "USD" | "EUR" | null,
  "observations": "observaciones relevantes o null",
  "confidence": "high" | "medium" | "low",
  "warnings": ["advertencia si aplica"]
}

Nivel de confianza:
- "high": imagen clara, todos los campos principales legibles
- "medium": imagen aceptable, algunos campos con dudas
- "low": imagen borrosa/inclinada, datos poco fiables`;

// ── Retry para errores de red transitorios ────────────────────

const TRANSIENT_ERRORS = ['Premature close', 'Invalid response body', 'ECONNRESET', 'ETIMEDOUT', 'fetch failed', 'socket hang up', 'ENOTFOUND'];

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg   = err instanceof Error ? err.message : String(err);
      const name  = err instanceof Error ? err.constructor.name : 'UnknownError';
      const cause = (err as any)?.cause;
      const status = (err as any)?.status;
      console.error(`[OCR] Attempt ${attempt + 1}/${maxRetries + 1} failed — ${name}: ${msg}${status ? ` (HTTP ${status})` : ''}${cause ? ` cause: ${cause}` : ''}`);

      const isTransient = TRANSIENT_ERRORS.some(e => msg.includes(e));
      if (isTransient && attempt < maxRetries) {
        const delayMs = (attempt + 1) * 2000;
        console.warn(`[OCR] Transient error — retrying in ${delayMs}ms`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

// ── Función principal (nueva) ──────────────────────────────────

export async function analyzeDocument(fileBuffer: Buffer, mimeType: string): Promise<DocumentAnalysisResult> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(503, 'El servicio de OCR no está configurado. Agrega ANTHROPIC_API_KEY al archivo .env', 'OCR_NOT_CONFIGURED');
  }

  // keepAlive: false forces a fresh TCP connection per request, bypassing the
  // https.globalAgent pool. Stale pooled connections to api.anthropic.com cause
  // node-fetch to throw "Premature close" when Anthropic closes them from their side.
  const client = new Anthropic({
    apiKey:    env.ANTHROPIC_API_KEY,
    timeout:   60_000,
    httpAgent: new HttpsAgent({ keepAlive: false }),
  });

  let fileContentBlock: any;

  if (mimeType === 'application/pdf') {
    const base64Pdf = fileBuffer.toString('base64');
    console.log(`[OCR] PDF payload: ${Math.round(base64Pdf.length / 1024)} KB base64`);
    fileContentBlock = {
      type:   'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf },
    };
  } else {
    const processedBuffer = await preprocessImage(fileBuffer);
    const base64Image     = processedBuffer.toString('base64');
    console.log(`[OCR] Image payload: original=${Math.round(fileBuffer.length / 1024)} KB → compressed=${Math.round(processedBuffer.length / 1024)} KB → base64=${Math.round(base64Image.length / 1024)} KB`);
    fileContentBlock = {
      type:   'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
    };
  }

  // Use streaming so the connection stays alive with data from the first token.
  // This avoids "Premature close" errors caused by proxy idle-timeouts while
  // waiting for a large non-streaming response body.
  const message = await withRetry(async () => {
    const stream = client.messages.stream({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            fileContentBlock,
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });
    return await stream.finalMessage();
  });

  persistAiUsage('OCR', message);

  const rawText = message.content[0].type === 'text' ? message.content[0].text : '';
  return parseDocumentResponse(rawText);
}

// Alias de compatibilidad — el router existente llama analyzeInvoice sin cambios
export const analyzeInvoice = analyzeDocument;

// ── Preprocesado de imagen ─────────────────────────────────────

async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  // Grayscale: OCR only needs luminance. Target output: under 80 KB binary
  // (= under 110 KB base64) to stay well within any intermediate proxy limits.
  let processed = await sharp(buffer)
    .rotate()
    .grayscale()
    .resize({ width: 768, withoutEnlargement: true })
    .sharpen()
    .normalise()
    .jpeg({ quality: 52 })
    .toBuffer();

  // If still large, keep compressing in steps until under 80 KB.
  const TARGET_BYTES = 80 * 1024;
  let quality = 40;
  while (processed.length > TARGET_BYTES && quality >= 20) {
    processed = await sharp(processed).jpeg({ quality }).toBuffer();
    quality -= 10;
  }

  return processed;
}

// ── Parsear respuesta del modelo ───────────────────────────────

function parseDocumentResponse(text: string): DocumentAnalysisResult {
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return emptyResult(['No se pudo interpretar la respuesta del modelo. Intenta con otra imagen.']);
  }

  const validTypes: DocumentType[] = [
    'INVOICE', 'QUOTATION', 'PURCHASE_ORDER', 'RECEIPT',
    'ADVANCE_RECEIPT', 'DELIVERY_NOTE', 'CONTRACT', 'OTHER',
  ];
  const documentType: DocumentType =
    validTypes.includes(parsed.documentType) ? parsed.documentType : 'OTHER';

  const result: DocumentAnalysisResult = {
    documentType,
    documentTypeLabel: DOCUMENT_TYPE_LABELS[documentType],

    date:              normalizeDate(parsed.date),
    supplierName:      typeof parsed.supplierName === 'string' ? parsed.supplierName.trim() : null,
    supplierRnc:       normalizeRnc(parsed.supplierRnc),
    amount:            typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : null,
    itbisAmount:       typeof parsed.itbisAmount === 'number' && parsed.itbisAmount >= 0 ? parsed.itbisAmount : null,
    paymentMethod:     validatePaymentMethod(parsed.paymentMethod),
    description:       typeof parsed.description === 'string' ? parsed.description.trim() : null,
    suggestedCategory: typeof parsed.suggestedCategory === 'string' ? parsed.suggestedCategory : null,
    confidence:        ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
    warnings:          Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
    fieldsDetected:    0,

    ncf:               normalizeNcf(parsed.ncf),

    quotationNumber:   typeof parsed.quotationNumber === 'string' ? parsed.quotationNumber.trim() : null,
    validUntil:        normalizeDate(parsed.validUntil),
    subtotal:          typeof parsed.subtotal === 'number' && parsed.subtotal > 0 ? parsed.subtotal : null,
    paymentTerms:      typeof parsed.paymentTerms === 'string' ? parsed.paymentTerms.trim() : null,
    advancePct:        typeof parsed.advancePct === 'number' && parsed.advancePct >= 0 && parsed.advancePct <= 100 ? parsed.advancePct : null,
    pendingBalance:    typeof parsed.pendingBalance === 'number' && parsed.pendingBalance >= 0 ? parsed.pendingBalance : null,
    deliveryDays:      typeof parsed.deliveryDays === 'number' && parsed.deliveryDays > 0 ? Math.round(parsed.deliveryDays) : null,
    currency:          ['DOP', 'USD', 'EUR'].includes(parsed.currency) ? parsed.currency : null,
    observations:      typeof parsed.observations === 'string' ? parsed.observations.trim() : null,
  };

  // Advertencias de validación por tipo de documento
  const extraWarnings: string[] = [];

  if (documentType === 'INVOICE') {
    if (result.ncf && !/^[A-Z]\d{10}$/.test(result.ncf) && !/^E\d{12}$/.test(result.ncf)) {
      extraWarnings.push(`NCF detectado (${result.ncf}) no tiene formato válido dominicano`);
      result.ncf = null;
    }
    if (result.amount !== null && result.itbisAmount !== null && result.itbisAmount > result.amount) {
      extraWarnings.push('El ITBIS detectado es mayor al total — verifica los montos');
    }
  }

  if (documentType === 'QUOTATION') {
    if (result.subtotal !== null && result.itbisAmount !== null && result.amount !== null) {
      const expectedTotal = result.subtotal + result.itbisAmount;
      const diff = Math.abs(expectedTotal - result.amount);
      if (diff > 1) {
        extraWarnings.push(`El total (${result.amount}) no coincide con subtotal + ITBIS (${expectedTotal.toFixed(2)}) — verifica los montos`);
      }
    }
  }

  if (result.supplierRnc && !/^\d{9}(\d{2})?$/.test(result.supplierRnc)) {
    extraWarnings.push(`RNC detectado (${result.supplierRnc}) tiene formato inválido`);
    result.supplierRnc = null;
  }

  result.warnings = [...result.warnings, ...extraWarnings];

  result.fieldsDetected = [
    result.date, result.supplierName, result.supplierRnc, result.ncf,
    result.amount, result.itbisAmount, result.paymentMethod, result.description,
    result.quotationNumber, result.paymentTerms, result.advancePct,
  ].filter((v) => v !== null && v !== undefined).length;

  return result;
}

// ── Normalizadores ─────────────────────────────────────────────

function normalizeDate(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const match = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return val;
}

function normalizeRnc(val: unknown): string | null {
  if (!val) return null;
  const digits = String(val).replace(/\D/g, '');
  if (digits.length === 9 || digits.length === 11) return digits;
  return null;
}

function normalizeNcf(val: unknown): string | null {
  if (!val) return null;
  const upper = String(val).toUpperCase().replace(/\s/g, '');
  return upper || null;
}

function validatePaymentMethod(val: unknown): DocumentAnalysisResult['paymentMethod'] {
  const valid = ['CASH', 'TRANSFER', 'CARD', 'CHECK', 'OTHER'];
  if (typeof val === 'string' && valid.includes(val)) return val as DocumentAnalysisResult['paymentMethod'];
  return null;
}

function emptyResult(warnings: string[]): DocumentAnalysisResult {
  return {
    documentType:      'OTHER',
    documentTypeLabel: DOCUMENT_TYPE_LABELS['OTHER'],
    date: null, supplierName: null, supplierRnc: null, ncf: null,
    amount: null, itbisAmount: null, paymentMethod: null,
    description: null, suggestedCategory: null,
    confidence: 'low', warnings, fieldsDetected: 0,
    quotationNumber: null, validUntil: null, subtotal: null,
    paymentTerms: null, advancePct: null, pendingBalance: null,
    deliveryDays: null, currency: null, observations: null,
  };
}
