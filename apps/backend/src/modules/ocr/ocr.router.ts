import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../../middlewares/authenticate';
import { analyzeInvoice } from './ocr.service';
import { AppError } from '../../middlewares/errorHandler';
import prisma from '../../config/database';

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
// Recibe imagen, crea un OcrJob y retorna 202 inmediatamente.
// El análisis con IA corre en background — poll GET /jobs/:jobId.
router.post(
  '/analyze',
  authenticate,
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError(400, 'Se requiere una imagen de la factura', 'IMAGE_REQUIRED');
      }

      const userId = req.user!.userId;

      // Crear registro del job con estado "processing"
      const job = await prisma.ocrJob.create({
        data: {
          userId,
          status: 'processing',
        },
      });

      // Capturar buffer y mimeType antes de que la respuesta cierre el ciclo
      const fileBuffer  = req.file.buffer;
      const mimeType    = req.file.mimetype;
      const originalName = req.file.originalname;
      const fileSize     = req.file.size;

      // Responder de inmediato — HTTP 202 Accepted
      res.status(202).json({
        success: true,
        jobId:   job.id,
        status:  'processing',
        meta: {
          fileName:    originalName,
          fileSize,
          submittedAt: new Date().toISOString(),
          submittedBy: userId,
        },
      });

      // ── Procesamiento asíncrono en background ──────────────────
      // setImmediate garantiza que la respuesta ya fue enviada antes de
      // comenzar la tarea costosa.
      setImmediate(async () => {
        try {
          const result = await analyzeInvoice(fileBuffer, mimeType);

          await prisma.ocrJob.update({
            where: { id: job.id },
            data: {
              status:      'completed',
              result:      result as any,
              completedAt: new Date(),
            },
          });
        } catch (err) {
          await prisma.ocrJob.update({
            where: { id: job.id },
            data: {
              status:      'failed',
              error:       err instanceof Error ? err.message : String(err),
              completedAt: new Date(),
            },
          }).catch(() => {
            // No propagar errores de DB dentro del background task
          });
        }
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

export default router;
