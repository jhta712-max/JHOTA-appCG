import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type { CreateContratoInput, UpdateContratoInput, ContratoQuery } from './contratos-ajustados.schema';

const INCLUDE = {
  project:  { select: { id: true, code: true, name: true } },
  supplier: { select: { id: true, name: true, rnc: true } },
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
  pagos:    true,
  adendas:  { orderBy: { number: 'asc' as const } },
  expenses: {
    where:  { status: { not: 'VOIDED' as const } },
    select: { id: true, amount: true, expenseDate: true, description: true, status: true },
  },
};

function calcTotals(contrato: any) {
  const pagado    = contrato.expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  // montoContratado guarda el total de referencia: monto fijo (MONTO_FIJO) o
  // total estimado precio × cantidad (PRECIO_UNITARIO). Es 0 cuando un contrato
  // por precio unitario no tiene cantidad estimada — "abierto", sin tope.
  const montoBase = Number(contrato.montoContratado);
  const sumAdendas = (contrato.adendas ?? []).reduce((s: number, a: any) => s + Number(a.monto), 0);
  const monto     = montoBase + sumAdendas;
  const esUnitario = contrato.modalidad === 'PRECIO_UNITARIO';
  // "tieneTope": existe una referencia contra la cual medir balance/% ejecución.
  //   MONTO_FIJO → siempre. PRECIO_UNITARIO → solo si hay total estimado (montoBase > 0).
  const tieneTope = esUnitario ? montoBase > 0 : true;
  return {
    ...contrato,
    montoEfectivo:       monto,
    sumAdendas,
    pagadoAcumulado:     pagado,
    balancePendiente:    tieneTope ? monto - pagado : null,
    porcentajeEjecutado: tieneTope && monto > 0 ? (pagado / monto) * 100 : 0,
    sobregirado:         tieneTope ? pagado > monto : false,
    tieneTope,
  };
}

// Calcula el monto de referencia a persistir en montoContratado según la modalidad.
function computeMontoContratado(input: {
  modalidad?: string | null;
  montoContratado?: number | null;
  precioUnitario?: number | null;
  cantidadEstimada?: number | null;
}): number {
  if (input.modalidad === 'PRECIO_UNITARIO') {
    const precio = Number(input.precioUnitario ?? 0);
    const cant   = input.cantidadEstimada != null ? Number(input.cantidadEstimada) : null;
    return precio > 0 && cant != null && cant > 0 ? precio * cant : 0;
  }
  return Number(input.montoContratado ?? 0);
}

