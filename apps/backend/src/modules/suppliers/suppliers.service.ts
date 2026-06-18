import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateSupplierInput, UpdateSupplierInput, CreateBankAccountInput, UpdateBankAccountInput } from './suppliers.schema';

const SUPPLIER_INCLUDE = {
  createdBy:    { select: { id: true, name: true } },
  _count:       { select: { paymentOrders: true } },
  bankAccounts: { orderBy: { isDefault: 'desc' as const } },
} as const;

export async function listSuppliers(search?: string, onlyActive = false, projectId?: string, isExpress?: boolean) {
  const where: any = {
    ...(projectId ? { projects: { some: { projectId } } } : {}),
    ...(isExpress !== undefined ? { isExpress } : {}),
  };
  if (onlyActive) where.isActive = true;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { rnc:  { contains: search } },
    ];
  }
  return prisma.supplier.findMany({
    where,
    include: SUPPLIER_INCLUDE,
    orderBy: { name: 'asc' },
  });
}

export async function getSupplierById(id: string) {
  const supplier = await prisma.supplier.findUnique({
    where:   { id },
    include: SUPPLIER_INCLUDE,
  });
  if (!supplier) throw new AppError(404, 'Suplidor no encontrado', 'SUPPLIER_NOT_FOUND');
  return supplier;
}

// ── Cuentas bancarias ─────────────────────────────────────────

export async function listBankAccounts(supplierId: string) {
  await getSupplierById(supplierId);
  return prisma.supplierBankAccount.findMany({
    where:   { supplierId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function addBankAccount(supplierId: string, data: CreateBankAccountInput) {
  await getSupplierById(supplierId);
  const existing = await prisma.supplierBankAccount.count({ where: { supplierId } });

  return prisma.$transaction(async (tx) => {
    if (data.isDefault || existing === 0) {
      await tx.supplierBankAccount.updateMany({ where: { supplierId }, data: { isDefault: false } });
    }
    return tx.supplierBankAccount.create({
      data: { ...data, supplierId, isDefault: data.isDefault ?? existing === 0 },
    });
  });
}

export async function updateBankAccount(supplierId: string, accountId: string, data: UpdateBankAccountInput) {
  const account = await prisma.supplierBankAccount.findFirst({ where: { id: accountId, supplierId } });
  if (!account) throw new AppError(404, 'Cuenta bancaria no encontrada', 'BANK_ACCOUNT_NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.supplierBankAccount.updateMany({ where: { supplierId }, data: { isDefault: false } });
    }
    return tx.supplierBankAccount.update({ where: { id: accountId }, data });
  });
}

export async function deleteBankAccount(supplierId: string, accountId: string) {
  const account = await prisma.supplierBankAccount.findFirst({ where: { id: accountId, supplierId } });
  if (!account) throw new AppError(404, 'Cuenta bancaria no encontrada', 'BANK_ACCOUNT_NOT_FOUND');

  await prisma.supplierBankAccount.delete({ where: { id: accountId } });

  // If deleted account was default, promote the first remaining account
  if (account.isDefault) {
    const next = await prisma.supplierBankAccount.findFirst({ where: { supplierId }, orderBy: { createdAt: 'asc' } });
    if (next) await prisma.supplierBankAccount.update({ where: { id: next.id }, data: { isDefault: true } });
  }
}

export async function setDefaultBankAccount(supplierId: string, accountId: string) {
  const account = await prisma.supplierBankAccount.findFirst({ where: { id: accountId, supplierId } });
  if (!account) throw new AppError(404, 'Cuenta bancaria no encontrada', 'BANK_ACCOUNT_NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    await tx.supplierBankAccount.updateMany({ where: { supplierId }, data: { isDefault: false } });
    return tx.supplierBankAccount.update({ where: { id: accountId }, data: { isDefault: true } });
  });
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

  const officeExpenses: { amount: number | string }[] = [];

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

// ── Soft-delete admin management ──────────────────────────────
export async function listDeletedSuppliers() {
  return prisma.supplier.findMany({
    where:   { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    select:  { id: true, name: true, rnc: true, deletedAt: true },
  });
}

export async function restoreSupplier(id: string) {
  const s = await prisma.supplier.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!s) throw new AppError(404, 'Suplidor eliminado no encontrado', 'NOT_FOUND');
  return prisma.supplier.update({ where: { id }, data: { deletedAt: null } });
}

export async function permanentDeleteSupplier(id: string) {
  const s = await prisma.supplier.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!s) throw new AppError(404, 'Suplidor eliminado no encontrado — solo se puede eliminar permanentemente registros ya soft-deleted', 'NOT_FOUND');
  await prisma.$executeRaw`DELETE FROM suppliers WHERE id = ${id}::uuid`;
}
