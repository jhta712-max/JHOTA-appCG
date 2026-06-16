import { PrismaClient } from '@prisma/client';
import { env } from './env';

const SOFT_DELETE_MODELS = new Set([
  'Expense', 'PaymentOrder', 'Supplier', 'Project', 'User',
  'Payroll', 'Quotation', 'ContratoAjustado', 'OfficeExpense', 'Batch', 'SupplierCreditLine',
]);

function createPrismaClient() {
  const client = new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Auto-filter soft-deleted records from all read operations
  client.$use(async (params, next) => {
    if (params.model && SOFT_DELETE_MODELS.has(params.model)) {
      if (['findMany', 'findFirst', 'count', 'aggregate'].includes(params.action)) {
        params.args = params.args ?? {};
        params.args.where = { deletedAt: null, ...(params.args.where ?? {}) };
      }
      if (params.action === 'findUnique' || params.action === 'findUniqueOrThrow') {
        params.action = params.action === 'findUniqueOrThrow' ? 'findFirstOrThrow' : 'findFirst';
        params.args = params.args ?? {};
        params.args.where = { deletedAt: null, ...(params.args.where ?? {}) };
      }
    }
    return next(params);
  });

  return client;
}

// Singleton: reutiliza el cliente en toda la app
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