export async function getContratos(query: ContratoQuery) {
  const { page, limit, projectId, supplierId, estado, search } = query;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (projectId)  where.projectId  = projectId;
  if (supplierId) where.supplierId = supplierId;
  if (estado)     where.estado     = estado;
  if (search) {
    where.OR = [
      { descripcionTrabajo: { contains: search, mode: 'insensitive' } },
      { supplier: { name: { contains: search, mode: 'insensitive' } } },
      { project:  { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.contratoAjustado.count({ where }),
    prisma.contratoAjustado.findMany({
      where, include: INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip, take: limit,
    }),
  ]);

  return {
    data: items.map(calcTotals),
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

export async function getContratoById(id: string) {
  const c = await prisma.contratoAjustado.findUnique({ where: { id }, include: INCLUDE });
  if (!c) throw new AppError(404, 'Contrato no encontrado', 'NOT_FOUND');
  return calcTotals(c);
}

export async function createContrato(data: CreateContratoInput, userId: string) {
  const project  = await prisma.project.findUnique({ where: { id: data.projectId } });
  if (!project)  throw new AppError(404, 'Proyecto no encontrado', 'NOT_FOUND');
  const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
  if (!supplier) throw new AppError(404, 'Suplidor no encontrado', 'NOT_FOUND');

  const modalidad = data.modalidad ?? 'MONTO_FIJO';
  const esUnitario = modalidad === 'PRECIO_UNITARIO';
  const c = await prisma.contratoAjustado.create({
    data: {
      projectId:          data.projectId,
      supplierId:         data.supplierId,
      descripcionTrabajo: data.descripcionTrabajo,
      modalidad,
      montoContratado:    computeMontoContratado(data),
      precioUnitario:     esUnitario ? (data.precioUnitario ?? null) : null,
      unidad:             esUnitario ? (data.unidad?.trim() || null) : null,
      cantidadEstimada:   esUnitario ? (data.cantidadEstimada ?? null) : null,
      fechaContrato:      new Date(data.fechaContrato),
      observaciones:      data.observaciones ?? null,
      createdById:        userId,
    },
    include: INCLUDE,
  });
  return calcTotals(c);
}

export async function updateContrato(id: string, data: UpdateContratoInput, userId: string) {
  const existing = await prisma.contratoAjustado.findUnique({ where: { id }, include: { pagos: true, expenses: true } });
  if (!existing) throw new AppError(404, 'Contrato no encontrado', 'NOT_FOUND');

  if (data.estado === 'CANCELADO' && existing.pagos.length > 0) {
    throw new AppError(400, 'No se puede cancelar un contrato con pagos registrados', 'HAS_PAYMENTS');
  }

  // Modalidad + campos de precio unitario: se mezclan con lo existente (update parcial)
  // y se recalcula montoContratado (total de referencia) de forma consistente.
  const modalidad  = data.modalidad ?? existing.modalidad;
  const esUnitario = modalidad === 'PRECIO_UNITARIO';
  const precioUnitario   = data.precioUnitario   !== undefined ? data.precioUnitario
                          : (existing.precioUnitario != null ? Number(existing.precioUnitario) : null);
  const cantidadEstimada = data.cantidadEstimada !== undefined ? data.cantidadEstimada
                          : (existing.cantidadEstimada != null ? Number(existing.cantidadEstimada) : null);
  const unidad           = data.unidad !== undefined ? (data.unidad?.trim() || null) : existing.unidad;
  const montoContratadoInput = data.montoContratado !== undefined ? data.montoContratado : Number(existing.montoContratado);

  if (esUnitario && (precioUnitario == null || precioUnitario <= 0)) {
    throw new AppError(400, 'Un contrato por precio unitario requiere un precio unitario mayor a 0', 'INVALID_UNIT_PRICE');
  }
  if (!esUnitario && (montoContratadoInput == null || montoContratadoInput <= 0)) {
    throw new AppError(400, 'Un contrato por monto fijo requiere un monto contratado mayor a 0', 'INVALID_AMOUNT');
  }

  const newMonto = computeMontoContratado({ modalidad, montoContratado: montoContratadoInput, precioUnitario, cantidadEstimada });

  const c = await prisma.contratoAjustado.update({
    where: { id },
    data: {
      ...(data.projectId          && { projectId: data.projectId }),
      ...(data.supplierId         && { supplierId: data.supplierId }),
      ...(data.descripcionTrabajo && { descripcionTrabajo: data.descripcionTrabajo }),
      ...(data.fechaContrato      && { fechaContrato: new Date(data.fechaContrato) }),
      ...(data.estado             && { estado: data.estado }),
      ...(data.observaciones !== undefined && { observaciones: data.observaciones ?? null }),
      modalidad,
      montoContratado:  newMonto,
      precioUnitario:   esUnitario ? precioUnitario   : null,
      unidad:           esUnitario ? unidad           : null,
      cantidadEstimada: esUnitario ? cantidadEstimada : null,
      updatedById:      userId,
    },
    include: INCLUDE,
  });
  return calcTotals(c);
}

export async function deleteContrato(id: string) {
  const existing = await prisma.contratoAjustado.findUnique({
    where: { id },
    include: { pagos: true, expenses: { where: { status: { not: 'VOIDED' } } } },
  });
  if (!existing) throw new AppError(404, 'Contrato no encontrado', 'NOT_FOUND');
  if (existing.pagos.length > 0 || existing.expenses.length > 0) {
    throw new AppError(400, 'No se puede eliminar un contrato con pagos o gastos vinculados. Use estados.', 'HAS_PAYMENTS');
  }
  await prisma.contratoAjustado.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function linkExpense(contratoId: string, expenseId: string, userId: string) {
  const contrato = await prisma.contratoAjustado.findUnique({ where: { id: contratoId } });
  if (!contrato) throw new AppError(404, 'Contrato no encontrado', 'NOT_FOUND');

  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense)  throw new AppError(404, 'Gasto no encontrado', 'NOT_FOUND');
  if (expense.status === 'VOIDED') throw new AppError(400, 'No se puede vincular un gasto anulado', 'VOIDED');

  // Regla 1: mismo proyecto
  if (expense.projectId !== contrato.projectId) {
    throw new AppError(400, 'El gasto debe pertenecer al mismo proyecto que el contrato', 'PROJECT_MISMATCH');
  }
  // Regla 2: solo una vez
  if (expense.contratoAjustadoId) {
    throw new AppError(400, 'Este gasto ya está vinculado a un contrato', 'ALREADY_LINKED');
  }

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data:  { contratoAjustadoId: contratoId },
  });

  // Registrar en trazabilidad
  await prisma.contratoAjustadoPago.create({
    data: {
      contratoAjustadoId: contratoId,
      gastoId:            expenseId,
      monto:              updated.amount,
      fecha:              updated.expenseDate,
      creadoPorId:        userId,
    },
  });

  return getContratoById(contratoId);
}

export async function unlinkExpense(contratoId: string, expenseId: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) throw new AppError(404, 'Gasto no encontrado', 'NOT_FOUND');
  if (expense.contratoAjustadoId !== contratoId) {
    throw new AppError(400, 'Este gasto no está vinculado a este contrato', 'NOT_LINKED');
  }

  await prisma.$transaction([
    prisma.expense.update({ where: { id: expenseId }, data: { contratoAjustadoId: null } }),
    prisma.contratoAjustadoPago.deleteMany({ where: { contratoAjustadoId: contratoId, gastoId: expenseId } }),
  ]);

  return getContratoById(contratoId);
}

export async function getResumen() {
  const contratos = await prisma.contratoAjustado.findMany({
    include: {
      project:  { select: { id: true, code: true, name: true } },
      supplier: { select: { id: true, name: true } },
      expenses: { where: { status: { not: 'VOIDED' } }, select: { amount: true } },
      adendas:  { select: { monto: true } },
    },
  });

  const byProject: Record<string, any> = {};
  const bySupplier: Record<string, any> = {};
  let totalContratado = 0, totalPagado = 0;
  let activos = 0, completados = 0, sobregirados = 0;

  for (const c of contratos) {
    const sumAdendas = c.adendas.reduce((s, a) => s + Number(a.monto), 0);
    const montoBase  = Number(c.montoContratado);
    const monto      = montoBase + sumAdendas;
    const pagado     = c.expenses.reduce((s, e) => s + Number(e.amount), 0);
    // Contratos por precio unitario sin cantidad estimada no tienen tope: su referencia
    // de "contratado" es lo pagado (0 pendiente, nunca sobregirado) para no distorsionar totales.
    const tieneTope     = c.modalidad === 'PRECIO_UNITARIO' ? montoBase > 0 : true;
    const contratadoRef = tieneTope ? monto : pagado;
    totalContratado += contratadoRef;
    totalPagado     += pagado;
    if (c.estado === 'ACTIVO')     activos++;
    if (c.estado === 'COMPLETADO') completados++;
    if (tieneTope && pagado > monto) sobregirados++;

    const pKey = c.project.id;
    if (!byProject[pKey]) byProject[pKey] = { project: c.project, contratado: 0, pagado: 0 };
    byProject[pKey].contratado += contratadoRef;
    byProject[pKey].pagado     += pagado;

    const sKey = c.supplier.id;
    if (!bySupplier[sKey]) bySupplier[sKey] = { supplier: c.supplier, contratado: 0, pagado: 0 };
    bySupplier[sKey].contratado += contratadoRef;
    bySupplier[sKey].pagado     += pagado;
  }

  return {
    totales: { contratado: totalContratado, pagado: totalPagado, pendiente: totalContratado - totalPagado },
    indicadores: { activos, completados, sobregirados },
    porProyecto:  Object.values(byProject).map(p => ({ ...p, pendiente: p.contratado - p.pagado })),
    porSuplidor:  Object.values(bySupplier).map(s => ({ ...s, pendiente: s.contratado - s.pagado })),
  };
}

export async function getAvailableExpenses(contratoId: string) {
  const contrato = await prisma.contratoAjustado.findUnique({ where: { id: contratoId } });
  if (!contrato) throw new AppError(404, 'Contrato no encontrado', 'NOT_FOUND');

  return prisma.expense.findMany({
    where: {
      projectId:           contrato.projectId,
      contratoAjustadoId:  null,
      status:              { not: 'VOIDED' },
    },
    select: {
      id: true, amount: true, expenseDate: true, description: true, status: true,
      category: { select: { name: true } },
      registeredBy: { select: { name: true } },
    },
    orderBy: { expenseDate: 'desc' },
    take: 100,
  });
}

export async function createAdenda(
  contratoId: string,
  data: { monto: number; descripcion: string; fecha: string },
  userId: string,
) {
  const contrato = await prisma.contratoAjustado.findUnique({ where: { id: contratoId } });
  if (!contrato) throw new AppError(404, 'Contrato no encontrado', 'NOT_FOUND');
  if (contrato.estado === 'CANCELADO') throw new AppError(400, 'No se puede agregar adenda a un contrato cancelado', 'CONTRACT_CANCELLED');

  const last = await prisma.contratoAjustadoAdenda.findFirst({
    where:   { contratoAjustadoId: contratoId },
    orderBy: { number: 'desc' },
  });

  await prisma.contratoAjustadoAdenda.create({
    data: {
      contratoAjustadoId: contratoId,
      number:      (last?.number ?? 0) + 1,
      monto:       data.monto,
      descripcion: data.descripcion,
      fecha:       new Date(data.fecha),
      createdById: userId,
    },
  });
  return getContratoById(contratoId);
}

export async function deleteAdenda(contratoId: string, adendaId: string) {
  const adenda = await prisma.contratoAjustadoAdenda.findFirst({
    where: { id: adendaId, contratoAjustadoId: contratoId },
  });
  if (!adenda) throw new AppError(404, 'Adenda no encontrada', 'NOT_FOUND');
  await prisma.contratoAjustadoAdenda.delete({ where: { id: adendaId } });
  return getContratoById(contratoId);
}
