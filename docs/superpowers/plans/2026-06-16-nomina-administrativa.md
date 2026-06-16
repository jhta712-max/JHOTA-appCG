# Nómina Administrativa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo completo de nómina administrativa independiente de proyectos, con empleados, beneficios, cálculo automático AFP/TSS/ISR, flujo DRAFT→APPROVED→PAID y exportación Excel.

**Architecture:** 5 modelos Prisma nuevos en una sola migración. Backend en `modules/admin-employees/` y `modules/admin-payrolls/`. Frontend 5 páginas lazy-loaded bajo `/admin-payroll`. No toca módulos existentes excepto `app.ts`, `Layout.tsx` y `main.tsx`.

**Tech Stack:** Prisma ORM, Express + TypeScript + Zod, React 18 + TanStack Query, ExcelJS, design system #1C1C1C/#F5C218.

---

### Task 1: Prisma Schema + Migración

**Files:**
- Modify: `apps/backend/prisma/schema.prisma` (append al final)

- [ ] **Step 1: Agregar enums y modelos al schema**

Append al final de `apps/backend/prisma/schema.prisma`:

```prisma
// ─── Nómina Administrativa ────────────────────────────────────

enum AdminPayrollStatus {
  DRAFT
  APPROVED
  PAID
  VOIDED
  @@map("admin_payroll_status")
}

enum AdminPaymentFrequency {
  MONTHLY
  BIWEEKLY
  @@map("admin_payment_frequency")
}

enum AdminPeriodType {
  MONTHLY
  BIWEEKLY_1
  BIWEEKLY_2
  @@map("admin_period_type")
}

enum AdminEmployeeStatus {
  ACTIVE
  SUSPENDED
  RETIRED
  @@map("admin_employee_status")
}

model AdministrativeEmployee {
  id               String                @id @default(uuid()) @db.Uuid
  name             String                @db.VarChar(200)
  position         String                @db.VarChar(100)
  hireDate         DateTime              @map("hire_date") @db.Date
  paymentFrequency AdminPaymentFrequency @map("payment_frequency")
  baseSalary       Decimal               @map("base_salary") @db.Decimal(15, 2)
  status           AdminEmployeeStatus   @default(ACTIVE)
  bankName         String?               @map("bank_name") @db.VarChar(100)
  bankAccount      String?               @map("bank_account") @db.VarChar(50)
  notes            String?               @db.Text
  createdById      String                @map("created_by") @db.Uuid
  createdAt        DateTime              @default(now()) @map("created_at")
  updatedAt        DateTime              @updatedAt @map("updated_at")
  deletedAt        DateTime?             @map("deleted_at")

  createdBy     User                                  @relation("AdminEmployeeCreatedBy", fields: [createdById], references: [id])
  salaryHistory AdministrativeEmployeeSalaryHistory[]
  benefits      AdministrativeEmployeeBenefit[]
  payrollLines  AdministrativePayrollLine[]

  @@index([status])
  @@index([paymentFrequency])
  @@map("administrative_employees")
}

model AdministrativeEmployeeSalaryHistory {
  id            String   @id @default(uuid()) @db.Uuid
  employeeId    String   @map("employee_id") @db.Uuid
  baseSalary    Decimal  @map("base_salary") @db.Decimal(15, 2)
  effectiveFrom DateTime @map("effective_from") @db.Date
  createdById   String   @map("created_by") @db.Uuid
  createdAt     DateTime @default(now()) @map("created_at")

  employee  AdministrativeEmployee @relation(fields: [employeeId], references: [id])
  createdBy User                   @relation("AdminSalaryHistoryCreatedBy", fields: [createdById], references: [id])

  @@index([employeeId])
  @@index([effectiveFrom])
  @@map("administrative_employee_salary_history")
}

model AdministrativeEmployeeBenefit {
  id         String   @id @default(uuid()) @db.Uuid
  employeeId String   @map("employee_id") @db.Uuid
  name       String   @db.VarChar(100)
  amount     Decimal  @db.Decimal(15, 2)
  affectsISR Boolean  @default(true) @map("affects_isr")
  isActive   Boolean  @default(true) @map("is_active")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  employee AdministrativeEmployee @relation(fields: [employeeId], references: [id])

  @@index([employeeId])
  @@index([isActive])
  @@map("administrative_employee_benefits")
}

model AdministrativePayroll {
  id               String             @id @default(uuid()) @db.Uuid
  number           Int
  periodType       AdminPeriodType    @map("period_type")
  periodStart      DateTime           @map("period_start") @db.Date
  periodEnd        DateTime           @map("period_end") @db.Date
  status           AdminPayrollStatus @default(DRAFT)
  totalGross       Decimal            @default(0) @map("total_gross") @db.Decimal(15, 2)
  totalDeductions  Decimal            @default(0) @map("total_deductions") @db.Decimal(15, 2)
  totalNet         Decimal            @default(0) @map("total_net") @db.Decimal(15, 2)
  notes            String?            @db.Text
  paymentMethod    String?            @map("payment_method") @db.VarChar(20)
  paymentDate      DateTime?          @map("payment_date") @db.Date
  paymentBank      String?            @map("payment_bank") @db.VarChar(100)
  paymentReference String?            @map("payment_reference") @db.VarChar(100)
  createdById      String             @map("created_by") @db.Uuid
  approvedById     String?            @map("approved_by") @db.Uuid
  approvedAt       DateTime?          @map("approved_at")
  paidAt           DateTime?          @map("paid_at")
  voidedById       String?            @map("voided_by") @db.Uuid
  voidedAt         DateTime?          @map("voided_at")
  voidReason       String?            @map("void_reason") @db.Text
  createdAt        DateTime           @default(now()) @map("created_at")
  updatedAt        DateTime           @updatedAt @map("updated_at")

  createdBy  User                        @relation("AdminPayrollCreatedBy", fields: [createdById], references: [id])
  approvedBy User?                       @relation("AdminPayrollApprovedBy", fields: [approvedById], references: [id])
  voidedBy   User?                       @relation("AdminPayrollVoidedBy", fields: [voidedById], references: [id])
  lines      AdministrativePayrollLine[]

  @@unique([number])
  @@index([status])
  @@index([periodType])
  @@index([periodStart])
  @@map("administrative_payrolls")
}

model AdministrativePayrollLine {
  id                  String   @id @default(uuid()) @db.Uuid
  payrollId           String   @map("payroll_id") @db.Uuid
  employeeId          String   @map("employee_id") @db.Uuid
  lineNumber          Int      @map("line_number")
  baseSalary          Decimal  @map("base_salary") @db.Decimal(15, 2)
  benefitsTotal       Decimal  @default(0) @map("benefits_total") @db.Decimal(15, 2)
  benefitsSnapshot    Json     @default("[]") @map("benefits_snapshot")
  taxableBase         Decimal  @map("taxable_base") @db.Decimal(15, 2)
  afpEmployee         Decimal  @map("afp_employee") @db.Decimal(15, 2)
  tssEmployee         Decimal  @map("tss_employee") @db.Decimal(15, 2)
  isr                 Decimal  @default(0) @db.Decimal(15, 2)
  otherDeductions     Decimal  @default(0) @map("other_deductions") @db.Decimal(15, 2)
  otherDeductionsNote String?  @map("other_deductions_note") @db.VarChar(300)
  grossAmount         Decimal  @map("gross_amount") @db.Decimal(15, 2)
  netAmount           Decimal  @map("net_amount") @db.Decimal(15, 2)
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  payroll  AdministrativePayroll  @relation(fields: [payrollId], references: [id], onDelete: Cascade)
  employee AdministrativeEmployee @relation(fields: [employeeId], references: [id])

  @@unique([payrollId, employeeId])
  @@unique([payrollId, lineNumber])
  @@index([payrollId])
  @@index([employeeId])
  @@map("administrative_payroll_lines")
}
```

- [ ] **Step 2: Regenerar Prisma client**

```bash
cd /home/user/servingmi-appCG
pnpm --filter backend db:generate
```

Expected: `Generated Prisma Client` sin errores.

- [ ] **Step 3: Verificar build backend compila**

```bash
pnpm build:backend 2>&1 | tail -5
```

Expected: `Found 0 errors.`

- [ ] **Step 4: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat(schema): agregar modelos nómina administrativa"
```

---

### Task 2: Cálculos AFP/TSS/ISR (con tests)

**Files:**
- Create: `apps/backend/src/modules/admin-payrolls/admin-payroll.calculations.ts`
- Create: `apps/backend/src/modules/admin-payrolls/__tests__/admin-payroll.calculations.test.ts`

- [ ] **Step 1: Escribir test**

Crear `apps/backend/src/modules/admin-payrolls/__tests__/admin-payroll.calculations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateLine } from '../admin-payroll.calculations';

