import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';
import authRouter        from './modules/auth/auth.router';
import setupRouter       from './modules/auth/setup.router';
import usersRouter       from './modules/users/users.router';
import projectsRouter    from './modules/projects/projects.router';
import expensesRouter    from './modules/expenses/expenses.router';
import categoriesRouter  from './modules/categories/categories.router';
import reportsRouter     from './modules/reports/reports.router';
import invitationsRouter from './modules/invitations/invitations.router';
import ocrRouter          from './modules/ocr/ocr.router';
import payrollRouter      from './modules/payroll/payroll.router';
import monitoringRouter   from './modules/monitoring/monitoring.router';
import quotationsRouter   from './modules/quotations/quotations.router';
import cardsRouter           from './modules/cards/cards.router';
import beneficiariesRouter   from './modules/beneficiaries/beneficiaries.router';
import paymentOrdersRouter   from './modules/payment-orders/payment-orders.router';
import officeExpensesRouter  from './modules/office-expenses/office-expenses.router';
import backupRouter          from './modules/backup/backup.router';
import batchesRouter         from './modules/batches/batches.router';
import suppliersRouter       from './modules/suppliers/suppliers.router';
import notificationsRouter         from './modules/notifications/notifications.router';
import notificationContactsRouter  from './modules/notification-contacts/notification-contacts.router';

const app = express();

// Render (y otros proxies) añaden X-Forwarded-For.
// Sin esto, express-rate-limit lanza ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1);

// ----------------------------------------------------------------
// Seguridad: headers HTTP
// ----------------------------------------------------------------
app.use(helmet());

// ----------------------------------------------------------------
// CORS
// ----------------------------------------------------------------
app.use(cors({
  origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ----------------------------------------------------------------
// Rate limiting (anti-bruteforce en auth)
// ----------------------------------------------------------------
const authLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minuto
  max: 10,               // máximo 10 intentos por minuto por IP
  message: { success: false, error: 'Demasiados intentos. Espera 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit general para toda la API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// ----------------------------------------------------------------
// Body parsers
// ----------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ----------------------------------------------------------------
// Request Logger (registra cada petición en system_logs)
// ----------------------------------------------------------------
app.use(requestLogger);

// ----------------------------------------------------------------
// Archivos estáticos (fotos de facturas)
// ----------------------------------------------------------------
app.use('/uploads', express.static(path.resolve(env.UPLOAD_PATH)));

// ----------------------------------------------------------------
// Health check (simple — para Railway y uptime monitors externos)
// ----------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    uptime: Math.round(process.uptime()),
  });
});

// Health check detallado (verifica DB, memoria, etc.)
app.use('/health', monitoringRouter);

// ----------------------------------------------------------------
// Rutas API
// ----------------------------------------------------------------
app.use('/api/v1/auth',       authLimiter, authRouter);
app.use('/api/v1/setup',      apiLimiter,  setupRouter);
app.use('/api/v1/users',      apiLimiter,  usersRouter);
app.use('/api/v1/projects',   apiLimiter,  projectsRouter);
app.use('/api/v1/expenses',   apiLimiter,  expensesRouter);
app.use('/api/v1/categories', apiLimiter,  categoriesRouter);
app.use('/api/v1/reports',      apiLimiter,  reportsRouter);
app.use('/api/v1/invitations', apiLimiter,  invitationsRouter);
app.use('/api/v1/ocr',         apiLimiter,  ocrRouter);
app.use('/api/v1/payrolls',    apiLimiter,  payrollRouter);
app.use('/api/v1/quotations',  apiLimiter,  quotationsRouter);
app.use('/api/v1/cards',          apiLimiter,  cardsRouter);
app.use('/api/v1/beneficiaries',   apiLimiter,  beneficiariesRouter);
app.use('/api/v1/payment-orders',  apiLimiter,  paymentOrdersRouter);
app.use('/api/v1/office-expenses', apiLimiter,  officeExpensesRouter);
app.use('/api/v1/batches',         apiLimiter,  batchesRouter);
app.use('/api/v1/backup',          apiLimiter,  backupRouter);
app.use('/api/v1/suppliers',       apiLimiter,  suppliersRouter);
app.use('/api/v1/notifications',          apiLimiter,  notificationsRouter);
app.use('/api/v1/notification-contacts',  apiLimiter,  notificationContactsRouter);
app.use('/api/v1/monitoring', apiLimiter,  monitoringRouter);

// ----------------------------------------------------------------
// 404 handler
// ----------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

// ----------------------------------------------------------------
// Error handler global
// ----------------------------------------------------------------
app.use(errorHandler);

export default app;
