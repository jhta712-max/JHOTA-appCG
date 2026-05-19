import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler';

// ── Tipos de resultado ─────────────────────────────────────────

export interface OcrResult {
  date:              string | null;
  supplierName:      string | null;
  supplierRnc:       string | null;
  ncf:               string | null;
  amount:            number | null;
  itbisAmount:       number | null;
  paymentMethod:     'CASH' | 'TRANSFER' | 'CARD' | 'CHECK' | 'OTHER' | null;
  description:       string | null;
  suggestedCategory: string | null;
  confidence:        'high' | 'medium' | 'low';
  warnings:          string[];
  fieldsDetected:    number;
}

// ── Prompt de extracción ───────────────────────────────────────

const EXTRACTION_PROMPT = `Eres un experto en documentos fiscales de la República Dominicana.
Analiza esta imagen de factura o comprobante fiscal y extrae los datos.

REGLAS CRÍTICAS:
- NCF tradicional: exactamente 1 letra + 10 dígitos (ej: B0100000001, B0200000001)
- e-NCF electrónico: exactamente la letra E + 12 dígitos (ej: E310000000001)
- RNC: exactamente 9 u 11 dígitos numéricos (sin guiones ni espacios)
- El monto "amount" debe ser el TOTAL pagado incluyendo ITBIS
- ITBIS en RD es 18% del subtotal gravado
- Para paymentMethod detecta palabras como "efectivo"=CASH, "tarjeta"/"visa"/"mastercard"=CARD, "transferencia"=TRANSFER, "cheque"=CHECK
- Si un campo no es legible con certeza, devuelve null (NO inventes datos)
- Para "date" usa siempre formato YYYY-MM-DD. Si solo ves mes/año, usa el día 1
- Para suggestedCategory, elige UNA de: Materiales, Servicios, Mano de obra, Equipos, Transporte, Combustible, Dietas, Otros
  * Materiales: ferreterías, construcción, pinturas, cemento
  * Servicios: consultoría, reparaciones, limpieza, electricistas
  * Mano de obra: jornales, labor, trabajo manual
  * Equipos: maquinaria, herramientas, alquiler de equipo
  * Transporte: flete, envío, mudanza, courier
  * Combustible: gasolineras, gasolina, diesel, gas
  * Dietas: restaurantes, hotel, alimentación, hospedaje
  * Otros: cuando no encaja en ninguna categoría anterior

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional:
{
  "date": "YYYY-MM-DD o null",
  "supplierName": "nombre completo del suplidor o null",
  "supplierRnc": "solo dígitos o null",
  "ncf": "NCF en MAYÚSCULAS o null",
  "amount": número o null,
  "itbisAmount": número o null,
  "paymentMethod": "CASH" | "TRANSFER" | "CARD" | "CHECK" | "OTHER" | null,
  "description": "descripción breve del gasto en 5-10 palabras o null",
  "suggestedCategory": "una de las categorías o null",
  "confidence": "high" | "medium" | "low",
  "warnings": ["advertencia 1", "advertencia 2"]
}

Nivel de confianza:
- "high": imagen clara, todos los campos principales legibles
- "medium": imagen aceptable, algunos campos con dudas
- "low": imagen borrosa/inclinada, datos poco fiables`;

// ── Función principal ──────────────────────────────────────────

