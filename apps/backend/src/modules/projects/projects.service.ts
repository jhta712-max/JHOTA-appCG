import prisma from '../../config/database';
import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../../middlewares/errorHandler';
import { buildPaginatedResponse, parsePagination } from '../../utils/pagination';
import { env } from '../../config/env';

const aiClient = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
import type {
  CreateProjectInput, UpdateProjectInput, ProjectQuery,
  CreateAddendumInput, UpdateAddendumInput,
  CreateCubicacionInput, UpdateCubicacionInput,
  CreateProjectItemInput, UpdateProjectItemInput,
} from './projects.schema';

export async function getProjects(query: ProjectQuery, requestingUser: { userId: string; role: string }) {
  const { page, limit, skip } = parsePagination(query);

  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
      { client: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  // Operadores solo ven proyectos asignados a ellos
  if (requestingUser.role === 'operator') {
    where.assignments = { some: { userId: requestingUser.userId } };
  }

  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [query.orderBy]: query.order },
      include: {
        createdBy:   { select: { id: true, name: true } },
        _count:      { select: { expenses: true } },
        assignments: { select: { userId: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, { page, limit, skip });
}

export async function getProjectById(id: string, requestingUser?: { userId: string; role: string }) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      createdBy:   { select: { id: true, name: true } },
      _count:      { select: { expenses: true } },
      assignments: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!project) throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');

  // Operadores solo pueden ver proyectos asignados a ellos
  if (requestingUser?.role === 'operator') {
    const isAssigned = project.assignments.some((a) => a.userId === requestingUser.userId);
    if (!isAssigned) throw new AppError(403, 'No tienes acceso a este proyecto', 'FORBIDDEN');
  }

  return project;
}

export async function getProjectSummary(id: string, requestingUser?: { userId: string; role: string }) {
  // Operadores solo pueden acceder a proyectos asignados
  if (requestingUser?.role === 'operator') {
    await getProjectById(id, requestingUser);
  }
  const project = await prisma.project.findUnique({
    where:   { id },
    include: { addendums: { orderBy: { number: 'asc' } } },
  });
  if (!project) throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');

  const [expenseStats, byCategory, byItem] = await Promise.all([
    prisma.expense.aggregate({
      where:   { projectId: id, status: 'ACTIVE' },
      _sum:    { amount: true },
      _count:  { id: true },
    }),
    prisma.expense.groupBy({
      by:      ['categoryId'],
      where:   { projectId: id, status: 'ACTIVE' },
      _sum:    { amount: true },
      _count:  { id: true },
    }),
    project.batchesEnabled ? prisma.expense.groupBy({
      by:      ['batchItemId'],
      where:   { projectId: id, status: 'ACTIVE', batchItemId: { not: null } },
      _sum:    { amount: true },
      _count:  { id: true },
    }) : Promise.resolve([]),
  ]);

  const categoryIds = byCategory.map((c) => c.categoryId);
  const categories  = await prisma.expenseCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, icon: true },
  });

  const itemIds = byItem.map((i) => i.batchItemId).filter(Boolean) as string[];
  const items = itemIds.length > 0 ? await prisma.batchItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, code: true },
  }) : [];

  const addendumTotal   = project.addendums.reduce((sum, a) => sum + Number(a.amount), 0);
  const totalBudget     = Number(project.estimatedBudget) + addendumTotal;
  const totalSpent      = Number(expenseStats._sum.amount ?? 0);
  const budgetRemaining = totalBudget - totalSpent;
  const budgetUsedPct   = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return {
    project: {
      id:              project.id,
      code:            project.code,
      name:            project.name,
      status:          project.status,
      estimatedBudget: Number(project.estimatedBudget),
      addendumTotal,
      totalBudget,
    },
    summary: {
      totalSpent,
      budgetRemaining,
      budgetUsedPct:  Math.round(budgetUsedPct * 100) / 100,
      expenseCount:   expenseStats._count.id,
    },
    addendums: project.addendums.map((a) => ({
      id:          a.id,
      number:      a.number,
      amount:      Number(a.amount),
      description: a.description,
      date:        a.date,
    })),
    byCategory: byCategory.map((bc) => {
      const cat = categories.find((c) => c.id === bc.categoryId);
      return {
        category:     cat,
        totalAmount:  Number(bc._sum.amount ?? 0),
        expenseCount: bc._count.id,
      };
    }),
    byItem: project.batchesEnabled ? byItem.map((bi) => {
      const item = items.find((i) => i.id === bi.batchItemId);
      return {
        itemId:       bi.batchItemId,
        itemCode:     item?.code || 'Unknown',
        totalAmount:  Number(bi._sum.amount ?? 0),
        count:        bi._count.id,
      };
    }).sort((a, b) => a.itemCode.localeCompare(b.itemCode)) : [],
  };
}

