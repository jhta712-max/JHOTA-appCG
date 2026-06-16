import prisma from '../../config/database';

export async function getDashboardAlerts(userId: string, role: string) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const isAdminOrSupervisor = role === 'admin' || role === 'supervisor';

  const [
    pendingOrders,
    overBudgetProjects,
    expiringQuotations,
    creditLinesNearLimit,
    activeSubscriptions,
  ] = await Promise.all([
    // 1. Pending payment orders (admin/supervisor see all, others see their own)
    prisma.paymentOrder.findMany({
      where: {
        status: 'PENDING',
        deletedAt: null,
        ...(role === 'operator' || role === 'auxiliar' ? { createdById: userId } : {}),
      },
      select: {
        id: true,
        concept: true,
        amount: true,
        supplier: { select: { name: true } },
        project: { select: { code: true, name: true } },
      },
      take: 10,
      orderBy: { createdAt: 'asc' },
    }),

    // 2. Projects where expenses > 85% of estimatedBudget (admin/supervisor only)
    isAdminOrSupervisor
      ? prisma.project.findMany({
          where: { status: 'ACTIVE', estimatedBudget: { gt: 0 }, deletedAt: null },
          select: {
            id: true,
            code: true,
            name: true,
            estimatedBudget: true,
            expenses: {
              where: { status: 'ACTIVE', deletedAt: null },
              select: { amount: true },
            },
          },
          take: 50,
        })
      : Promise.resolve([]),

    // 3. Quotations expiring within 7 days
    prisma.quotation.findMany({
      where: {
        status: { in: ['PENDING', 'APPROVED', 'ADVANCE_PAID', 'IN_PROGRESS', 'PARTIAL_INVOICED'] },
        validUntil: { lte: in7Days, gte: now },
        deletedAt: null,
      },
      select: {
        id: true,
        supplierName: true,
        validUntil: true,
        project: { select: { code: true } },
      },
      take: 10,
      orderBy: { validUntil: 'asc' },
    }),

    // 4. Credit lines near limit (>80% consumed) — admin/supervisor only
    isAdminOrSupervisor
      ? prisma.supplierCreditLine.findMany({
          where: { isActive: true, creditLimit: { gt: 0 }, deletedAt: null },
          select: {
            id: true,
            creditLimit: true,
            supplierId: true,
            supplier: { select: { name: true } },
            expenses: { where: { status: 'ACTIVE', deletedAt: null }, select: { amount: true } },
            payments: { select: { amount: true } },
          },
          take: 20,
        })
      : Promise.resolve([]),

    // 5. Active service subscriptions — compute next payment date from billingDay
    prisma.serviceSubscription.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        provider: true,
        monthlyCost: true,
        currency: true,
        billingDay: true,
      },
      take: 20,
    }),
  ]);

  // Filter over-budget projects
  const budgetAlerts = (overBudgetProjects as any[])
    .map((p) => {
      const spent = p.expenses.reduce(
        (s: number, e: any) => s + parseFloat(e.amount.toString()),
        0,
      );
      const budget = parseFloat(p.estimatedBudget.toString());
      const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      return { id: p.id, code: p.code, name: p.name, budget, spent, pct };
    })
    .filter((p) => p.pct >= 85)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  // Filter credit lines near limit
  const creditAlerts = (creditLinesNearLimit as any[])
    .map((cl) => {
      const consumed = cl.expenses.reduce(
        (s: number, e: any) => s + parseFloat(e.amount.toString()),
        0,
      );
      const paid = cl.payments.reduce(
        (s: number, p: any) => s + parseFloat(p.amount.toString()),
        0,
      );
      const pending = consumed - paid;
      const limit = parseFloat(cl.creditLimit.toString());
      const pct = limit > 0 ? Math.round((pending / limit) * 100) : 0;
      return {
        id: cl.id,
        supplierId: cl.supplierId,
        supplierName: cl.supplier.name,
        limit,
        pending,
        available: limit - pending,
        pct,
      };
    })
    .filter((cl) => cl.pct >= 80)
    .sort((a, b) => b.pct - a.pct);

  // Compute next payment date from billingDay and filter those within 30 days
  const expiringSubscriptions = (activeSubscriptions as any[])
    .map((s) => {
      const day = s.billingDay as number;
      // Build candidate date this month; if already past, use next month
      const candidate = new Date(now.getFullYear(), now.getMonth(), day);
      if (candidate <= now) {
        candidate.setMonth(candidate.getMonth() + 1);
      }
      const daysLeft = Math.ceil((candidate.getTime() - now.getTime()) / 86400000);
      return {
        id: s.id,
        serviceName: `${s.name} (${s.provider})`,
        amount: parseFloat(s.monthlyCost.toString()),
        currency: s.currency as string,
        nextPaymentDate: candidate.toISOString(),
        daysLeft,
      };
    })
    .filter((s) => s.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 10);

  return {
    pendingOrders: pendingOrders.map((o) => ({
      id: o.id,
      description: o.concept,
      amount: parseFloat((o.amount as any).toString()),
      supplierName: o.supplier?.name ?? null,
      projectCode: o.project?.code ?? null,
      projectName: o.project?.name ?? null,
    })),
    budgetAlerts,
    expiringQuotations: expiringQuotations.map((q) => ({
      id: q.id,
      title: q.supplierName,
      validUntil: q.validUntil,
      projectCode: q.project?.code ?? null,
      supplierName: q.supplierName,
      daysLeft: Math.ceil(
        (new Date(q.validUntil!).getTime() - now.getTime()) / 86400000,
      ),
    })),
    creditAlerts,
    expiringSubscriptions,
  };
}