describe('calculateLine', () => {
  it('calcula AFP y TSS sobre salario base solamente', () => {
    const result = calculateLine(
      50_000,
      [{ name: 'Vehículo', amount: 10_000, affectsISR: false }],
      'MONTHLY',
    );
    expect(result.afpEmployee).toBe(1435);   // 50000 * 0.0287
    expect(result.tssEmployee).toBe(1520);   // 50000 * 0.0304
    expect(result.benefitsTotal).toBe(10_000);
    expect(result.grossAmount).toBe(60_000);
  });

  it('taxableBase incluye solo beneficios con affectsISR=true', () => {
    const result = calculateLine(
      50_000,
      [
        { name: 'Vehículo',  amount: 5_000, affectsISR: false },
        { name: 'Comisión',  amount: 3_000, affectsISR: true  },
      ],
      'MONTHLY',
    );
    expect(result.taxableBase).toBe(53_000); // 50000 + 3000
    expect(result.benefitsTotal).toBe(8_000);
  });

  it('salario bajo el mínimo exento tiene ISR = 0', () => {
    // 30000/mes * 12 = 360000/año < 416220 → ISR 0
    const result = calculateLine(30_000, [], 'MONTHLY');
    expect(result.isr).toBe(0);
  });

  it('salario en segundo tramo tiene ISR correcto', () => {
    // 40000/mes * 12 = 480000/año
    // Tramo: 480000 - 416220 = 63780 * 0.15 = 9567/año → 797.25/mes
    const result = calculateLine(40_000, [], 'MONTHLY');
    expect(result.isr).toBe(797.25);
  });

  it('quincena divide ISR anual entre 24', () => {
    const monthly = calculateLine(40_000, [], 'MONTHLY');
    const biweekly = calculateLine(20_000, [], 'BIWEEKLY_1');
    // Ingreso anual quincena: 20000 * 24 = 480000 → mismo tramo
    expect(biweekly.isr).toBeCloseTo(monthly.isr / 2, 1);
  });

  it('netAmount = gross - afp - tss - isr - otherDeductions', () => {
    const result = calculateLine(50_000, [], 'MONTHLY', 500);
    const expected = result.grossAmount - result.afpEmployee - result.tssEmployee - result.isr - 500;
    expect(result.netAmount).toBeCloseTo(expected, 2);
  });
});
```

- [ ] **Step 2: Verificar que el test falla**

```bash
pnpm --filter backend test -- --run src/modules/admin-payrolls/__tests__/admin-payroll.calculations.test.ts
```

Expected: FAIL — `Cannot find module '../admin-payroll.calculations'`

- [ ] **Step 3: Implementar cálculos**

Crear `apps/backend/src/modules/admin-payrolls/admin-payroll.calculations.ts`:

```typescript
const AFP_RATE = 0.0287;
const TSS_RATE = 0.0304;

