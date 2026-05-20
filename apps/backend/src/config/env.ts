import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV:           z.enum(['development', 'production', 'test']).default('development'),
  PORT:               z.coerce.number().default(3001),
  DATABASE_URL:       z.string().url('DATABASE_URL debe ser una URL válida'),
  JWT_SECRET:          z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET:  z.string().min(32).optional(), // Si no se define, usa JWT_SECRET
  JWT_ACCESS_EXPIRES:  z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  FRONTEND_URL:       z.string().url().default('http://localhost:5173'),
  STORAGE_TYPE:       z.enum(['local', 's3']).default('local'),
  UPLOAD_PATH:        z.string().default('./uploads'),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().default(10),
  LOG_LEVEL:          z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  // S3 opcionales
  AWS_ACCESS_KEY_ID:      z.string().optional(),
  AWS_SECRET_ACCESS_KEY:  z.string().optional(),
  AWS_BUCKET_NAME:        z.string().optional(),
  AWS_REGION:             z.string().optional(),
  // Email (Gmail)
  GMAIL_USER:             z.string().email().optional(),
  GMAIL_APP_PASSWORD:     z.string().optional(),
  // Anthropic (OCR con IA)
  ANTHROPIC_API_KEY:      z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  process.stderr.write('=== ERROR DE CONFIGURACIÓN EN VARIABLES DE ENTORNO ===\n');
  process.stderr.write(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2) + '\n');
  process.stderr.write('======================================================\n');
  process.exit(1);
}

export const env = pars