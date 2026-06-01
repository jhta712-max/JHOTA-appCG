import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middlewares/authenticate';
import { analyzeInvoice } from './ocr.service';
import { AppError } from '../../middlewares/errorHandler';

// @ts-ignore
const router: any = Router();

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
// Recibe imagen, extrae datos fiscales con IA
router.post(
  '/analyze',
  authenticate,
  upload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError(400, 'Se requiere una imagen de la factura', 'IMAGE_REQUIRED');
      }

      const result = await analyzeInvoice(req.file.buffer, req.file.mimetype);

      res.json({
        success: true,
        data:    result,
        meta: {
          fileName:    req.file.originalname,
          fileSize:    req.file.size,
          analyzedAt:  new Date().toISOString(),
          processedBy: req.user!.userId,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