// Tramos ISR RD 2024 — ingresos anuales en RD$
const ISR_BRACKETS = [
  { upTo: 416_220,  rate: 0,    base: 0 },
  { upTo: 624_329,  rate: 0.15, base: 0 },
  { upTo: 867_123,  rate: 0.20, base: 31_216.35 },
  { upTo: Infinity, rate: 0.25, base: 79_775.85 },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function calculateISR(annualIncome: number): number {
  for (let i = ISR_BRACKETS.length - 1; i >= 0; i--) {
    const prev = i > 0 ? ISR_BRACKETS[i - 1].upTo : 0;
    if (annualIncome > prev) {
      const bracket = ISR_BRACKETS[i];
      return round2(bracket.base + (annualIncome - prev) * bracket.rate);
    }
  }
  return 0;
}

export interface BenefitInput {
  name: string;
  amount: number;
  affectsISR: boolean;
}

export function calculateLine(
  baseSalary: number,
  benefits: BenefitInput[],
  periodType: 'MONTHLY' | 'BIWEEKLY_1' | 'BIWEEKLY_2',
  otherDeductions = 0,
) {
  const divisor = periodType === 'MONTHLY' ? 12 : 24;

  const benefitsTotal = round2(benefits.reduce((s, b) => s + b.amount, 0));
  const taxableBase   = round2(
    baseSalary + benefits.filter((b) => b.affectsISR).reduce((s, b) => s + b.amount, 0),
  );

  const annualTaxable = taxableBase * divisor;
  const annualISR     = calculateISR(annualTaxable);

  const afpEmployee = round2(baseSalary * AFP_RATE);
  const tssEmployee = round2(baseSalary * TSS_RATE);
  const isr         = round2(annualISR / divisor);
  const grossAmount = round2(baseSalary + benefitsTotal);
  const netAmount   = round2(grossAmount - afpEmployee - tssEmployee - isr - otherDeductions);

  return {
    benefitsTotal,
    taxableBase,
    afpEmployee,
    tssEmployee,
    isr,
    grossAmount,
    netAmount,
  };
}
```

- [ ] **Step 4: Verificar tests pasan**

```bash
pnpm --filter backend test -- --run src/modules/admin-payrolls/__tests__/admin-payroll.calculations.test.ts
```

Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/admin-payrolls/
git commit -m "feat(admin-payrolls): cálculos AFP/TSS/ISR con tests"
```

---

### Task 3: Backend — Empleados (schema + service + controller + router)

**Files:**
- Create: `apps/backend/src/modules/admin-employees/admin-employees.schema.ts`
- Create: `apps/backend/src/modules/admin-employees/admin-employees.service.ts`
- Create: `apps/backend/src/modules/admin-employees/admin-employees.controller.ts`
- Create: `apps/backend/src/modules/admin-employees/admin-employees.router.ts`

- [ ] **Step 1: Crear schema Zod**

Crear `apps/backend/src/modules/admin-employees/admin-employees.schema.ts`:

```typescript
import { z } from 'zod';

export const createEmployeeSchema = z.object({
  name:             z.string().min(2).max(200),
  position:         z.string().min(2).max(100),
  hireDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  paymentFrequency: z.enum(['MONTHLY', 'BIWEEKLY']),
  baseSalary:       z.coerce.number().positive(),
  bankName:         z.string().max(100).optional().nullable(),
  bankAccount:      z.string().max(50).optional().nullable(),
  notes:            z.string().max(1000).optional().nullable(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const listEmployeesSchema = z.object({
  status:    z.enum(['ACTIVE', 'SUSPENDED', 'RETIRED']).optional(),
  frequency: z.enum(['MONTHLY', 'BIWEEKLY']).optional(),
  page:      z.coerce.number().default(1),
  limit:     z.coerce.number().default(50),
});

export const createBenefitSchema = z.object({
  name:       z.string().min(2).max(100),
  amount:     z.coerce.number().positive(),
  affectsISR: z.boolean().default(true),
  isActive:   z.boolean().default(true),
});

export const updateBenefitSchema = createBenefitSchema.partial();

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesInput  = z.infer<typeof listEmployeesSchema>;
export type CreateBenefitInput  = z.infer<typeof createBenefitSchema>;
export type UpdateBenefitInput  = z.infer<typeof updateBenefitSchema>;
```

- [ ] **Step 2: Crear service**

Crear `apps/backend/src/modules/admin-employees/admin-employees.service.ts`:

```typescript
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

  return buildPaginatedResponse(data, total, query.page, query.limit);
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
```

- [ ] **Step 3: Crear controller**

Crear `apps/backend/src/modules/admin-employees/admin-employees.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import * as svc from './admin-employees.service';
import {
  createEmployeeSchema, updateEmployeeSchema, listEmployeesSchema,
  createBenefitSchema, updateBenefitSchema,
} from './admin-employees.schema';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const q = listEmployeesSchema.parse(req.query);
    res.json({ success: true, ...(await svc.listEmployees(q)) });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.getEmployeeById(req.params.id) });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data   = createEmployeeSchema.parse(req.body);
    const userId = (req as any).user.userId;
    res.status(201).json({ success: true, data: await svc.createEmployee(data, userId) });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const data   = updateEmployeeSchema.parse(req.body);
    const userId = (req as any).user.userId;
    res.json({ success: true, data: await svc.updateEmployee(req.params.id, data, userId) });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.deleteEmployee(req.params.id) });
  } catch (err) { next(err); }
}

export async function addBenefit(req: Request, res: Response, next: NextFunction) {
  try {
    const data = createBenefitSchema.parse(req.body);
    res.status(201).json({ success: true, data: await svc.addBenefit(req.params.id, data) });
  } catch (err) { next(err); }
}

export async function updateBenefit(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateBenefitSchema.parse(req.body);
    res.json({ success: true, data: await svc.updateBenefit(req.params.id, req.params.bId, data) });
  } catch (err) { next(err); }
}

export async function deleteBenefit(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.deleteBenefit(req.params.id, req.params.bId) });
  } catch (err) { next(err); }
}
```

- [ ] **Step 4: Crear router**

Crear `apps/backend/src/modules/admin-employees/admin-employees.router.ts`:

```typescript
import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import * as ctrl from './admin-employees.controller';

const router = Router();
router.use(authenticate);

router.get('/',    ctrl.list);
router.post('/',   authorize('admin', 'supervisor'), ctrl.create);
router.get('/:id', ctrl.getOne);
router.put('/:id', authorize('admin', 'supervisor'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

router.post('/:id/benefits',          authorize('admin', 'supervisor'), ctrl.addBenefit);
router.put('/:id/benefits/:bId',      authorize('admin', 'supervisor'), ctrl.updateBenefit);
router.delete('/:id/benefits/:bId',   authorize('admin', 'supervisor'), ctrl.deleteBenefit);

export default router;
```

- [ ] **Step 5: Registrar en app.ts**

En `apps/backend/src/app.ts`, agregar al bloque de imports:

```typescript
import adminEmployeesRouter from './modules/admin-employees/admin-employees.router';
```

Y en el bloque de rutas (después de la última línea `app.use`):

```typescript
app.use('/api/v1/admin-employees', apiLimiter, adminEmployeesRouter);
```

- [ ] **Step 6: Verificar build**

```bash
pnpm build:backend 2>&1 | tail -5
```

Expected: `Found 0 errors.`

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/admin-employees/ apps/backend/src/app.ts
git commit -m "feat(admin-employees): CRUD empleados con historial salarial y beneficios"
```

---

### Task 4: Backend — Nóminas (schema + service + router)

**Files:**
- Create: `apps/backend/src/modules/admin-payrolls/admin-payrolls.schema.ts`
- Create: `apps/backend/src/modules/admin-payrolls/admin-payrolls.service.ts`
- Create: `apps/backend/src/modules/admin-payrolls/admin-payrolls.controller.ts`
- Create: `apps/backend/src/modules/admin-payrolls/admin-payrolls.router.ts`

- [ ] **Step 1: Crear schema Zod**

Crear `apps/backend/src/modules/admin-payrolls/admin-payrolls.schema.ts`:

```typescript
import { z } from 'zod';

export const createPayrollSchema = z.object({
  periodType:  z.enum(['MONTHLY', 'BIWEEKLY_1', 'BIWEEKLY_2']),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:       z.string().max(1000).optional().nullable(),
});

export const listPayrollsSchema = z.object({
  status:     z.enum(['DRAFT', 'APPROVED', 'PAID', 'VOIDED']).optional(),
  periodType: z.enum(['MONTHLY', 'BIWEEKLY_1', 'BIWEEKLY_2']).optional(),
  year:       z.coerce.number().optional(),
  page:       z.coerce.number().default(1),
  limit:      z.coerce.number().default(20),
});

export const markPaidSchema = z.object({
  paymentMethod:    z.enum(['CASH', 'TRANSFER', 'CHECK']),
  paymentDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentBank:      z.string().max(100).optional().nullable(),
  paymentReference: z.string().max(100).optional().nullable(),
});

export const voidPayrollSchema = z.object({
  voidReason: z.string().min(5).max(500),
});

export const updateLineSchema = z.object({
  otherDeductions:     z.coerce.number().min(0),
  otherDeductionsNote: z.string().max(300).optional().nullable(),
});

export type CreatePayrollInput  = z.infer<typeof createPayrollSchema>;
export type ListPayrollsInput   = z.infer<typeof listPayrollsSchema>;
export type MarkPaidInput       = z.infer<typeof markPaidSchema>;
export type VoidPayrollInput    = z.infer<typeof voidPayrollSchema>;
export type UpdateLineInput     = z.infer<typeof updateLineSchema>;
```

- [ ] **Step 2: Crear service**

Crear `apps/backend/src/modules/admin-payrolls/admin-payrolls.service.ts`:

```typescript
import prisma from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { buildPaginatedResponse } from '../../utils/pagination';
import { calculateLine } from './admin-payroll.calculations';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import type {
  CreatePayrollInput, ListPayrollsInput,
  MarkPaidInput, VoidPayrollInput, UpdateLineInput,
} from './admin-payrolls.schema';

const PAYROLL_INCLUDE = {
  createdBy:  { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  voidedBy:   { select: { id: true, name: true } },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: { employee: { select: { id: true, name: true, position: true, bankName: true, bankAccount: true } } },
  },
} as const;

function periodTypeToFrequency(pt: string): 'MONTHLY' | 'BIWEEKLY' {
  return pt === 'MONTHLY' ? 'MONTHLY' : 'BIWEEKLY';
}

export async function listPayrolls(query: ListPayrollsInput) {
  const where: any = {};
  if (query.status)     where.status     = query.status;
  if (query.periodType) where.periodType = query.periodType;
  if (query.year) {
    where.periodStart = {
      gte: new Date(`${query.year}-01-01`),
      lte: new Date(`${query.year}-12-31`),
    };
  }

  const [data, total] = await Promise.all([
    prisma.administrativePayroll.findMany({
      where,
      include: {
        createdBy:  { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.administrativePayroll.count({ where }),
  ]);

  return buildPaginatedResponse(data, total, query.page, query.limit);
}

export async function getPayrollById(id: string) {
  const p = await prisma.administrativePayroll.findUnique({ where: { id }, include: PAYROLL_INCLUDE });
  if (!p) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  return p;
}

export async function createPayroll(data: CreatePayrollInput, userId: string) {
  const frequency = periodTypeToFrequency(data.periodType);

  const employees = await prisma.administrativeEmployee.findMany({
    where: { status: 'ACTIVE', paymentFrequency: frequency, deletedAt: null },
    include: { benefits: { where: { isActive: true } } },
    orderBy: { name: 'asc' },
  });

  if (employees.length === 0) {
    throw new AppError(400, `No hay empleados activos con frecuencia ${frequency}`, 'NO_EMPLOYEES');
  }

  return prisma.$transaction(async (tx) => {
    const maxNum = await tx.administrativePayroll.aggregate({ _max: { number: true } });
    const number = (maxNum._max.number ?? 0) + 1;

    const payroll = await tx.administrativePayroll.create({
      data: {
        number,
        periodType:  data.periodType,
        periodStart: new Date(data.periodStart),
        periodEnd:   new Date(data.periodEnd),
        notes:       data.notes ?? null,
        createdById: userId,
      },
    });

    let totalGross = 0, totalDeductions = 0, totalNet = 0;

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const benefits = emp.benefits.map((b) => ({
        name:       b.name,
        amount:     Number(b.amount),
        affectsISR: b.affectsISR,
      }));

      const calc = calculateLine(Number(emp.baseSalary), benefits, data.periodType as any);

      await tx.administrativePayrollLine.create({
        data: {
          payrollId:        payroll.id,
          employeeId:       emp.id,
          lineNumber:       i + 1,
          baseSalary:       emp.baseSalary,
          benefitsTotal:    calc.benefitsTotal,
          benefitsSnapshot: benefits,
          taxableBase:      calc.taxableBase,
          afpEmployee:      calc.afpEmployee,
          tssEmployee:      calc.tssEmployee,
          isr:              calc.isr,
          otherDeductions:  0,
          grossAmount:      calc.grossAmount,
          netAmount:        calc.netAmount,
        },
      });

      totalGross      += calc.grossAmount;
      totalDeductions += calc.afpEmployee + calc.tssEmployee + calc.isr;
      totalNet        += calc.netAmount;
    }

    return tx.administrativePayroll.update({
      where: { id: payroll.id },
      data: {
        totalGross:      Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalNet:        Math.round(totalNet * 100) / 100,
      },
      include: PAYROLL_INCLUDE,
    });
  });
}

export async function updateLine(payrollId: string, lineId: string, data: UpdateLineInput) {
  const payroll = await prisma.administrativePayroll.findUnique({ where: { id: payrollId } });
  if (!payroll) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (payroll.status !== 'DRAFT') throw new AppError(400, 'Solo se editan líneas en borrador', 'INVALID_STATUS');

  const line = await prisma.administrativePayrollLine.findFirst({
    where: { id: lineId, payrollId },
  });
  if (!line) throw new AppError(404, 'Línea no encontrada', 'NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    const gross = Number(line.grossAmount);
    const afp   = Number(line.afpEmployee);
    const tss   = Number(line.tssEmployee);
    const isr   = Number(line.isr);
    const newNet = Math.round((gross - afp - tss - isr - data.otherDeductions) * 100) / 100;

    await tx.administrativePayrollLine.update({
      where: { id: lineId },
      data: {
        otherDeductions:     data.otherDeductions,
        otherDeductionsNote: data.otherDeductionsNote ?? null,
        netAmount:           newNet,
      },
    });

    // Recalcular totales del header
    const lines = await tx.administrativePayrollLine.findMany({ where: { payrollId } });
    const totalGross      = lines.reduce((s, l) => s + Number(l.grossAmount), 0);
    const totalDeductions = lines.reduce((s, l) => s + Number(l.afpEmployee) + Number(l.tssEmployee) + Number(l.isr) + Number(l.otherDeductions), 0);
    const totalNet        = lines.reduce((s, l) => s + Number(l.netAmount), 0);

    return tx.administrativePayroll.update({
      where: { id: payrollId },
      data: {
        totalGross:      Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalNet:        Math.round(totalNet * 100) / 100,
      },
      include: PAYROLL_INCLUDE,
    });
  });
}

export async function approvePayroll(id: string, userId: string) {
  const p = await prisma.administrativePayroll.findUnique({ where: { id } });
  if (!p) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (p.status !== 'DRAFT') throw new AppError(400, 'Solo se aprueban nóminas en borrador', 'INVALID_STATUS');

  return prisma.administrativePayroll.update({
    where: { id },
    data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() },
    include: PAYROLL_INCLUDE,
  });
}

export async function markPayrollPaid(id: string, data: MarkPaidInput) {
  const p = await prisma.administrativePayroll.findUnique({ where: { id } });
  if (!p) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (p.status !== 'APPROVED') throw new AppError(400, 'Solo se pagan nóminas aprobadas', 'INVALID_STATUS');

  return prisma.administrativePayroll.update({
    where: { id },
    data: {
      status:          'PAID',
      paidAt:          new Date(),
      paymentMethod:   data.paymentMethod,
      paymentDate:     new Date(data.paymentDate),
      paymentBank:     data.paymentBank     ?? null,
      paymentReference: data.paymentReference ?? null,
    },
    include: PAYROLL_INCLUDE,
  });
}

export async function voidPayroll(id: string, data: VoidPayrollInput, userId: string) {
  const p = await prisma.administrativePayroll.findUnique({ where: { id } });
  if (!p) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');
  if (p.status === 'VOIDED') throw new AppError(400, 'La nómina ya está anulada', 'ALREADY_VOIDED');

  return prisma.administrativePayroll.update({
    where: { id },
    data: { status: 'VOIDED', voidReason: data.voidReason, voidedById: userId, voidedAt: new Date() },
    include: PAYROLL_INCLUDE,
  });
}

export async function exportExcel(id: string, res: Response) {
  const p = await prisma.administrativePayroll.findUnique({ where: { id }, include: PAYROLL_INCLUDE });
  if (!p) throw new AppError(404, 'Nómina no encontrada', 'NOT_FOUND');

  const wb = new ExcelJS.Workbook();

  // ── Hoja 1: Resumen ──────────────────────────────────────────
  const ws1 = wb.addWorksheet('Resumen');
  ws1.addRow(['SERVINGMI — NÓMINA ADMINISTRATIVA']);
  ws1.getRow(1).font = { bold: true, size: 14 };
  ws1.addRow([]);
  ws1.addRow(['Número', `NOM-ADMIN-${String(p.number).padStart(3, '0')}`]);
  ws1.addRow(['Período', `${p.periodStart.toISOString().slice(0,10)} al ${p.periodEnd.toISOString().slice(0,10)}`]);
  ws1.addRow(['Tipo', p.periodType]);
  ws1.addRow(['Estado', p.status]);
  ws1.addRow([]);
  ws1.addRow(['Total Bruto', Number(p.totalGross)]);
  ws1.addRow(['Total Deducciones', Number(p.totalDeductions)]);
  ws1.addRow(['Total Neto', Number(p.totalNet)]);
  ['H8', 'H9', 'H10'].forEach((ref) => { ws1.getCell(ref).numFmt = '#,##0.00'; });

  // ── Hoja 2: Detalle ──────────────────────────────────────────
  const ws2 = wb.addWorksheet('Detalle');
  const headers = ['#','Empleado','Cargo','Salario Base','Beneficios','Bruto','AFP','TSS','ISR','Otros Desc.','Neto','Banco','Cuenta'];
  ws2.addRow(headers);
  ws2.getRow(1).font = { bold: true };
  ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C1C1C' } };
  ws2.getRow(1).font = { bold: true, color: { argb: 'FFF5C218' } };

  for (const line of p.lines) {
    ws2.addRow([
      line.lineNumber,
      line.employee.name,
      line.employee.position,
      Number(line.baseSalary),
      Number(line.benefitsTotal),
      Number(line.grossAmount),
      Number(line.afpEmployee),
      Number(line.tssEmployee),
      Number(line.isr),
      Number(line.otherDeductions),
      Number(line.netAmount),
      line.employee.bankName  ?? '',
      line.employee.bankAccount ?? '',
    ]);
  }

  // Formato numérico columnas D-K
  ws2.columns.forEach((col, i) => {
    if (i >= 3 && i <= 10) col.numFmt = '#,##0.00';
    col.width = i === 1 ? 30 : i === 2 ? 20 : 15;
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="nomina-admin-${p.number}.xlsx"`);
  await wb.xlsx.write(res);
}
```

- [ ] **Step 3: Crear controller**

Crear `apps/backend/src/modules/admin-payrolls/admin-payrolls.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import * as svc from './admin-payrolls.service';
import {
  createPayrollSchema, listPayrollsSchema,
  markPaidSchema, voidPayrollSchema, updateLineSchema,
} from './admin-payrolls.schema';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const q = listPayrollsSchema.parse(req.query);
    res.json({ success: true, ...(await svc.listPayrolls(q)) });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await svc.getPayrollById(req.params.id) });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const data   = createPayrollSchema.parse(req.body);
    const userId = (req as any).user.userId;
    res.status(201).json({ success: true, data: await svc.createPayroll(data, userId) });
  } catch (err) { next(err); }
}

export async function updateLine(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateLineSchema.parse(req.body);
    res.json({ success: true, data: await svc.updateLine(req.params.id, req.params.lineId, data) });
  } catch (err) { next(err); }
}

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.userId;
    res.json({ success: true, data: await svc.approvePayroll(req.params.id, userId) });
  } catch (err) { next(err); }
}

export async function pay(req: Request, res: Response, next: NextFunction) {
  try {
    const data = markPaidSchema.parse(req.body);
    res.json({ success: true, data: await svc.markPayrollPaid(req.params.id, data) });
  } catch (err) { next(err); }
}

export async function voidOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data   = voidPayrollSchema.parse(req.body);
    const userId = (req as any).user.userId;
    res.json({ success: true, data: await svc.voidPayroll(req.params.id, data, userId) });
  } catch (err) { next(err); }
}

export async function exportExcel(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.exportExcel(req.params.id, res);
  } catch (err) { next(err); }
}
```

- [ ] **Step 4: Crear router**

Crear `apps/backend/src/modules/admin-payrolls/admin-payrolls.router.ts`:

```typescript
import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize }    from '../../middlewares/authorize';
import * as ctrl from './admin-payrolls.controller';

const router = Router();
router.use(authenticate);

router.get('/',    ctrl.list);
router.post('/',   authorize('admin', 'supervisor'), ctrl.create);
router.get('/:id', ctrl.getOne);

router.patch('/:id/lines/:lineId', authorize('admin', 'supervisor'), ctrl.updateLine);
router.post('/:id/approve',        authorize('admin', 'supervisor'), ctrl.approve);
router.post('/:id/pay',            authorize('admin', 'supervisor'), ctrl.pay);
router.post('/:id/void',           authorize('admin'),               ctrl.voidOne);

router.get('/:id/export.xlsx', authorize('admin', 'supervisor', 'financiero'), ctrl.exportExcel);

export default router;
```

- [ ] **Step 5: Registrar en app.ts**

En `apps/backend/src/app.ts`, agregar:

```typescript
import adminPayrollsRouter  from './modules/admin-payrolls/admin-payrolls.router';
```

```typescript
app.use('/api/v1/admin-payrolls',  apiLimiter, adminPayrollsRouter);
```

- [ ] **Step 6: Verificar build**

```bash
pnpm build:backend 2>&1 | tail -5
```

Expected: `Found 0 errors.`

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/admin-payrolls/ apps/backend/src/app.ts
git commit -m "feat(admin-payrolls): CRUD nóminas con cálculos automáticos, flujo y Excel"
```

---

### Task 5: Frontend — API types + client

**Files:**
- Modify: `apps/frontend/src/api/index.ts`

- [ ] **Step 1: Agregar tipos e interfaces**

Al final del archivo `apps/frontend/src/api/index.ts`, antes del último `export`, agregar:

```typescript
// ─── Nómina Administrativa ────────────────────────────────────

export interface AdminEmployeeBenefit {
  id:         string;
  employeeId: string;
  name:       string;
  amount:     number;
  affectsISR: boolean;
  isActive:   boolean;
  createdAt:  string;
  updatedAt:  string;
}

export interface AdminEmployeeSalaryHistory {
  id:           string;
  employeeId:   string;
  baseSalary:   number;
  effectiveFrom: string;
  createdAt:    string;
}

export interface AdminEmployee {
  id:               string;
  name:             string;
  position:         string;
  hireDate:         string;
  paymentFrequency: 'MONTHLY' | 'BIWEEKLY';
  baseSalary:       number;
  status:           'ACTIVE' | 'SUSPENDED' | 'RETIRED';
  bankName:         string | null;
  bankAccount:      string | null;
  notes:            string | null;
  createdAt:        string;
  updatedAt:        string;
  createdBy?:       { id: string; name: string };
  benefits?:        AdminEmployeeBenefit[];
  salaryHistory?:   AdminEmployeeSalaryHistory[];
}

export interface AdminPayrollLine {
  id:                  string;
  payrollId:           string;
  employeeId:          string;
  lineNumber:          number;
  baseSalary:          number;
  benefitsTotal:       number;
  benefitsSnapshot:    { name: string; amount: number; affectsISR: boolean }[];
  taxableBase:         number;
  afpEmployee:         number;
  tssEmployee:         number;
  isr:                 number;
  otherDeductions:     number;
  otherDeductionsNote: string | null;
  grossAmount:         number;
  netAmount:           number;
  createdAt:           string;
  updatedAt:           string;
  employee?: { id: string; name: string; position: string; bankName: string | null; bankAccount: string | null };
}

export interface AdminPayroll {
  id:              string;
  number:          number;
  periodType:      'MONTHLY' | 'BIWEEKLY_1' | 'BIWEEKLY_2';
  periodStart:     string;
  periodEnd:       string;
  status:          'DRAFT' | 'APPROVED' | 'PAID' | 'VOIDED';
  totalGross:      number;
  totalDeductions: number;
  totalNet:        number;
  notes:           string | null;
  paymentMethod:   string | null;
  paymentDate:     string | null;
  paymentBank:     string | null;
  paymentReference: string | null;
  paidAt:          string | null;
  approvedAt:      string | null;
  voidedAt:        string | null;
  voidReason:      string | null;
  createdAt:       string;
  updatedAt:       string;
  createdBy?:      { id: string; name: string };
  approvedBy?:     { id: string; name: string } | null;
  voidedBy?:       { id: string; name: string } | null;
  lines?:          AdminPayrollLine[];
  _count?:         { lines: number };
}

type AdminPaginated<T> = { success: boolean; data: T[]; pagination: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } };

export const adminEmployeesApi = {
  list:   (params?: Record<string, unknown>) =>
    api.get<AdminPaginated<AdminEmployee>>('/admin-employees', { params }),
  getById: (id: string) =>
    api.get<{ success: boolean; data: AdminEmployee }>(`/admin-employees/${id}`),
  create:  (data: unknown) =>
    api.post<{ success: boolean; data: AdminEmployee }>('/admin-employees', data),
  update:  (id: string, data: unknown) =>
    api.put<{ success: boolean; data: AdminEmployee }>(`/admin-employees/${id}`, data),
  delete:  (id: string) =>
    api.delete(`/admin-employees/${id}`),
  addBenefit:    (id: string, data: unknown) =>
    api.post<{ success: boolean; data: AdminEmployeeBenefit }>(`/admin-employees/${id}/benefits`, data),
  updateBenefit: (id: string, bId: string, data: unknown) =>
    api.put<{ success: boolean; data: AdminEmployeeBenefit }>(`/admin-employees/${id}/benefits/${bId}`, data),
  deleteBenefit: (id: string, bId: string) =>
    api.delete(`/admin-employees/${id}/benefits/${bId}`),
};

export const adminPayrollsApi = {
  list:   (params?: Record<string, unknown>) =>
    api.get<AdminPaginated<AdminPayroll>>('/admin-payrolls', { params }),
  getById: (id: string) =>
    api.get<{ success: boolean; data: AdminPayroll }>(`/admin-payrolls/${id}`),
  create:  (data: unknown) =>
    api.post<{ success: boolean; data: AdminPayroll }>('/admin-payrolls', data),
  updateLine: (id: string, lineId: string, data: unknown) =>
    api.patch<{ success: boolean; data: AdminPayroll }>(`/admin-payrolls/${id}/lines/${lineId}`, data),
  approve: (id: string) =>
    api.post<{ success: boolean; data: AdminPayroll }>(`/admin-payrolls/${id}/approve`),
  pay:     (id: string, data: unknown) =>
    api.post<{ success: boolean; data: AdminPayroll }>(`/admin-payrolls/${id}/pay`, data),
  void:    (id: string, voidReason: string) =>
    api.post<{ success: boolean; data: AdminPayroll }>(`/admin-payrolls/${id}/void`, { voidReason }),
  exportUrl: (id: string) => `/api/v1/admin-payrolls/${id}/export.xlsx`,
};
```

- [ ] **Step 2: Verificar build frontend**

```bash
pnpm build:frontend 2>&1 | tail -5
```

Expected: `✓ built`

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/api/index.ts
git commit -m "feat(frontend): tipos e API client nómina administrativa"
```

---

### Task 6: Frontend — Páginas Empleados

**Files:**
- Create: `apps/frontend/src/pages/admin-payroll/AdminEmployeesPage.tsx`
- Create: `apps/frontend/src/pages/admin-payroll/AdminEmployeeDetailPage.tsx`

- [ ] **Step 1: Crear AdminEmployeesPage.tsx**

Crear `apps/frontend/src/pages/admin-payroll/AdminEmployeesPage.tsx`:

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, User } from 'lucide-react';
import { adminEmployeesApi, type AdminEmployee } from '../../api/index';
import FormModal from '../../components/ui/FormModal';
import { useRole } from '../../hooks/useRole';

const FREQ_LABEL: Record<string, string> = { MONTHLY: 'Mensual', BIWEEKLY: 'Quincenal' };
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Activo', SUSPENDED: 'Suspendido', RETIRED: 'Retirado' };
const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-800',
  SUSPENDED: 'bg-yellow-100 text-yellow-800',
  RETIRED:   'bg-gray-100 text-gray-600',
};

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { minimumFractionDigits: 2 }).format(n);

export default function AdminEmployeesPage() {
  const qc = useQueryClient();
  const { isAdmin, isSupervisor } = useRole();
  const canEdit = isAdmin || isSupervisor;

  const [modal, setModal] = useState<{ open: boolean; data: Partial<AdminEmployee> | null }>({ open: false, data: null });

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-employees'],
    queryFn:  () => adminEmployeesApi.list({ limit: 100 }),
  });

  const employees = res?.data.data ?? [];

  const createMut = useMutation({
    mutationFn: (d: unknown) => adminEmployeesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-employees'] }); setModal({ open: false, data: null }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: unknown }) => adminEmployeesApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-employees'] }); setModal({ open: false, data: null }); },
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name:             fd.get('name'),
      position:         fd.get('position'),
      hireDate:         fd.get('hireDate'),
      paymentFrequency: fd.get('paymentFrequency'),
      baseSalary:       Number(fd.get('baseSalary')),
      bankName:         fd.get('bankName') || null,
      bankAccount:      fd.get('bankAccount') || null,
      notes:            fd.get('notes') || null,
    };
    if (modal.data?.id) {
      updateMut.mutate({ id: modal.data.id, d: body });
    } else {
      createMut.mutate(body);
    }
  };

  const inputCls = 'w-full border border-gray-200 px-3 py-2 text-sm font-[\'DM_Sans\'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[#1C1C1C] px-8 py-8">
        <p className="text-[#F5C218] text-xs font-bold uppercase tracking-[0.2em] font-['Barlow_Condensed'] mb-1">
          Nómina Administrativa
        </p>
        <div className="flex items-center justify-between">
          <h1 className="font-['Barlow_Condensed'] text-4xl font-bold text-white uppercase tracking-tight">
            Empleados
          </h1>
          {canEdit && (
            <button
              onClick={() => setModal({ open: true, data: {} })}
              className="flex items-center gap-2 bg-[#F5C218] text-[#1C1C1C] px-4 py-2 text-sm font-bold uppercase font-['Barlow_Condensed']"
            >
              <Plus size={16} /> Nuevo Empleado
            </button>
          )}
        </div>
      </div>

      <div className="px-8 py-6">
        {isLoading ? (
          <p className="text-sm text-gray-400 font-['DM_Sans']">Cargando...</p>
        ) : (
          <div className="bg-white border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1C1C1C]">
                  {['Empleado','Cargo','Frecuencia','Salario Base','Estado',''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-['DM_Sans'] font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        {emp.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-['DM_Sans'] text-gray-600">{emp.position}</td>
                    <td className="px-4 py-3 font-['DM_Sans'] text-gray-600">{FREQ_LABEL[emp.paymentFrequency]}</td>
                    <td className="px-4 py-3 font-['Space_Mono'] text-gray-900">RD$ {fmt(emp.baseSalary)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-bold uppercase ${STATUS_COLOR[emp.status]}`}>
                        {STATUS_LABEL[emp.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <Link to={`/admin-payroll/employees/${emp.id}`} className="text-xs text-[#1C1C1C] underline font-['DM_Sans']">
                          Ver detalle
                        </Link>
                        {canEdit && (
                          <button onClick={() => setModal({ open: true, data: emp })} className="text-xs text-gray-500 underline font-['DM_Sans']">
                            Editar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 font-['DM_Sans'] text-sm">No hay empleados registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && (
        <FormModal
          title={modal.data?.id ? 'Editar Empleado' : 'Nuevo Empleado'}
          onClose={() => setModal({ open: false, data: null })}
          onSubmit={onSubmit}
          isSubmitting={createMut.isPending || updateMut.isPending}
        >
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: 'name',     label: 'Nombre completo', defaultValue: modal.data?.name,     col: 2 },
              { name: 'position', label: 'Cargo',           defaultValue: modal.data?.position, col: 2 },
            ].map((f) => (
              <div key={f.name} className={`col-span-${f.col}`}>
                <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">{f.label}</label>
                <input name={f.name} defaultValue={f.defaultValue ?? ''} required className={inputCls} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Fecha de ingreso</label>
              <input name="hireDate" type="date" defaultValue={modal.data?.hireDate?.slice(0,10) ?? ''} required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Frecuencia de pago</label>
              <select name="paymentFrequency" defaultValue={modal.data?.paymentFrequency ?? 'MONTHLY'} className={inputCls}>
                <option value="MONTHLY">Mensual</option>
                <option value="BIWEEKLY">Quincenal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Salario base (RD$)</label>
              <input name="baseSalary" type="number" min="0" step="0.01" defaultValue={modal.data?.baseSalary ?? ''} required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Banco</label>
              <input name="bankName" defaultValue={modal.data?.bankName ?? ''} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Número de cuenta</label>
              <input name="bankAccount" defaultValue={modal.data?.bankAccount ?? ''} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Notas</label>
              <textarea name="notes" defaultValue={modal.data?.notes ?? ''} rows={2} className={inputCls} />
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crear AdminEmployeeDetailPage.tsx**

Crear `apps/frontend/src/pages/admin-payroll/AdminEmployeeDetailPage.tsx`:

```tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { adminEmployeesApi, type AdminEmployeeBenefit } from '../../api/index';
import FormModal from '../../components/ui/FormModal';
import { useRole } from '../../hooks/useRole';

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { minimumFractionDigits: 2 }).format(n);
const inputCls = "w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]";

export default function AdminEmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isSupervisor } = useRole();
  const canEdit = isAdmin || isSupervisor;

  const [benefitModal, setBenefitModal] = useState<{ open: boolean; data: Partial<AdminEmployeeBenefit> | null }>({ open: false, data: null });

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-employee', id],
    queryFn:  () => adminEmployeesApi.getById(id!),
  });

  const emp = res?.data.data;

  const addBenefitMut = useMutation({
    mutationFn: (d: unknown) => adminEmployeesApi.addBenefit(id!, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-employee', id] }); setBenefitModal({ open: false, data: null }); },
  });

  const deleteBenefitMut = useMutation({
    mutationFn: (bId: string) => adminEmployeesApi.deleteBenefit(id!, bId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-employee', id] }),
  });

  const onBenefitSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addBenefitMut.mutate({
      name:       fd.get('name'),
      amount:     Number(fd.get('amount')),
      affectsISR: fd.get('affectsISR') === 'true',
    });
  };

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">Cargando...</p></div>;
  if (!emp) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1C1C1C] px-8 py-8">
        <button onClick={() => navigate('/admin-payroll/employees')} className="flex items-center gap-1 text-[#F5C218] text-xs uppercase font-['Barlow_Condensed'] mb-3">
          <ChevronLeft size={14} /> Empleados
        </button>
        <h1 className="font-['Barlow_Condensed'] text-4xl font-bold text-white uppercase tracking-tight">{emp.name}</h1>
        <p className="text-gray-400 text-sm font-['DM_Sans'] mt-1">{emp.position}</p>
      </div>

      <div className="px-8 py-6 grid grid-cols-3 gap-6">
        {/* Datos del empleado */}
        <div className="col-span-1 bg-white border border-gray-200 p-6">
          <h2 className="font-['Barlow_Condensed'] text-sm font-bold uppercase text-gray-500 tracking-[0.1em] mb-4">Datos</h2>
          {[
            ['Salario base', `RD$ ${fmt(emp.baseSalary)}`],
            ['Frecuencia', emp.paymentFrequency === 'MONTHLY' ? 'Mensual' : 'Quincenal'],
            ['Ingreso', emp.hireDate.slice(0,10)],
            ['Estado', emp.status],
            ['Banco', emp.bankName ?? '—'],
            ['Cuenta', emp.bankAccount ?? '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-500 font-['DM_Sans']">{k}</span>
              <span className="text-xs font-bold text-gray-900 font-['Space_Mono']">{v}</span>
            </div>
          ))}
        </div>

        <div className="col-span-2 flex flex-col gap-6">
          {/* Beneficios */}
          <div className="bg-white border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-['Barlow_Condensed'] text-sm font-bold uppercase text-gray-500 tracking-[0.1em]">Beneficios Fijos</h2>
              {canEdit && (
                <button onClick={() => setBenefitModal({ open: true, data: {} })} className="flex items-center gap-1 text-xs bg-[#F5C218] text-[#1C1C1C] px-3 py-1 font-bold uppercase font-['Barlow_Condensed']">
                  <Plus size={12} /> Agregar
                </button>
              )}
            </div>
            {(emp.benefits ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 font-['DM_Sans']">Sin beneficios registrados</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1C1C1C]">
                    {['Concepto','Monto','Afecta ISR',''].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.1em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(emp.benefits ?? []).map((b) => (
                    <tr key={b.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-['DM_Sans']">{b.name}</td>
                      <td className="px-3 py-2 font-['Space_Mono']">RD$ {fmt(b.amount)}</td>
                      <td className="px-3 py-2 font-['DM_Sans'] text-xs">{b.affectsISR ? 'Sí' : 'No'}</td>
                      <td className="px-3 py-2">
                        {canEdit && (
                          <button onClick={() => deleteBenefitMut.mutate(b.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Historial salarial */}
          <div className="bg-white border border-gray-200 p-6">
            <h2 className="font-['Barlow_Condensed'] text-sm font-bold uppercase text-gray-500 tracking-[0.1em] mb-4">Historial Salarial</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1C1C1C]">
                  {['Salario base','Vigente desde'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.1em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(emp.salaryHistory ?? []).map((h) => (
                  <tr key={h.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-['Space_Mono']">RD$ {fmt(h.baseSalary)}</td>
                    <td className="px-3 py-2 font-['DM_Sans'] text-gray-600">{h.effectiveFrom.slice(0,10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {benefitModal.open && (
        <FormModal
          title="Agregar Beneficio"
          onClose={() => setBenefitModal({ open: false, data: null })}
          onSubmit={onBenefitSubmit}
          isSubmitting={addBenefitMut.isPending}
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Concepto</label>
              <input name="name" required className={inputCls} placeholder="Ej: Vehículo, Viáticos, Comunicaciones" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Monto mensual (RD$)</label>
              <input name="amount" type="number" min="0" step="0.01" required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">¿Afecta cálculo de ISR?</label>
              <select name="affectsISR" className={inputCls}>
                <option value="true">Sí (forma parte de la base imponible)</option>
                <option value="false">No (exento de ISR)</option>
              </select>
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar build**

```bash
pnpm build:frontend 2>&1 | grep -E "error|✓"
```

Expected: `✓ built`

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/pages/admin-payroll/
git commit -m "feat(frontend): páginas listado y detalle de empleados administrativos"
```

---

### Task 7: Frontend — Páginas Nóminas

**Files:**
- Create: `apps/frontend/src/pages/admin-payroll/AdminPayrollsPage.tsx`
- Create: `apps/frontend/src/pages/admin-payroll/AdminPayrollFormPage.tsx`
- Create: `apps/frontend/src/pages/admin-payroll/AdminPayrollDetailPage.tsx`

- [ ] **Step 1: Crear AdminPayrollsPage.tsx**

Crear `apps/frontend/src/pages/admin-payroll/AdminPayrollsPage.tsx`:

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Download } from 'lucide-react';
import { adminPayrollsApi, type AdminPayroll } from '../../api/index';
import { useRole } from '../../hooks/useRole';

const STATUS_LABEL: Record<string, string> = { DRAFT: 'Borrador', APPROVED: 'Aprobada', PAID: 'Pagada', VOIDED: 'Anulada' };
const STATUS_COLOR: Record<string, string> = {
  DRAFT:    'bg-gray-100 text-gray-600',
  APPROVED: 'bg-blue-100 text-blue-800',
  PAID:     'bg-green-100 text-green-800',
  VOIDED:   'bg-red-100 text-red-700',
};
const PERIOD_LABEL: Record<string, string> = { MONTHLY: 'Mensual', BIWEEKLY_1: 'Quincena 1', BIWEEKLY_2: 'Quincena 2' };

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { minimumFractionDigits: 2 }).format(n);

export default function AdminPayrollsPage() {
  const navigate = useNavigate();
  const { isAdmin, isSupervisor } = useRole();
  const canCreate = isAdmin || isSupervisor;

  const [year, setYear]     = useState(new Date().getFullYear());
  const [status, setStatus] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-payrolls', year, status],
    queryFn:  () => adminPayrollsApi.list({ year, status: status || undefined, limit: 50 }),
  });

  const payrolls: AdminPayroll[] = res?.data.data ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1C1C1C] px-8 py-8">
        <p className="text-[#F5C218] text-xs font-bold uppercase tracking-[0.2em] font-['Barlow_Condensed'] mb-1">
          Nómina Administrativa
        </p>
        <div className="flex items-center justify-between">
          <h1 className="font-['Barlow_Condensed'] text-4xl font-bold text-white uppercase tracking-tight">Períodos</h1>
          {canCreate && (
            <button onClick={() => navigate('/admin-payroll/new')} className="flex items-center gap-2 bg-[#F5C218] text-[#1C1C1C] px-4 py-2 text-sm font-bold uppercase font-['Barlow_Condensed']">
              <Plus size={16} /> Nuevo Período
            </button>
          )}
        </div>
      </div>

      <div className="px-8 py-4 flex gap-3">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-gray-200 px-3 py-1.5 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218]">
          {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-200 px-3 py-1.5 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218]">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="px-8 pb-8">
        {isLoading ? (
          <p className="text-sm text-gray-400 font-['DM_Sans']">Cargando...</p>
        ) : (
          <div className="bg-white border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1C1C1C]">
                  {['#','Tipo','Período','Empleados','Total Bruto','Total Neto','Estado',''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.15em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrolls.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-['Space_Mono'] text-gray-500 text-xs">NOM-ADM-{String(p.number).padStart(3,'0')}</td>
                    <td className="px-4 py-3 font-['DM_Sans'] text-gray-700">{PERIOD_LABEL[p.periodType]}</td>
                    <td className="px-4 py-3 font-['DM_Sans'] text-gray-600 text-xs">{p.periodStart.slice(0,10)} — {p.periodEnd.slice(0,10)}</td>
                    <td className="px-4 py-3 font-['Space_Mono'] text-gray-600 text-center">{p._count?.lines ?? 0}</td>
                    <td className="px-4 py-3 font-['Space_Mono'] text-gray-900">RD$ {fmt(p.totalGross)}</td>
                    <td className="px-4 py-3 font-['Space_Mono'] font-bold text-gray-900">RD$ {fmt(p.totalNet)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-bold uppercase ${STATUS_COLOR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <Link to={`/admin-payroll/${p.id}`} className="text-xs text-[#1C1C1C] underline font-['DM_Sans']">Ver</Link>
                        {p.status !== 'VOIDED' && (
                          <a href={adminPayrollsApi.exportUrl(p.id)} className="text-xs text-gray-500" title="Exportar Excel">
                            <Download size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {payrolls.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 font-['DM_Sans'] text-sm">No hay períodos registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear AdminPayrollFormPage.tsx**

Crear `apps/frontend/src/pages/admin-payroll/AdminPayrollFormPage.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { adminPayrollsApi } from '../../api/index';

const inputCls = "w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]";

export default function AdminPayrollFormPage() {
  const navigate = useNavigate();

  const createMut = useMutation({
    mutationFn: (d: unknown) => adminPayrollsApi.create(d),
    onSuccess:  (res) => navigate(`/admin-payroll/${res.data.data.id}`),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMut.mutate({
      periodType:  fd.get('periodType'),
      periodStart: fd.get('periodStart'),
      periodEnd:   fd.get('periodEnd'),
      notes:       fd.get('notes') || null,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1C1C1C] px-8 py-8">
        <button onClick={() => navigate('/admin-payroll')} className="flex items-center gap-1 text-[#F5C218] text-xs uppercase font-['Barlow_Condensed'] mb-3">
          <ChevronLeft size={14} /> Períodos
        </button>
        <h1 className="font-['Barlow_Condensed'] text-4xl font-bold text-white uppercase tracking-tight">Nuevo Período</h1>
        <p className="text-gray-400 text-sm font-['DM_Sans'] mt-1">
          Se generarán líneas automáticamente para todos los empleados activos con la frecuencia seleccionada.
        </p>
      </div>

      <div className="px-8 py-8 max-w-lg">
        <form onSubmit={onSubmit} className="bg-white border border-gray-200 p-6 flex flex-col gap-5">
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Tipo de período</label>
            <select name="periodType" required className={inputCls}>
              <option value="MONTHLY">Mensual</option>
              <option value="BIWEEKLY_1">Quincena 1 (días 1–15)</option>
              <option value="BIWEEKLY_2">Quincena 2 (días 16–fin)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Fecha inicio</label>
              <input name="periodStart" type="date" required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Fecha fin</label>
              <input name="periodEnd" type="date" required className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Notas (opcional)</label>
            <textarea name="notes" rows={3} className={inputCls} />
          </div>
          {createMut.isError && (
            <p className="text-sm text-red-600 font-['DM_Sans']">
              {(createMut.error as any)?.response?.data?.error ?? 'Error al crear el período'}
            </p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => navigate('/admin-payroll')} className="px-4 py-2 text-sm border border-gray-200 text-gray-600 font-['DM_Sans']">
              Cancelar
            </button>
            <button type="submit" disabled={createMut.isPending} className="px-4 py-2 text-sm bg-[#F5C218] text-[#1C1C1C] font-bold uppercase font-['Barlow_Condensed'] disabled:opacity-50">
              {createMut.isPending ? 'Generando...' : 'Generar Período'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crear AdminPayrollDetailPage.tsx**

Crear `apps/frontend/src/pages/admin-payroll/AdminPayrollDetailPage.tsx`:

```tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Download, CheckCircle, DollarSign, XCircle } from 'lucide-react';
import { adminPayrollsApi, type AdminPayroll } from '../../api/index';
import FormModal from '../../components/ui/FormModal';
import { useRole } from '../../hooks/useRole';

const fmt  = (n: number) => new Intl.NumberFormat('es-DO', { minimumFractionDigits: 2 }).format(n);
const inputCls = "w-full border border-gray-200 px-3 py-2 text-sm font-['DM_Sans'] focus:outline-none focus:border-[#F5C218] focus:ring-1 focus:ring-[#F5C218]";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', APPROVED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800', VOIDED: 'bg-red-100 text-red-700',
};
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Borrador', APPROVED: 'Aprobada', PAID: 'Pagada', VOIDED: 'Anulada' };

export default function AdminPayrollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isSupervisor } = useRole();

  const [payModal, setPayModal]   = useState(false);
  const [voidModal, setVoidModal] = useState(false);

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-payroll', id],
    queryFn:  () => adminPayrollsApi.getById(id!),
  });

  const p: AdminPayroll | undefined = res?.data.data;

  const approveMut = useMutation({
    mutationFn: () => adminPayrollsApi.approve(id!),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-payroll', id] }),
  });

  const payMut = useMutation({
    mutationFn: (d: unknown) => adminPayrollsApi.pay(id!, d),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-payroll', id] }); setPayModal(false); },
  });

  const voidMut = useMutation({
    mutationFn: (reason: string) => adminPayrollsApi.void(id!, reason),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['admin-payroll', id] }); setVoidModal(false); },
  });

  const updateLineMut = useMutation({
    mutationFn: ({ lineId, d }: { lineId: string; d: unknown }) => adminPayrollsApi.updateLine(id!, lineId, d),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-payroll', id] }),
  });

  const onPaySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    payMut.mutate({ paymentMethod: fd.get('paymentMethod'), paymentDate: fd.get('paymentDate'), paymentBank: fd.get('paymentBank') || null, paymentReference: fd.get('paymentReference') || null });
  };

  const onVoidSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    voidMut.mutate(fd.get('voidReason') as string);
  };

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">Cargando...</p></div>;
  if (!p) return null;

  const isDraft    = p.status === 'DRAFT';
  const isApproved = p.status === 'APPROVED';
  const isVoided   = p.status === 'VOIDED';
  const canAct     = isAdmin || isSupervisor;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1C1C1C] px-8 py-8">
        <button onClick={() => navigate('/admin-payroll')} className="flex items-center gap-1 text-[#F5C218] text-xs uppercase font-['Barlow_Condensed'] mb-3">
          <ChevronLeft size={14} /> Períodos
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-['Barlow_Condensed'] text-4xl font-bold text-white uppercase tracking-tight">
              NOM-ADM-{String(p.number).padStart(3,'0')}
            </h1>
            <p className="text-gray-400 text-sm font-['DM_Sans'] mt-1">
              {p.periodStart.slice(0,10)} — {p.periodEnd.slice(0,10)}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-3 py-1 text-xs font-bold uppercase ${STATUS_COLOR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
            <a href={adminPayrollsApi.exportUrl(p.id)} className="flex items-center gap-1 px-3 py-1 border border-gray-600 text-gray-300 text-xs font-['DM_Sans'] hover:border-[#F5C218] hover:text-[#F5C218]">
              <Download size={12} /> Excel
            </a>
            {canAct && isDraft && (
              <button onClick={() => approveMut.mutate()} disabled={approveMut.isPending} className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs font-bold uppercase font-['Barlow_Condensed'] disabled:opacity-50">
                <CheckCircle size={12} /> Aprobar
              </button>
            )}
            {canAct && isApproved && (
              <button onClick={() => setPayModal(true)} className="flex items-center gap-1 px-3 py-1 bg-[#F5C218] text-[#1C1C1C] text-xs font-bold uppercase font-['Barlow_Condensed']">
                <DollarSign size={12} /> Registrar Pago
              </button>
            )}
            {isAdmin && !isVoided && (
              <button onClick={() => setVoidModal(true)} className="flex items-center gap-1 px-3 py-1 border border-red-400 text-red-400 text-xs font-bold uppercase font-['Barlow_Condensed']">
                <XCircle size={12} /> Anular
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Totales */}
      <div className="px-8 py-4 grid grid-cols-3 gap-4">
        {[
          { label: 'Total Bruto',      value: p.totalGross },
          { label: 'Total Deducciones', value: p.totalDeductions },
          { label: 'Total Neto',       value: p.totalNet },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-['DM_Sans'] uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold font-['Space_Mono'] text-gray-900 mt-1">RD$ {fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Líneas */}
      <div className="px-8 pb-8">
        <div className="bg-white border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-[#1C1C1C]">
                {['#','Empleado','Salario Base','Beneficios','Bruto','AFP','TSS','ISR','Otros Desc.','Neto'].map((h) => (
                  <th key={h} className="text-left px-3 py-3 font-['Barlow_Condensed'] text-xs text-gray-400 uppercase tracking-[0.1em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(p.lines ?? []).map((line) => (
                <tr key={line.id} className="border-t border-gray-100">
                  <td className="px-3 py-3 font-['Space_Mono'] text-gray-400 text-xs">{line.lineNumber}</td>
                  <td className="px-3 py-3 font-['DM_Sans'] font-medium">{line.employee?.name}</td>
                  <td className="px-3 py-3 font-['Space_Mono'] text-xs">{fmt(line.baseSalary)}</td>
                  <td className="px-3 py-3 font-['Space_Mono'] text-xs">{fmt(line.benefitsTotal)}</td>
                  <td className="px-3 py-3 font-['Space_Mono'] text-xs font-bold">{fmt(line.grossAmount)}</td>
                  <td className="px-3 py-3 font-['Space_Mono'] text-xs text-red-600">{fmt(line.afpEmployee)}</td>
                  <td className="px-3 py-3 font-['Space_Mono'] text-xs text-red-600">{fmt(line.tssEmployee)}</td>
                  <td className="px-3 py-3 font-['Space_Mono'] text-xs text-red-600">{fmt(line.isr)}</td>
                  <td className="px-3 py-3">
                    {isDraft && canAct ? (
                      <input
                        type="number" min="0" step="0.01"
                        defaultValue={line.otherDeductions}
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (val !== line.otherDeductions) {
                            updateLineMut.mutate({ lineId: line.id, d: { otherDeductions: val, otherDeductionsNote: line.otherDeductionsNote } });
                          }
                        }}
                        className="w-24 border border-gray-200 px-2 py-1 text-xs font-['Space_Mono'] focus:outline-none focus:border-[#F5C218]"
                      />
                    ) : (
                      <span className="font-['Space_Mono'] text-xs text-red-600">{fmt(line.otherDeductions)}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-['Space_Mono'] text-xs font-bold text-green-700">{fmt(line.netAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal pago */}
      {payModal && (
        <FormModal title="Registrar Pago" onClose={() => setPayModal(false)} onSubmit={onPaySubmit} isSubmitting={payMut.isPending}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Método de pago</label>
              <select name="paymentMethod" className={inputCls}>
                <option value="TRANSFER">Transferencia</option>
                <option value="CASH">Efectivo</option>
                <option value="CHECK">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Fecha de pago</label>
              <input name="paymentDate" type="date" required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Banco</label>
              <input name="paymentBank" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Referencia</label>
              <input name="paymentReference" className={inputCls} />
            </div>
          </div>
        </FormModal>
      )}

      {/* Modal anular */}
      {voidModal && (
        <FormModal title="Anular Nómina" onClose={() => setVoidModal(false)} onSubmit={onVoidSubmit} isSubmitting={voidMut.isPending}>
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 font-['Barlow_Condensed'] mb-1">Motivo de anulación</label>
            <textarea name="voidReason" required rows={3} minLength={5} className={inputCls} />
          </div>
        </FormModal>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar build**

```bash
pnpm build:frontend 2>&1 | grep -E "error|✓"
```

Expected: `✓ built`

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/admin-payroll/
git commit -m "feat(frontend): páginas nóminas administrativas (lista, form, detalle)"
```

---

### Task 8: Rutas, Sidebar y Migración

**Files:**
- Modify: `apps/frontend/src/main.tsx`
- Modify: `apps/frontend/src/components/layout/Layout.tsx`

- [ ] **Step 1: Agregar rutas lazy en main.tsx**

En `apps/frontend/src/main.tsx`, en el bloque de `const ... = lazy(...)` agregar:

```typescript
const AdminPayrollsPage        = lazy(() => import('./pages/admin-payroll/AdminPayrollsPage'));
const AdminPayrollFormPage     = lazy(() => import('./pages/admin-payroll/AdminPayrollFormPage'));
const AdminPayrollDetailPage   = lazy(() => import('./pages/admin-payroll/AdminPayrollDetailPage'));
const AdminEmployeesPage       = lazy(() => import('./pages/admin-payroll/AdminEmployeesPage'));
const AdminEmployeeDetailPage  = lazy(() => import('./pages/admin-payroll/AdminEmployeeDetailPage'));
```

En el bloque de `<Routes>`, dentro del `<Route path="/">`, agregar:

```tsx
{/* Nómina Administrativa */}
<Route path="admin-payroll"                    element={<AdminPayrollsPage />} />
<Route path="admin-payroll/new"                element={<AdminPayrollFormPage />} />
<Route path="admin-payroll/employees"          element={<AdminEmployeesPage />} />
<Route path="admin-payroll/employees/:id"      element={<AdminEmployeeDetailPage />} />
<Route path="admin-payroll/:id"                element={<AdminPayrollDetailPage />} />
```

**Importante:** la ruta `admin-payroll/employees` debe ir ANTES de `admin-payroll/:id` para que Express no la capture como parámetro.

- [ ] **Step 2: Agregar sección sidebar en Layout.tsx**

En `apps/frontend/src/components/layout/Layout.tsx`, en el array `navItems`, agregar estos dos items (después de las entradas de `operaciones`, antes de `reportes`):

```typescript
{ to: '/admin-payroll/employees', icon: Users,    label: 'Empleados Adm.',  group: 'nomina-admin', roles: ['admin', 'supervisor', 'financiero'] },
{ to: '/admin-payroll',           icon: FileText,  label: 'Nómina Admin.',   group: 'nomina-admin', roles: ['admin', 'supervisor', 'financiero'] },
```

En el objeto `GROUP_LABELS`, agregar:

```typescript
'nomina-admin': 'Nómina Administrativa',
```

Asegurarse de que `Users` y `FileText` están en los imports de `lucide-react` (agregar si no están).

- [ ] **Step 3: Verificar build completo**

```bash
pnpm build:frontend 2>&1 | grep -E "error|✓"
```

Expected: `✓ built`

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/main.tsx apps/frontend/src/components/layout/Layout.tsx
git commit -m "feat(frontend): rutas y sidebar nómina administrativa"
```

---

### Task 9: Migración de base de datos y push final

- [ ] **Step 1: Crear migración (solo en entorno con PostgreSQL)**

```bash
cd /home/user/servingmi-appCG
pnpm db:migrate
# Cuando pida nombre: admin_payroll_module
```

Si no hay PostgreSQL local disponible, la migración se aplicará automáticamente en Render via `prisma migrate deploy` en el pre-deploy configurado en `render.yaml`.

- [ ] **Step 2: Build backend final**

```bash
pnpm build:backend 2>&1 | tail -5
```

Expected: `Found 0 errors.`

- [ ] **Step 3: Build frontend final**

```bash
pnpm build:frontend 2>&1 | tail -3
```

Expected: `✓ built`

- [ ] **Step 4: Push**

```bash
git push origin main
```

Expected: `main -> main` — Render auto-despliega, ejecuta `prisma migrate deploy` antes del start.

---

## Self-Review

**Spec coverage:**
- ✅ 5 modelos Prisma (Task 1)
- ✅ Cálculos AFP/TSS/ISR con tests (Task 2)
- ✅ CRUD empleados + historial salarial + beneficios (Task 3)
- ✅ Crear período auto-generando líneas (Task 4)
- ✅ DRAFT→APPROVED→PAID→VOIDED (Task 4)
- ✅ Editar otherDeductions en DRAFT con recálculo de totales (Task 4)
- ✅ Exportación Excel 2 hojas (Task 4)
- ✅ RBAC en todos los endpoints (Tasks 3, 4)
- ✅ API types frontend (Task 5)
- ✅ 5 páginas frontend (Tasks 6, 7)
- ✅ Sidebar + rutas (Task 8)
- ✅ Migración (Task 9)

**Type consistency:** `calculateLine()` definida en Task 2, usada en Task 4 service con los mismos parámetros. `AdminPayroll`/`AdminEmployee` definidos en Task 5, usados en Tasks 6-7. Consistente.
