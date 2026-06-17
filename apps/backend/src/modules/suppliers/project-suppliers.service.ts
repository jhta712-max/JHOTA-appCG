import prisma from '../../config/database';

export async function listProjectSuppliers(projectId: string) {
  return prisma.projectSupplier.findMany({
    where: { projectId },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          rnc: true,
          isActive: true,
          bank: true,
          accountNumber: true,
          accountType: true,
          bankAccounts: {
            select: {
              id: true,
              bank: true,
              accountType: true,
              accountNumber: true,
              isDefault: true,
            },
          },
        },
      },
    },
    orderBy: { supplier: { name: 'asc' } },
  });
}

export async function assignSupplierToProject(projectId: string, supplierId: string) {
  return prisma.projectSupplier.create({
    data: { projectId, supplierId },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          rnc: true,
          isActive: true,
        },
      },
    },
  });
}

export async function removeSupplierFromProject(projectId: string, supplierId: string) {
  return prisma.projectSupplier.delete({
    where: { projectId_supplierId: { projectId, supplierId } },
  });
}

export async function importFromPayments(projectId: string): Promise<{ imported: number; skipped: number }> {
  const orders = await prisma.paymentOrder.findMany({
    where: {
      projectId,
      status: { not: 'VOIDED' },
    },
    select: { supplierId: true },
    distinct: ['supplierId'],
  });

  let imported = 0;
  let skipped = 0;

  for (const order of orders) {
    try {
      await prisma.projectSupplier.create({
        data: { projectId, supplierId: order.supplierId },
      });
      imported++;
    } catch (e: any) {
      if (e.code === 'P2002') skipped++;
      else throw e;
    }
  }

  return { imported, skipped };
}
