# Nómina Administrativa — Diseño

> **Para agentic workers:** usar `superpowers:writing-plans` para crear el plan de implementación a partir de este spec.

**Goal:** Módulo independiente de nómina para empleados administrativos, sin vinculación a proyectos, con cálculo automático de AFP/TSS/ISR según legislación dominicana.

**Architecture:** 4 modelos Prisma nuevos (`AdministrativeEmployee`, `AdministrativeEmployeeSalaryHistory`, `AdministrativeEmployeeBenefit`, `AdministrativePayroll`, `AdministrativePayrollLine`). Backend NestJS-style en `modules/admin-payroll/`. Frontend 5 páginas bajo `/admin-payroll`. No genera registros en `OfficeExpense` — reportes propios.

**Tech Stack:** Prisma + PostgreSQL, Express + TypeScript, React 18 + TanStack Query, ExcelJS para exportación, design system #1C1C1C/#F5C218 existente.

---

## 1. Base de Datos

### Enums nuevos

```prisma
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
```

### AdministrativeEmployee

```prisma
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
```

### AdministrativeEmployeeSalaryHistory

Registro inmutable. Se crea automáticamente en backend cada vez que cambia `baseSalary`.

```prisma
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
```

### AdministrativeEmployeeBenefit

Beneficios fijos configurados por empleado. Se cargan automáticamente al generar un período.

```prisma
model AdministrativeEmployeeBenefit {
  id          String   @id @default(uuid()) @db.Uuid
  employeeId  String   @map("employee_id") @db.Uuid
  name        String   @db.VarChar(100)
  amount      Decimal  @db.Decimal(15, 2)
  affectsISR  Boolean  @default(true) @map("affects_isr")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  employee AdministrativeEmployee @relation(fields: [employeeId], references: [id])

  @@index([employeeId])
  @@index([isActive])
  @@map("administrative_employee_benefits")
}
```

### AdministrativePayroll

```prisma
model AdministrativePayroll {
  id               String              @id @default(uuid()) @db.Uuid
  number           Int
  periodType       AdminPeriodType     @map("period_type")
  periodStart      DateTime            @map("period_start") @db.Date
  periodEnd        DateTime            @map("period_end") @db.Date
  status           AdminPayrollStatus  @default(DRAFT)
  totalGross       Decimal             @default(0) @map("total_gross") @db.Decimal(15, 2)
  totalDeductions  Decimal             @default(0) @map("total_deductions") @db.Decimal(15, 2)
  totalNet         Decimal             @default(0) @map("total_net") @db.Decimal(15, 2)
  notes            String?             @db.Text
  paymentMethod    String?             @map("payment_method") @db.VarChar(20)
  paymentDate      DateTime?           @map("payment_date") @db.Date
  paymentBank      String?             @map("payment_bank") @db.VarChar(100)
  paymentReference String?             @map("payment_reference") @db.VarChar(100)
  createdById      String              @map("created_by") @db.Uuid
  approvedById     String?             @map("approved_by") @db.Uuid
  approvedAt       DateTime?           @map("approved_at")
  paidAt           DateTime?           @map("paid_at")
  voidedById       String?             @map("voided_by") @db.Uuid
  voidedAt         DateTime?           @map("voided_at")
  voidReason       String?             @map("void_reason") @db.Text
  createdAt        DateTime            @default(now()) @map("created_at")
  updatedAt        DateTime            @updatedAt @map("updated_at")

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
```

### AdministrativePayrollLine

Snapshot completo por empleado por período. Los cálculos se fijan al generar — no cambian si el salario cambia después.

```prisma
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

---

## 2. Cálculos Automáticos

Función `calculatePayrollLine(employee, benefits, periodType)` en `admin-payroll.calculations.ts`:

```typescript
const AFP_RATE  = 0.0287;  // empleado
const TSS_RATE  = 0.0304;  // empleado (SFS)

