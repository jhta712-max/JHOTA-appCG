import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../../middlewares/authenticate';
import { analyzeInvoice } from './ocr.service';
import { AppError } from '../../middlewares/errorHandler';
import prisma from '../../config/database';
import { enrichOcrResult } from './ocr-enrichment.service';

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
        throw new AppError(502, `Error al analizar la imagen: ${msg}`, 'OCR_AI_ERROR');
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
