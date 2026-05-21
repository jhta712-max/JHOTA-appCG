import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { buildPaginatedResponse, parsePagination } from '../../utils/pagination';
import type { CreatePaymentOrderInput, UpdatePaymentOrderInput, PaymentOrderQuery } from './payment-orders.schema';

const INCLUDE = {
  beneficiary: true,
  project:     { select: { id: true, code: true, name: true } },
  createdBy:   { select: { id: true, name: true } },
  paidBy:      { select: { id: true, name: true } },
} as const;

// ── Listar con filtros y paginación ───────────────────────────
export async function getPaymentOrders(query: PaymentOrderQuery) {
  const { page, limit, skip } = parsePagination(query);

  const where: any = {};
  if (query.status)        where.status        = query.status;
  if (query.projectId)     where.projectId     = query.projectId;
  if (query.beneficiaryId) where.beneficiaryId = query.beneficiaryId;
  if (query.search) {
    where.OR = [
      { concept:       { contains: query.search, mode: 'insensitive' } },
      { payingCompany: { contains: query.search, mode: 'insensitive' } },
      { beneficiary:   { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.paymentOrder.findMany({ where, skip, take: limit, orderBy: { [query.orderBy]: query.order }, include: INCLUDE }),
    prisma.paymentOrder.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, { page, limit, skip });
}

// ── Obtener una ───────────────────────────────────────────────
export async function getPaymentOrderById(id: string) {
  const po = await prisma.paymentOrder.findUnique({ where: { id }, include: INCLUDE });
  if (!po) throw new AppError(404, 'Orden de pago no encontrada', 'NOT_FOUND');
  return po;
}

// ── Crear ─────────────────────────────────────────────────────
export async function createPaymentOrder(data: CreatePaymentOrderInput, userId: string) {
  // Verificar que el proyecto existe y está activo
  const project = await prisma.project.findUnique({ where: { id: data.projectId } });
  if (!project)                    throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');
  if (project.status !== 'ACTIVE') throw new AppError(400, 'El proyecto debe estar activo', 'PROJECT_INACTIVE');

  // Verificar beneficiario activo
  const bene = await prisma.beneficiary.findUnique({ where: { id: data.beneficiaryId } });
  if (!bene || !bene.isActive) throw new AppError(404, 'Beneficiario no encontrado o inactivo', 'NOT_FOUND');

  // Número correlativo
  const last = await prisma.paymentOrder.findFirst({ orderBy: { number: 'desc' } });
  const number = (last?.number ?? 0) + 1;

  // Generar texto de orden
  const generatedText = buildOrderText({
    payingCompany: data.payingCompany,
    currency:      data.currency ?? 'RD$',
    amount:        Number(data.amount),
    concept:       data.concept,
    project:       `${project.code} — ${project.name}`,
    bank:          bene.bank,
    accountType:   bene.accountType,
    accountNumber: bene.accountNumber,
    holderName:    bene.name,
  });

  return prisma.paymentOrder.create({
    data: {
      number,
      payingCompany: data.payingCompany,
      beneficiaryId: data.beneficiaryId,
      projectId:     data.projectId,
      amount:        data.amount,
      currency:      data.currency ?? 'RD$',
      concept:       data.concept,
      notes:         data.notes,
      generatedText,
      createdById:   userId,
    },
    include: INCLUDE,
  });
}

// ── Actualizar ────────────────────────────────────────────────
export async function updatePaymentOrder(id: string, data: UpdatePaymentOrderInput) {
  const po = await getPaymentOrderById(id);
  if (po.status === 'PAID') throw new AppError(400, 'No se puede editar una orden ya pagada', 'ALREADY_PAID');

  // Regenerar texto si cambian datos relevantes
  const bene = await prisma.beneficiary.findUnique({ where: { id: data.beneficiaryId ?? po.beneficiaryId } });
  const project = await prisma.project.findUnique({ where: { id: data.projectId ?? po.projectId } });

  const merged = {
    payingCompany: data.payingCompany ?? po.payingCompany,
    currency:      data.currency      ?? po.currency,
    amount:        Number(data.amount ?? po.amount),
    concept:       data.concept       ?? po.concept,
    project:       `${project!.code} — ${project!.name}`,
    bank:          bene!.bank,
    accountType:   bene!.accountType,
    accountNumber: bene!.accountNumber,
    holderName:    bene!.name,
  };

  return prisma.paymentOrder.update({
    where: { id },
    data:  { ...data, generatedText: buildOrderText(merged) },
    include: INCLUDE,
  });
}

// ── Marcar como pagada ────────────────────────────────────────
export async function markAsPaid(id: string, userId: string) {
  const po = await getPaymentOrderById(id);
  if (po.status === 'PAID') throw new AppError(400, 'La orden ya está marcada como pagada', 'ALREADY_PAID');

  return prisma.paymentOrder.update({
    where: { id },
    data:  { status: 'PAID', paidAt: new Date(), paidById: userId },
    include: INCLUDE,
  });
}

// ── Anular ────────────────────────────────────────────────────
export async function voidPaymentOrder(id: string) {
  const po = await getPaymentOrderById(id);
  if (po.status === 'PAID') throw new AppError(400, 'No se puede anular una orden ya pagada', 'ALREADY_PAID');

  return prisma.paymentOrder.update({
    where: { id },
    data:  { status: 'VOIDED' },
    include: INCLUDE,
  });
}

// ── Helper: generar texto ─────────────────────────────────────
function buildOrderText(p: {
  payingCompany: string; currency: string; amount: number;
  concept: string; project: string; bank: string;
  accountType: string; accountNumber: string; holderName: string;
}) {
  const monto = p.amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hoy   = new Date();
  const fecha = hoy.toLocaleDateString('es-DO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const fechaCap = fecha.charAt(0).toUpperCase() + fecha.slice(1);

  return [
    p.payingCompany,
    `💰 ${p.currency} ${monto}`,
    `📌 Concepto: ${p.concept}`,
    `📍 Proyecto: ${p.project}`,
    `Banco: ${p.bank}`,
    `${p.accountType}: ${p.accountNumber}`,
    `nombre: ${p.holderName}`,
    `📅 Fecha: ${fechaCap}`,
  ].join('\n');
}