// Tramos ISR RD 2024 (anuales, RD$)
const ISR_BRACKETS = [
  { upTo: 416_220,   rate: 0    },
  { upTo: 624_329,   rate: 0.15 },
  { upTo: 867_123,   rate: 0.20 },
  { upTo: Infinity,  rate: 0.25 },
];

function calculateISR(annualTaxableIncome: number): number {
  // progresivo por tramos
}

export function calculateLine(baseSalary, benefits, periodType) {
  const divisor = periodType === 'MONTHLY' ? 12 : 24;

  const benefitsTotal = benefits.reduce((sum, b) => sum + b.amount, 0);
  const taxableMonthly = baseSalary + benefits
    .filter(b => b.affectsISR)
    .reduce((sum, b) => sum + b.amount, 0);

  const annualTaxable = taxableMonthly * (periodType === 'MONTHLY' ? 12 : 24);
  const annualISR = calculateISR(annualTaxable);

  return {
    benefitsTotal,
    taxableBase:  taxableMonthly,
    afpEmployee:  round2(baseSalary * AFP_RATE),
    tssEmployee:  round2(baseSalary * TSS_RATE),
    isr:          round2(annualISR / divisor),
    grossAmount:  round2(baseSalary + benefitsTotal),
    // netAmount se calcula después de agregar otherDeductions (default 0)
  };
}
```

**Reglas:**
- AFP y TSS se calculan **solo sobre `baseSalary`**, no sobre beneficios
- ISR se calcula sobre `taxableBase` (salario + beneficios con `affectsISR = true`)
- En quincena: ingreso anual = mensual × 24; ISR resultante ÷ 24
- `otherDeductions` es editable en DRAFT; los demás campos son de solo lectura una vez generados

---

## 3. Flujo de Trabajo

```
[Crear período] → DRAFT → APPROVED → PAID
                    ↓         ↓        ↓
                  VOIDED   VOIDED   VOIDED
```

### Crear período (POST /admin-payrolls)
- Body: `{ periodType, periodStart, periodEnd, notes? }`
- Backend carga todos los `AdministrativeEmployee` con `status = ACTIVE` y `paymentFrequency` compatible:
  - `MONTHLY` → incluir empleados con `paymentFrequency = MONTHLY`
  - `BIWEEKLY_1` o `BIWEEKLY_2` → incluir empleados con `paymentFrequency = BIWEEKLY`
- Por cada empleado, llama `calculateLine()` y crea `AdministrativePayrollLine`
- Calcula y guarda `totalGross`, `totalDeductions`, `totalNet` en el header
- Si no hay empleados activos con esa frecuencia → error 400

### Aprobar (POST /admin-payrolls/:id/approve)
- Solo `DRAFT` → `APPROVED`
- Requiere rol `admin` o `supervisor`
- Congela líneas (no editables después)

### Pagar (POST /admin-payrolls/:id/pay)
- Solo `APPROVED` → `PAID`
- Body: `{ paymentMethod, paymentDate, paymentBank?, paymentReference? }`
- No crea registros en otros módulos

### Anular (POST /admin-payrolls/:id/void)
- Cualquier estado excepto `VOIDED`
- Solo `admin`
- Requiere `voidReason`

### Editar línea en DRAFT (PATCH /admin-payrolls/:id/lines/:lineId)
- Solo campos: `otherDeductions`, `otherDeductionsNote`
- Recalcula `netAmount` y totales del header

---

## 4. API Endpoints

```
# Empleados
GET    /api/v1/admin-employees              lista con filtros (status, frequency)
POST   /api/v1/admin-employees              crear empleado (crea primer registro salaryHistory)
GET    /api/v1/admin-employees/:id          detalle + salaryHistory + benefits
PUT    /api/v1/admin-employees/:id          editar (si cambia baseSalary → crea salaryHistory)
DELETE /api/v1/admin-employees/:id          soft delete (deletedAt)

# Beneficios del empleado
POST   /api/v1/admin-employees/:id/benefits          agregar beneficio
PUT    /api/v1/admin-employees/:id/benefits/:bId     editar beneficio
DELETE /api/v1/admin-employees/:id/benefits/:bId     eliminar beneficio

