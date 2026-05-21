import { Router }    from 'express';
import multer        from 'multer';
import path          from 'path';
import fs            from 'fs';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import { validate }     from '../../middlewares/validate';
import { AppError }     from '../../middlewares/errorHandler';
import { env }          from '../../config/env';
import {
  createQuotationSchema,
  updateQuotationSchema,
  updateStatusSchema,
  createPaymentSchema,
  linkExpenseSchema,
  quotationQuerySchema,
} from './quotations.schema';
import * as ctrl from './quotations.controller';

const router = Router();

// ── Multer para adjuntos de cotizaciones ──────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(env.UPLOAD_PATH, 'quotations');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext  = path.extname(file.originalname);
      const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      cb(null, name);
    },
  }),
  limits:     { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan imágenes (JPG, PNG, WEBP) o PDFs.'));
    }
  },
});

router.use(authenticate);

// ───────────────────────────────────────────────────────────────
// COTIZACIONES
// ───────────────────────────────────────────────────────────────

// GET  /api/v1/quotations — todos los roles
router.get('/',
  validate(quotationQuerySchema, 'query'),
  ctrl.list,
);

// GET  /api/v1/quotations/suggest — sugerencias para vincular a un gasto
router.get('/suggest', ctrl.suggest);

// GET  /api/v1/quotations/:id
router.get('/:id', ctrl.getOne);

// GET  /api/v1/quotations/:id/summary — resumen financiero
router.get('/:id/summary', ctrl.getSummary);

// POST /api/v1/quotations — todos los roles
router.post('/',
  validate(createQuotationSchema),
  ctrl.create,
);

// PUT  /api/v1/quotations/:id — admin, supervisor; operator solo dentro de 24h (lo controla el service)
router.put('/:id',
  validate(updateQuotationSchema),
  ctrl.update,
);

// PATCH /api/v1/quotations/:id/status — solo admin y supervisor
router.patch('/:id/status',
  authorize('admin', 'supervisor'),
  validate(updateStatusSchema),
  ctrl.updateStatus,
);

// DELETE /api/v1/quotations/:id — solo admin y supervisor
router.delete('/:id',
  authorize('admin', 'supervisor'),
  ctrl.remove,
);

// ───────────────────────────────────────────────────────────────
// PAGOS / ANTICIPOS
// ───────────────────────────────────────────────────────────────

// POST /api/v1/quotations/:id/payments — todos los roles
router.post('/:id/payments',
  validate(createPaymentSchema),
  ctrl.createPayment,
);

// DELETE /api/v1/quotations/:id/payments/:paymentId — admin y supervisor
router.delete('/:id/payments/:paymentId',
  authorize('admin', 'supervisor'),
  ctrl.deletePayment,
);

// ───────────────────────────────────────────────────────────────
// VÍNCULOS CON GASTOS / FACTURAS
// ───────────────────────────────────────────────────────────────

// POST /api/v1/quotations/:id/links — admin y supervisor
router.post('/:id/links',
  authorize('admin', 'supervisor'),
  validate(linkExpenseSchema),
  ctrl.linkExpense,
);

// DELETE /api/v1/quotations/:id/links/:linkId — admin y supervisor
router.delete('/:id/links/:linkId',
  authorize('admin', 'supervisor'),
  ctrl.unlinkExpense,
);

// ───────────────────────────────────────────────────────────────
// ADJUNTOS
// ───────────────────────────────────────────────────────────────

// POST /api/v1/quotations/:id/attachments
router.post('/:id/attachments',
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) throw new AppError(400, 'Se requiere un archivo adjunto', 'FILE_REQUIRED');

      const prisma = (await import('../../config/database')).default;

      // Verificar que la cotización existe
      const q = await prisma.quotation.findUnique({ where: { id: req.params.id } });
      if (!q) throw new AppError(404, 'Cotización no encontrada', 'NOT_FOUND');

      const att = await prisma.quotationAttachment.create({
        data: {
          quotationId:  req.params.id,
          uploadedById: req.user!.userId,
          fileName:     req.file.originalname,
          filePath:     req.file.path,
          fileSize:     req.file.size,
          mimeType:     req.file.mimetype,
          isPrimary:    false,
        },
      });

      res.status(201).json({ success: true, data: att });
    } catch (err) { next(err); }
  },
);

// GET /api/v1/quotations/:id/attachments/:attId — descarga/visualización
router.get('/:id/attachments/:attId', async (req, res, next) => {
  try {
    const prisma = (await import('../../config/database')).default;
    const att = await prisma.quotationAttachment.findFirst({
      where: { id: req.params.attId, quotationId: req.params.id },
    });
    if (!att) throw new AppError(404, 'Adjunto no encontrado', 'NOT_FOUND');
    res.sendFile(path.resolve(att.filePath));
  } catch (err) { next(err); }
});

// DELETE /api/v1/quotations/:id/attachments/:attId
router.delete('/:id/attachments/:attId', async (req, res, next) => {
  try {
    const prisma = (await import('../../config/database')).default;
    const att = await prisma.quotationAttachment.findFirst({
      where: { id: req.params.attId, quotationId: req.params.id },
    });
    if (!att) throw new AppError(404, 'Adjunto no encontrado', 'NOT_FOUND');

    // Eliminar archivo físico si existe
    try { fs.unlinkSync(att.filePath); } catch { /* ignorar si ya no existe */ }

    await prisma.quotationAttachment.delete({ where: { id: att.id } });
    res.json({ success: true, data: { id: att.id } });
  } catch (err) { next(err); }
});

export default router;
