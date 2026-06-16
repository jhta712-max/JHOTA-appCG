import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { buildPaginatedResponse } from '../../utils/pagination';
import type {
  CreateEmployeeInput, UpdateEmployeeInput,
  ListEmployeesInput, CreateBenefitInput, UpdateBenefitInput,
} from './admin-employees.schema';

const EMPLOYEE_INCLUDE = {
  createdBy:    { select: { id: true, name: true } },
  benefits:     { where: { isActive: true }, orderBy: { createdAt: 'asc' as const } },
  salaryHistory: { orderBy: { effectiveFrom: 'desc' as const }, take: 20 },
} as const;

export async function listEmployees(query: ListEmployeesInput) {
  const where: any = { deletedAt: null };
  if (query.status)    where.status = query.status;
  if (query.frequency) where.paymentFrequency = query.frequency;

  const [data, total] = await Promise.all([
    prisma.administrativeEmployee.findMany({
      where,
      include: { benefits: { where: { isActive: true } } },
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.administrativeEmployee.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, { page: query.page, limit: query.limit, skip: (query.page - 1) * query.limit });
}

export async function getEmployeeById(id: string) {
  const emp = await prisma.administrativeEmployee.findFirst({
    where: { id, deletedAt: null },
    include: EMPLOYEE_INCLUDE,
  });
  if (!emp) throw new AppError(404, 'Empleado no encontrado', 'NOT_FOUND');
  return emp;
}

export async function createEmployee(data: CreateEmployeeInput, userId: string) {
  return prisma.$transaction(async (tx) => {
    const emp = await tx.administrativeEmployee.create({
      data: {
        name:             data.name,
        position:         data.position,
        hireDate:         new Date(data.hireDate),
        paymentFrequency: data.paymentFrequency,
        baseSalary:       data.baseSalary,
        bankName:         data.bankName   ?? null,
        bankAccount:      data.bankAccount ?? null,
        notes:            data.notes      ?? null,
        createdById:      userId,
      },
    });

    await tx.administrativeEmployeeSalaryHistory.create({
      data: {
        employeeId:    emp.id,
        baseSalary:    data.baseSalary,
        effectiveFrom: new Date(data.hireDate),
        createdById:   userId,
      },
    });

    return tx.administrativeEmployee.findUnique({
      where: { id: emp.id },
      include: EMPLOYEE_INCLUDE,
    });
  });
}

export async function updateEmployee(id: string, data: UpdateEmployeeInput, userId: string) {
  const emp = await prisma.administrativeEmployee.findFirst({ where: { id, deletedAt: null } });
  if (!emp) throw new AppError(404, 'Empleado no encontrado', 'NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    // Si cambia salario → crear registro en historial
    if (data.baseSalary !== undefined && Number(data.baseSalary) !== Number(emp.baseSalary)) {
      await tx.administrativeEmployeeSalaryHistory.create({
        data: {
          employeeId:    id,
          baseSalary:    data.baseSalary,
          effectiveFrom: new Date(),
          createdById:   userId,
        },
      });
    }

    return tx.administrativeEmployee.update({
      where: { id },
      data: {
        ...(data.name             !== undefined && { name:             data.name }),
        ...(data.position         !== undefined && { position:         data.position }),
        ...(data.hireDate         !== undefined && { hireDate:         new Date(data.hireDate) }),
        ...(data.paymentFrequency !== undefined && { paymentFrequency: data.paymentFrequency }),
        ...(data.baseSalary       !== undefined && { baseSalary:       data.baseSalary }),
        ...(data.bankName         !== undefined && { bankName:         data.bankName }),
        ...(data.bankAccount      !== undefined && { bankAccount:      data.bankAccount }),
        ...(data.notes            !== undefined && { notes:            data.notes }),
      },
      include: EMPLOYEE_INCLUDE,
    });
  });
}

export async function deleteEmployee(id: string) {
  const emp = await prisma.administrativeEmployee.findFirst({ where: { id, deletedAt: null } });
  if (!emp) throw new AppError(404, 'Empleado no encontrado', 'NOT_FOUND');
  return prisma.administrativeEmployee.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'RETIRED' },
  });
}

// ─── Benefits ────────────────────────────────────────────────

export async function addBenefit(employeeId: string, data: CreateBenefitInput) {
  const emp = await prisma.administrativeEmployee.findFirst({ where: { id: employeeId, deletedAt: null } });
  if (!emp) throw new AppError(404, 'Empleado no encontrado', 'NOT_FOUND');
  return prisma.administrativeEmployeeBenefit.create({
    data: { employeeId, name: data.name, amount: data.amount, affectsISR: data.affectsISR, isActive: data.isActive },
  });
}

export async function updateBenefit(employeeId: string, benefitId: string, data: UpdateBenefitInput) {
  const benefit = await prisma.administrativeEmployeeBenefit.findFirst({
    where: { id: benefitId, employeeId },
  });
  if (!benefit) throw new AppError(404, 'Beneficio no encontrado', 'NOT_FOUND');
  return prisma.administrativeEmployeeBenefit.update({
    where: { id: benefitId },
    data: {
      ...(data.name       !== undefined && { name:       data.name }),
      ...(data.amount     !== undefined && { amount:     data.amount }),
      ...(data.affectsISR !== undefined && { affectsISR: data.affectsISR }),
      ...(data.isActive   !== undefined && { isActive:   data.isActive }),
    },
  });
}

export async function deleteBenefit(employeeId: string, benefitId: string) {
  const benefit = await prisma.administrativeEmployeeBenefit.findFirst({
    where: { id: benefitId, employeeId },
  });
  if (!benefit) throw new AppError(404, 'Beneficio no encontrado', 'NOT_FOUND');
  return prisma.administrativeEmployeeBenefit.delete({ where: { id: benefitId } });
}
