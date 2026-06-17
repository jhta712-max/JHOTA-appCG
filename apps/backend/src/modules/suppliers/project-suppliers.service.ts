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
  return prisma.projectSupplier.upsert({
    where: { projectId_supplierId: { projectId, supplierId } },
    create: { projectId, supplierId },
    update: {},
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