export async function analyzeInvoice(fileBuffer: Buffer, mimeType: string): Promise<OcrResult> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(503, 'El servicio de OCR no está configurado. Agrega ANTHROPIC_API_KEY al archivo .env', 'OCR_NOT_CONFIGURED');
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  // Construir el bloque de contenido según el tipo de archivo
  let fileContentBlock: any;

  if (mimeType === 'application/pdf') {
    // PDFs: Claude los lee nativamente como documentos (sin conversión)
    const base64Pdf = fileBuffer.toString('base64');
    fileContentBlock = {
      type:   'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf },
    };
  } else {
    // Imágenes: preprocesar con sharp para mejorar nitidez y orientación
    const processedBuffer = await preprocessImage(fileBuffer);
    const base64Image     = processedBuffer.toString('base64');
    fileContentBlock = {
      type:   'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
    };
  }

  // Llamar a Claude con el archivo y el prompt de extracción
  const response = await client.messages.create({
    model:      'claude-haiku-4-5',
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

  const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
  return parseOcrResponse(rawText);
}

// ── Preprocesado de imagen ─────────────────────────────────────

async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()                    // Auto-rotar según EXIF (fotos móvil)
    .resize({ width: 1600, withoutEnlargement: true })  // Máx 1600px de ancho
    .sharpen()                   // Enfocar texto
    .normalise()                 // Normalizar contraste
    .jpeg({ quality: 90 })       // Convertir a JPEG comprimido
    .toBuffer();
}

// ── Parsear respuesta del modelo ───────────────────────────────

function parseOcrResponse(text: string): OcrResult {
  // Limpiar posible markdown
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Si falla el parse, devolver resultado vacío con advertencia
    return emptyResult(['No se pudo interpretar la respuesta del modelo. Intenta con otra imagen.']);
  }

  // Normalizar y validar campos
  const result: OcrResult = {
    date:              normalizeDate(parsed.date),
    supplierName:      typeof parsed.supplierName === 'string' ? parsed.supplierName.trim() : null,
    supplierRnc:       normalizeRnc(parsed.supplierRnc),
    ncf:               normalizeNcf(parsed.ncf),
    amount:            typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : null,
    itbisAmount:       typeof parsed.itbisAmount === 'number' && parsed.itbisAmount >= 0 ? parsed.itbisAmount : null,
    paymentMethod:     validatePaymentMethod(parsed.paymentMethod),
    description:       typeof parsed.description === 'string' ? parsed.description.trim() : null,
    suggestedCategory: typeof parsed.suggestedCategory === 'string' ? parsed.suggestedCategory : null,
    confidence:        ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
    warnings:          Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
    fieldsDetected:    0,
  };

  // Agregar advertencias de validación propias
  const extraWarnings: string[] = [];

  if (result.ncf && !/^[A-Z]\d{10}$/.test(result.ncf) && !/^E\d{12}$/.test(result.ncf)) {
    extraWarnings.push(`NCF detectado (${result.ncf}) no tiene formato válido dominicano`);
    result.ncf = null;
  }

  if (result.supplierRnc && !/^\d{9}(\d{2})?$/.test(result.supplierRnc)) {
    extraWarnings.push(`RNC detectado (${result.supplierRnc}) tiene formato inválido`);
    result.supplierRnc = null;
  }

  if (result.amount !== null && result.itbisAmount !== null && result.itbisAmount > result.amount) {
    extraWarnings.push('El ITBIS detectado es mayor al total — verifica los montos');
  }

  result.warnings = [...result.warnings, ...extraWarnings];

  // Contar campos detectados
  result.fieldsDetected = [
    result.date, result.supplierName, result.supplierRnc, result.ncf,
    result.amount, result.itbisAmount, result.paymentMethod, result.description,
  ].filter((v) => v !== null).length;

  return result;
}

// ── Normalizadores ─────────────────────────────────────────────

function normalizeDate(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const match = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  // No aceptar fechas futuras mayores a 1 día
  if (d.getTime() > Date.now() + 86400000) return null;
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

function validatePaymentMethod(val: unknown): OcrResult['paymentMethod'] {
  const valid = ['CASH', 'TRANSFER', 'CARD', 'CHECK', 'OTHER'];
  if (typeof val === 'string' && valid.includes(val)) return val as OcrResult['paymentMethod'];
  return null;
}

function emptyResult(warnings: string[]): OcrResult {
  return {
    date: null, supplierName: null, supplierRnc: null, ncf: null,
    amount: null, itbisAmount: null, paymentMethod: null,
    description: null, suggestedCategory: null,
    confidence: 'low', warnings, fieldsDetected: 0,
  };
}
