import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { authenticate } from '../../middlewares/authenticate';
import { analyzeInvoice } from './ocr.service';
import { AppError } from '../../middlewares/errorHandler';
import prisma from '../../config/database';
import { enrichOcrResult } from './ocr-enrichment.service';
import { env } from '../../config/env';

const router = Router();

// Multer en memoria — no guardar a disco, solo procesar
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan imágenes (JPG, PNG, WEBP) o PDFs.'));
    }
  },
});

// ── GET /api/v1/ocr/ping-ai ────────────────────────────────────
// Diagnostic: text-only Claude call (no image) to test API connectivity.
router.get(
  '/ping-ai',
  authenticate,
  async (req: Request, res: Response) => {
    if (!env.ANTHROPIC_API_KEY) {
      res.json({ success: false, error: 'ANTHROPIC_API_KEY not configured' });
      return;
    }
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 20_000 });
    const startMs = Date.now();
    try {
      const response = await client.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 8,
        messages:   [{ role: 'user', content: 'Reply with the word OK only.' }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '?';
      res.json({ success: true, elapsed: Date.now() - startMs, response: text });
    } catch (err) {
      const msg    = err instanceof Error ? err.message : String(err);
      const name   = err instanceof Error ? err.constructor.name : 'Unknown';
      const status = (err as any)?.status;
      res.json({ success: false, elapsed: Date.now() - startMs, errorClass: name, error: msg, status });
    }
  },
);

// ── POST /api/v1/ocr/analyze ───────────────────────────────────
// Procesa la imagen sincrónicamente con IA y guarda el resultado en OcrJob.
// Retorna 200 con jobId + resultado completo. El endpoint GET /jobs/:jobId
// sigue disponible para compatibilidad con el hook de polling del frontend.
router.post(
  '/analyze',
  authenticate,
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError(400, 'Se requiere una imagen de la factura', 'IMAGE_REQUIRED');
      }

      const userId       = req.user!.userId;
      const fileBuffer   = req.file.buffer;
      const mimeType     = req.file.mimetype;
      const originalName = req.file.originalname;
      const fileSize     = req.file.size;

      // Crear registro del job
      const job = await prisma.ocrJob.create({
        data: { userId, status: 'processing' },
      });

      const startMs = Date.now();
      console.log(`[OCR] job ${job.id} started — mimeType=${mimeType} size=${fileBuffer.length}`);

      const NETWORK_ERROR_MARKERS = ['Premature close', 'Invalid response body', 'ECONNRESET', 'ETIMEDOUT', 'fetch failed', 'socket hang up'];

      let result: Awaited<ReturnType<typeof analyzeInvoice>>;
      try {
        result = await analyzeInvoice(fileBuffer, mimeType);
        console.log(`[OCR] job ${job.id} completed in ${Date.now() - startMs}ms`);
      } catch (aiErr) {
        const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        console.error(`[OCR] job ${job.id} failed after ${Date.now() - startMs}ms — ${msg}`);
        await prisma.ocrJob.update({
          where: { id: job.id },
          data:  { status: 'failed', error: msg, completedAt: new Date() },
        }).catch(() => {});

        const isNetworkError = NETWORK_ERROR_MARKERS.some(m => msg.includes(m));
        const userMsg = isNetworkError
          ? 'La conexión con el servicio de IA se interrumpió. Por favor intenta de nuevo.'
          : `Error al analizar la imagen: ${msg}`;
        throw new AppError(502, userMsg, 'OCR_AI_ERROR');
      }

      await prisma.ocrJob.update({
        where: { id: job.id },
        data:  { status: 'completed', result: result as any, completedAt: new Date() },
      });

      // Devolver resultado completo en la respuesta — el hook no necesita hacer polling
      res.status(202).json({
        success: true,
        jobId:   job.id,
        status:  'completed',
        result,
        meta: {
          fileName:    originalName,
          fileSize,
          submittedAt: new Date().toISOString(),
          submittedBy: userId,
        },
      });

    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/v1/ocr/jobs/:jobId ────────────────────────────────
// Polling endpoint: devuelve el estado actual del job.
// Solo el usuario que creó el job puede consultarlo.
router.get(
  '/jobs/:jobId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const userId    = req.user!.userId;

      const job = await prisma.ocrJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new AppError(404, 'Job no encontrado', 'OCR_JOB_NOT_FOUND');
      }

      if (job.userId !== userId) {
        throw new AppError(403, 'No tienes permiso para consultar este job', 'OCR_JOB_FORBIDDEN');
      }

      res.json({
        success: true,
        data: {
          jobId:       job.id,
          status:      job.status,
          result:      job.result ?? null,
          error:       job.error  ?? null,
          createdAt:   job.createdAt,
          completedAt: job.completedAt ?? null,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/v1/ocr/enrich ────────────────────────────────────
// Enriquece los datos extraídos por el OCR con validaciones de BD.
// Recibe los campos clave del resultado OCR + projectId opcional.
router.post(
  '/enrich',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { supplierRnc, supplierName, ncf, amount, itbisAmount, projectId } = req.body;

      const enrichment = await enrichOcrResult({
        supplierRnc:  supplierRnc  ?? null,
        supplierName: supplierName ?? null,
        ncf:          ncf          ?? null,
        amount:       typeof amount      === 'number' ? amount      : null,
        itbisAmount:  typeof itbisAmount === 'number' ? itbisAmount : null,
        projectId:    projectId    ?? null,
      });

      res.json({ success: true, data: enrichment });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