export async function createProject(data: CreateProjectInput, userId: string) {
  const existing = await prisma.project.findUnique({ where: { code: data.code } });
  if (existing) throw new AppError(409, `Ya existe un proyecto con el código ${data.code}`, 'DUPLICATE_CODE');

  return prisma.project.create({
    data: {
      ...data,
      startDate:       new Date(data.startDate),
      endDate:         data.endDate ? new Date(data.endDate) : undefined,
      estimatedBudget: data.estimatedBudget,
      createdById:     userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function updateProject(id: string, data: UpdateProjectInput) {
  await getProjectById(id);
  return prisma.project.update({
    where: { id },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate:   data.endDate   ? new Date(data.endDate)   : undefined,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function deleteProject(id: string) {
  const project = await getProjectById(id);
  const expenseCount = await prisma.expense.count({ where: { projectId: id } });
  if (expenseCount > 0) {
    throw new AppError(
      409,
      `No se puede eliminar el proyecto. Tiene ${expenseCount} gasto(s) registrado(s). Cámbialo a estado CANCELLED en su lugar.`,
      'HAS_EXPENSES',
    );
  }
  await prisma.project.delete({ where: { id } });
  return project;
}

// ── Adendas de contrato ───────────────────────────────────────

export async function getAddendums(projectId: string) {
  await getProjectById(projectId); // verifica que el proyecto existe
  const addendums = await prisma.projectAddendum.findMany({
    where:   { projectId },
    orderBy: { number: 'asc' },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return addendums.map((a) => ({ ...a, amount: Number(a.amount) }));
}

export async function createAddendum(projectId: string, data: CreateAddendumInput, userId: string) {
  await getProjectById(projectId);

  // Calcular siguiente número de adenda para este proyecto
  const lastAddendum = await prisma.projectAddendum.findFirst({
    where:   { projectId },
    orderBy: { number: 'desc' },
    select:  { number: true },
  });
  const nextNumber = (lastAddendum?.number ?? 0) + 1;

  const addendum = await prisma.projectAddendum.create({
    data: {
      projectId,
      number:      nextNumber,
      amount:      data.amount,
      description: data.description,
      date:        new Date(data.date),
      createdById: userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return { ...addendum, amount: Number(addendum.amount) };
}

export async function updateAddendum(projectId: string, addendumId: string, data: UpdateAddendumInput) {
  const existing = await prisma.projectAddendum.findFirst({
    where: { id: addendumId, projectId },
  });
  if (!existing) throw new AppError(404, 'Adenda no encontrada', 'NOT_FOUND');

  const updated = await prisma.projectAddendum.update({
    where: { id: addendumId },
    data: {
      ...(data.amount      !== undefined && { amount: data.amount }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.date        !== undefined && { date: new Date(data.date) }),
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return { ...updated, amount: Number(updated.amount) };
}

export async function deleteAddendum(projectId: string, addendumId: string) {
  const existing = await prisma.projectAddendum.findFirst({
    where: { id: addendumId, projectId },
  });
  if (!existing) throw new AppError(404, 'Adenda no encontrada', 'NOT_FOUND');

  await prisma.projectAddendum.delete({ where: { id: addendumId } });
  return existing;
}

// ── Cubicaciones y Avance ────────────────────────────────────

export async function getCubicaciones(projectId: string) {
  await getProjectById(projectId);
  const rows = await prisma.projectCubicacion.findMany({
    where:   { projectId },
    orderBy: { number: 'asc' },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return rows.map((c) => ({
    ...c,
    amount:      Number(c.amount),
    progressPct: Number(c.progressPct),
  }));
}

export async function createCubicacion(projectId: string, data: CreateCubicacionInput, userId: string) {
  await getProjectById(projectId);

  const last = await prisma.projectCubicacion.findFirst({
    where:   { projectId },
    orderBy: { number: 'desc' },
    select:  { number: true },
  });
  const nextNumber = (last?.number ?? 0) + 1;

  const row = await prisma.projectCubicacion.create({
    data: {
      projectId,
      number:      nextNumber,
      amount:      data.amount,
      progressPct: data.progressPct ?? 0,
      description: data.description,
      date:        new Date(data.date),
      createdById: userId,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return { ...row, amount: Number(row.amount), progressPct: Number(row.progressPct) };
}

export async function updateCubicacion(projectId: string, cubicacionId: string, data: UpdateCubicacionInput) {
  const existing = await prisma.projectCubicacion.findFirst({
    where: { id: cubicacionId, projectId },
  });
  if (!existing) throw new AppError(404, 'Cubicación no encontrada', 'NOT_FOUND');

  const updated = await prisma.projectCubicacion.update({
    where: { id: cubicacionId },
    data: {
      ...(data.amount      !== undefined && { amount: data.amount }),
      ...(data.progressPct !== undefined && { progressPct: data.progressPct }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.date        !== undefined && { date: new Date(data.date) }),
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return { ...updated, amount: Number(updated.amount), progressPct: Number(updated.progressPct) };
}

export async function deleteCubicacion(projectId: string, cubicacionId: string) {
  const existing = await prisma.projectCubicacion.findFirst({
    where: { id: cubicacionId, projectId },
  });
  if (!existing) throw new AppError(404, 'Cubicación no encontrada', 'NOT_FOUND');
  await prisma.projectCubicacion.delete({ where: { id: cubicacionId } });
  return existing;
}

// ── Asignaciones de operadores ────────────────────────────────

export async function getAssignments(projectId: string) {
  await getProjectById(projectId);
  return prisma.projectAssignment.findMany({
    where:   { projectId },
    include: {
      user:       { select: { id: true, name: true, email: true } },
      assignedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function assignUser(projectId: string, userId: string, assignedById: string) {
  await getProjectById(projectId);

  // Verificar que el usuario existe y es operador
  const user = await prisma.user.findUnique({
    where:   { id: userId },
    include: { role: true },
  });
  if (!user) throw new AppError(404, 'Usuario no encontrado', 'NOT_FOUND');
  if (user.role.name !== 'operator') {
    throw new AppError(400, 'Solo se pueden asignar usuarios con rol de operador', 'INVALID_ROLE');
  }

  // Evitar duplicados (upsert)
  return prisma.projectAssignment.upsert({
    where:  { projectId_userId: { projectId, userId } },
    create: { projectId, userId, assignedById },
    update: { assignedById },
    include: {
      user:       { select: { id: true, name: true, email: true } },
      assignedBy: { select: { id: true, name: true } },
    },
  });
}

export async function unassignUser(projectId: string, userId: string) {
  const existing = await prisma.projectAssignment.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!existing) throw new AppError(404, 'Asignación no encontrada', 'NOT_FOUND');
  await prisma.projectAssignment.delete({
    where: { projectId_userId: { projectId, userId } },
  });
  return existing;
}

export async function getFinancialAnalysis(projectId: string) {
  const project = await prisma.project.findUnique({
    where:   { id: projectId },
    include: {
      addendums:    { select: { amount: true } },
      cubicaciones: { orderBy: { number: 'asc' } },
    },
  });
  if (!project) throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');

  const addendumTotal   = project.addendums.reduce((s: number, a: any) => s + Number(a.amount), 0);
  const totalBudget     = Number(project.estimatedBudget) + addendumTotal;

  const expenseStats = await prisma.expense.aggregate({
    where:  { projectId, status: 'ACTIVE' },
    _sum:   { amount: true },
    _count: { id: true },
  });

  const totalGastado    = Number(expenseStats._sum.amount ?? 0);
  const totalCubicado   = project.cubicaciones.reduce((s: number, c: any) => s + Number(c.amount), 0);
  const margen          = totalCubicado - totalGastado;
  const lastProgress    = project.cubicaciones.length > 0
    ? Number(project.cubicaciones[project.cubicaciones.length - 1].progressPct)
    : 0;

  return {
    project: {
      id:              project.id,
      code:            project.code,
      name:            project.name,
      estimatedBudget: Number(project.estimatedBudget),
      addendumTotal,
      totalBudget,
    },
    financials: {
      totalCubicado,
      totalGastado,
      margen,
      margenPct:      totalCubicado > 0 ? Math.round((margen / totalCubicado) * 10000) / 100 : 0,
      lastProgressPct: lastProgress,
      expenseCount:   expenseStats._count.id,
    },
    cubicaciones: project.cubicaciones.map((c: any) => ({
      id:          c.id,
      number:      c.number,
      amount:      Number(c.amount),
      progressPct: Number(c.progressPct),
      description: c.description,
      date:        c.date,
      createdAt:   c.createdAt,
    })),
  };
}

export async function generateAiSummary(projectId: string): Promise<{ summary: string; generatedAt: string }> {
  const project = await prisma.project.findUnique({
    where:   { id: projectId },
    include: {
      addendums: { select: { amount: true, description: true, number: true } },
    },
  });
  if (!project) throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');

  const addendumTotal = project.addendums.reduce((s, a) => s + Number(a.amount), 0);
  const totalBudget   = Number(project.estimatedBudget) + addendumTotal;

  const [expenseStats, byCategory, pendingOrders, quotationStats] = await Promise.all([
    prisma.expense.aggregate({
      where:  { projectId, status: 'ACTIVE' },
      _sum:   { amount: true },
      _count: { id: true },
    }),
    prisma.expense.groupBy({
      by:      ['categoryId'],
      where:   { projectId, status: 'ACTIVE' },
      _sum:    { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take:    4,
    }),
    prisma.paymentOrder.count({
      where: { projectId, status: 'PENDING' },
    }),
    prisma.quotation.aggregate({
      where:  { projectId },
      _count: { id: true },
      _sum:   { total: true },
    }),
  ]);

  const catIds = byCategory.map((c) => c.categoryId);
  const cats   = await prisma.expenseCategory.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } });
  const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));

  const totalSpent      = Number(expenseStats._sum.amount ?? 0);
  const budgetRemaining = totalBudget - totalSpent;
  const usedPct         = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const fmt             = (n: number) => `RD$ ${n.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const catLines = byCategory.map((c) =>
    `  - ${catMap[c.categoryId] ?? 'Sin categoría'}: ${fmt(Number(c._sum.amount ?? 0))}`
  ).join('\n');

  const context = `
Proyecto: ${project.name} (${project.code})
Estado: ${project.status}
Cliente: ${project.client ?? 'No especificado'}
Presupuesto base: ${fmt(Number(project.estimatedBudget))}
${project.addendums.length > 0 ? `Adendas (${project.addendums.length}): +${fmt(addendumTotal)} → Presupuesto total: ${fmt(totalBudget)}` : ''}
Total gastado: ${fmt(totalSpent)} (${usedPct.toFixed(1)}% del presupuesto)
Disponible: ${fmt(budgetRemaining)}${budgetRemaining < 0 ? ' ⚠️ EN DÉFICIT' : ''}
Número de gastos: ${expenseStats._count.id}
Órdenes de pago pendientes: ${pendingOrders}
Cotizaciones activas: ${quotationStats._count.id} (total cotizado: ${fmt(Number(quotationStats._sum.total ?? 0))})
Principales categorías de gasto:
${catLines || '  (sin gastos registrados)'}
`.trim();

  if (!aiClient) {
    const status = budgetRemaining < 0
      ? `El proyecto está en déficit de ${fmt(Math.abs(budgetRemaining))}.`
      : usedPct >= 90
      ? `El presupuesto está casi agotado (${usedPct.toFixed(1)}% utilizado).`
      : `El proyecto tiene ${fmt(budgetRemaining)} disponibles (${(100 - usedPct).toFixed(1)}% del presupuesto).`;
    return {
      summary: `${project.name} — ${status} Se han registrado ${expenseStats._count.id} gastos y hay ${pendingOrders} órdenes pendientes de pago.`,
      generatedAt: new Date().toISOString(),
    };
  }

  const msg = await aiClient.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 350,
    messages:   [{
      role:    'user',
      content: `Eres el asistente financiero de una empresa constructora dominicana. Genera un resumen ejecutivo conciso (3-4 párrafos cortos) en español sobre el siguiente proyecto, orientado a la gerencia. Incluye: estado presupuestario, alertas si las hay, y una recomendación breve. Sé directo y claro.

${context}`,
    }],
  });

  const summary = ((msg.content[0] as any).text ?? '').trim();
  return { summary, generatedAt: new Date().toISOString() };
}

// ── Items de proyecto (partidas/lotes) ────────────────────────

export async function getProjectItems(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');

  return prisma.projectItem.findMany({
    where:   { projectId },
    orderBy: { number: 'asc' },
    include: { _count: { select: { expenses: true, paymentOrders: true, payrolls: true, quotations: true } } },
  });
}

export async function createProjectItem(projectId: string, data: CreateProjectItemInput) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');

  const last = await prisma.projectItem.findFirst({
    where:   { projectId },
    orderBy: { number: 'desc' },
    select:  { number: true },
  });
  return prisma.projectItem.create({
    data: { projectId, number: (last?.number ?? 0) + 1, name: data.name },
  });
}

export async function updateProjectItem(projectId: string, itemId: string, data: UpdateProjectItemInput) {
  const existing = await prisma.projectItem.findFirst({ where: { id: itemId, projectId } });
  if (!existing) throw new AppError(404, 'Item no encontrado', 'NOT_FOUND');

  return prisma.projectItem.update({
    where: { id: itemId },
    data: {
      ...(data.name   !== undefined && { name: data.name }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });
}


export async function getBatchItemsForProject(projectId: string) {
  return prisma.batchItem.findMany({
    where: { batch: { projectId }, status: 'ACTIVE' },
    select: { id: true, code: true, description: true, provincia: true, sector: true, budget: true },
    orderBy: { code: 'asc' },
  });
}