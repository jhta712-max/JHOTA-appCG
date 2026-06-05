import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateSupplierInput, UpdateSupplierInput } from './suppliers.schema';

export async function listSuppliers(search?: string, onlyActive = false) {
  const where: any = {};
  if (onlyActive) where.isActive = true;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { rnc:  { contains: search } },
    ];
  }
  return prisma.supplier.findMany({
    where,
    include: {
      createdBy: { select: { id: true, name: true } },
      _count:    { select: { paymentOrders: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getSupplierById(id: string) {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count:    { select: { paymentOrders: true } },
    },
  });
  if (!supplier) throw new AppError(404, 'Suplidor no encontrado', 'SUPPLIER_NOT_FOUND');
  return supplier;
}

export async function getSupplierHistory(id: string) {
  const supplier = await getSupplierById(id);

  const quotationWhere: any = {
    OR: [{ supplierName: { equals: supplier.name, mode: 'insensitive' } }],
  };
  if (supplier.rnc) quotationWhere.OR.push({ supplierRnc: supplier.rnc });

  const quotations = await prisma.quotation.findMany({
    where:   quotationWhere,
    include: {
      project:  { select: { id: true, code: true, name: true } },
      payments: { select: { amount: true } },
    },
    orderBy: { quotationDate: 'desc' },
    take:    50,
  });

  const fiscalVouchers = supplier.rnc
    ? await prisma.fiscalVoucher.findMany({
        where:   { supplierRnc: supplier.rnc },
        include: {
          expense: {
            include: { project: { select: { id: true, code: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take:    50,
      })
    : [];

  const officeExpenses = await prisma.officeExpense.findMany({
    where:   { supplierId: id, status: 'ACTIVE' },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { expenseDate: 'desc' },
    take:    50,
  });

  // Órdenes de pago recibidas por este suplidor
  const paymentOrders = await prisma.paymentOrder.findMany({
    where:   { supplierId: id },
    include: {
      project:   { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take:    100,
  });

  const totalQuoted         = quotations.reduce((s, q) => s + Number(q.total), 0);
  const totalPaid           = quotations.reduce((s, q) => s + q.payments.reduce((ps, p) => ps + Number(p.amount), 0), 0);
  const totalFiscal         = fiscalVouchers.reduce((s, v) => s + Number(v.expense.amount), 0);
  const totalOfficeExpenses = officeExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalPaymentOrders  = paymentOrders
    .filter((po) => po.status === 'PAID')
    .reduce((s, po) => s + Number(po.amount), 0);
  const projectIds = new Set([
    ...quotations.map((q) => q.projectId),
    ...fiscalVouchers.map((v) => v.expense.projectId),
    ...paymentOrders.map((po) => po.projectId),
  ]);

  return {
    supplier,
    stats: {
      totalQuoted,
      totalPaid,
      totalFiscal,
      totalOfficeExpenses,
      totalPaymentOrders,
      quotationCount:     quotations.length,
      voucherCount:       fiscalVouchers.length,
      officeExpenseCount: officeExpenses.length,
      paymentOrderCount:  paymentOrders.length,
      projectCount:       projectIds.size,
    },
    quotations,
    fiscalVouchers,
    officeExpenses,
    paymentOrders,
  };
}

export async function createSupplier(data: CreateSupplierInput, userId: string) {
  if (data.rnc) {
    const exists = await prisma.supplier.findUnique({ where: { rnc: data.rnc } });
    if (exists) throw new AppError(409, 'Ya existe un suplidor con ese RNC', 'SUPPLIER_RNC_EXISTS');
  }
  return prisma.supplier.create({
    data:    { ...data, createdById: userId },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function updateSupplier(id: string, data: UpdateSupplierInput) {
  await getSupplierById(id);
  if (data.rnc) {
    const exists = await prisma.supplier.findFirst({ where: { rnc: data.rnc, NOT: { id } } });
    if (exists) throw new AppError(409, 'Ya existe un suplidor con ese RNC', 'SUPPLIER_RNC_EXISTS');
  }
  return prisma.supplier.update({
    where:   { id },
    data,
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function toggleSupplierActive(id: string) {
  const supplier = await getSupplierById(id);
  return prisma.supplier.update({
    where: { id },
    data:  { isActive: !supplier.isActive },
  });
}
