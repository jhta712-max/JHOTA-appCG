import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateSubscriptionInput, UpdateSubscriptionInput } from './service-subscriptions.schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextPaymentDate(billingDay: number): Date {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  // Try billing day in current month
  let candidate = new Date(year, month, billingDay);
  // If billing day doesn't exist in this month (e.g. 31 in April), use last day of month
  if (candidate.getMonth() !== month) {
    candidate = new Date(year, month + 1, 0); // last day of current month
  }

  // If billing day already passed this month, move to next month
  if (today > billingDay) {
    candidate = new Date(year, month + 1, billingDay);
    if (candidate.getMonth() !== month + 1) {
      candidate = new Date(year, month + 2, 0); // last day of next month
    }
  }

  return candidate;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listAll() {
  return prisma.serviceSubscription.findMany({
    orderBy: { provider: 'asc' },
  });
}

export async function getOne(id: string) {
  const sub = await prisma.serviceSubscription.findUnique({ where: { id } });
  if (!sub) throw new AppError(404, 'Suscripción no encontrada', 'SUBSCRIPTION_NOT_FOUND');
  return sub;
}

export async function create(data: CreateSubscriptionInput) {
  return prisma.serviceSubscription.create({ data });
}

export async function update(id: string, data: UpdateSubscriptionInput) {
  await getOne(id);
  return prisma.serviceSubscription.update({ where: { id }, data });
}

export async function remove(id: string) {
  await getOne(id);
  return prisma.serviceSubscription.delete({ where: { id } });
}

// ─── Upcoming payments ────────────────────────────────────────────────────────

export async function getUpcomingPayments(daysAhead = 7) {
  const subscriptions = await prisma.serviceSubscription.findMany({
    where: { isActive: true },
    orderBy: { provider: 'asc' },
  });

  const now   = new Date();
  const today = now.getDate();

  return subscriptions
    .map((sub) => {
      const nextDate  = nextPaymentDate(sub.billingDay);
      const diffMs    = nextDate.getTime() - new Date(now.getFullYear(), now.getMonth(), today).getTime();
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return { ...sub, nextPaymentDate: nextDate, daysUntil };
    })
    .filter((sub) => sub.daysUntil <= daysAhead);
}

// ─── CSV export ───────────────────────────────────────────────────────────────

export async function exportCsv(): Promise<string> {
  const subscriptions = await prisma.serviceSubscription.findMany({
    where: { isActive: true },
    orderBy: { provider: 'asc' },
  });

  const header = 'Nombre,Proveedor,Descripcion,Costo Mensual,Moneda,Dia Facturacion,Metodo Pago,URL,Activo,Notas';

  const rows = subscriptions.map((sub) => {
    const cols = [
      sub.name,
      sub.provider,
      sub.description ?? '',
      sub.monthlyCost.toString(),
      sub.currency,
      sub.billingDay.toString(),
      sub.paymentMethod ?? '',
      sub.url ?? '',
      sub.isActive ? 'Si' : 'No',
      sub.notes ?? '',
    ].map((val) => `"${val.replace(/"/g, '""')}"`);
    return cols.join(',');
  });

  return [header, ...rows].join('\n');
}