# Nóminas
GET    /api/v1/admin-payrolls               lista con filtros (status, periodType, year)
POST   /api/v1/admin-payrolls               crear período (genera líneas automáticamente)
GET    /api/v1/admin-payrolls/:id           detalle con líneas
PATCH  /api/v1/admin-payrolls/:id/lines/:lineId   editar otherDeductions (solo DRAFT)
POST   /api/v1/admin-payrolls/:id/approve   aprobar
POST   /api/v1/admin-payrolls/:id/pay       marcar pagada
POST   /api/v1/admin-payrolls/:id/void      anular
GET    /api/v1/admin-payrolls/:id/export.xlsx  exportar Excel
```

**RBAC:**
- `admin`, `supervisor`: CRUD completo + aprobar + pagar + anular
- `financiero`: solo lectura + exportar
- `auxiliar`: sin acceso

---

## 5. Exportación Excel

Un archivo por período con dos hojas:

**Hoja 1 — Resumen del período**
| Período | Tipo | Fecha pago | Total bruto | Total deducciones | Total neto |

**Hoja 2 — Detalle por empleado**
| # | Empleado | Cargo | Salario base | Beneficios | Bruto | AFP | TSS | ISR | Otros desc. | Neto | Banco | Cuenta |

Encabezado con logo-like: `SERVINGMI — NÓMINA ADMINISTRATIVA` en negrita, fondo oscuro.

---

## 6. Frontend — Estructura de Páginas

### Archivos a crear

```
apps/frontend/src/pages/admin-payroll/
  AdminEmployeesPage.tsx      lista de empleados
  AdminEmployeeDetailPage.tsx detalle + historial + beneficios
  AdminPayrollsPage.tsx       lista de períodos
  AdminPayrollFormPage.tsx    crear período
  AdminPayrollDetailPage.tsx  detalle con tabla de líneas + acciones
```

### Rutas en main.tsx

```tsx
<Route path="admin-payroll"                element={<AdminPayrollsPage />} />
<Route path="admin-payroll/new"            element={<AdminPayrollFormPage />} />
<Route path="admin-payroll/:id"            element={<AdminPayrollDetailPage />} />
<Route path="admin-payroll/employees"      element={<AdminEmployeesPage />} />
<Route path="admin-payroll/employees/:id"  element={<AdminEmployeeDetailPage />} />
```

### Sidebar

Nueva sección en `Layout.tsx` — visible solo `isAdmin || role === 'financiero'`:

```
▸ NÓMINA ADMIN
    Empleados
    Períodos
```

### Design system (igual que resto de la app)

- Hero `bg-[#1C1C1C]` con H1 `font-['Barlow_Condensed'] uppercase`
- Tabla con `thead bg-[#1C1C1C]`, headers amarillos
- Badge de estado: gris=DRAFT, azul=APPROVED, verde=PAID, rojo=VOIDED
- Números en `font-['Space_Mono']`
- Sin `rounded-xl` en ningún elemento

---

## 7. Consideraciones Técnicas

**Historial salarial:** El servicio `updateEmployee()` compara el `baseSalary` entrante con el actual. Si difiere, crea automáticamente un `AdministrativeEmployeeSalaryHistory` con `effectiveFrom = hoy` antes de actualizar el empleado. El frontend muestra el historial como tabla read-only en el detalle del empleado.

**Número de nómina:** Autoincremental global (no por frecuencia). El servicio obtiene `MAX(number) + 1` dentro de la misma transacción de creación.

**Consistencia de totales:** Cada vez que se edita `otherDeductions` en una línea, el servicio recalcula `netAmount` de esa línea y actualiza `totalGross`, `totalDeductions`, `totalNet` del header en la misma transacción.

**Migración Prisma:** Una sola migración `YYYYMMDD_admin_payroll_module` que crea todos los modelos nuevos. No modifica tablas existentes.

**Sin relación con OfficeExpense:** Decisión deliberada. Los reportes consolidados (admin vs. proyectos) se resuelven en capa de reporte futura, no mezclando registros ahora.
