# 🔐 Auditoría de Roles — Limitaciones y Permisos

**Última actualización:** 2026-06-08  
**Creado después de:** Bug detectado donde `supervisor` gastos se guardaban como PENDING_APPROVAL

---

## 📊 Resumen de Roles y Acceso

| Rol | Crear Gasto | Aprobar Gasto | Crear Proyecto | Crear Nómina | Crear Orden Pago | Ver Reportes |
|-----|-----------|---------------|----------------|-------------|-----------------|------------|
| **admin** | ACTIVE ✅ | Sí | Sí | Sí | Sí | Sí |
| **supervisor** | ACTIVE ✅ | ❌ NO* | Sí | Sí | Sí | Sí |
| **operator** | PENDING_APPROVAL ⏳ | ❌ NO | ❌ NO | Sí (limitado) | ❌ NO | Limitado |
| **auxiliar** | ❌ NO | ❌ NO | ❌ NO | Sí | ❌ NO | Limitado |
| **financiero** | ❌ NO | Sí** | ❌ NO | ❌ NO | ❌ NO | Sí |

\* **NOTA CRÍTICA:** Supervisor NO puede APROBAR gastos. Solo financiero y admin pueden aprobar.  
\*\* Financiero solo aprueba/rechaza, no crea.

---

## 🔍 Limitaciones Detectadas por Módulo

### 1️⃣ **EXPENSES (Gastos por Proyecto)**

#### Crear gasto (`POST /expenses`)
- ✅ **admin** → ACTIVE
- ✅ **supervisor** → ACTIVE (CAMBIO RECIENTE: antes PENDING)
- ⏳ **operator** → PENDING_APPROVAL (requiere aprobación)
- ❌ **auxiliar** → NO (no en router)
- ❌ **financiero** → NO

#### Bulk import (`POST /expenses/bulk-import`)
- ✅ Solo **admin**
- ⚠️ **BUG POTENCIAL:** Supervisor no puede importar CSV en lote, pero sí crear individual

#### Aprobar gasto (`POST /expenses/:id/approve`)
- ✅ **admin**, **financiero**
- ❌ **supervisor** → NO (¡INCONSISTENCIA! puede crear pero no aprobar propios)

#### Rechazar gasto (`POST /expenses/:id/reject`)
- ✅ **admin**, **financiero**
- ❌ **supervisor** → NO

#### Anular gasto (`POST /expenses/:id/void`)
- ✅ **admin**, **supervisor**
- ❌ Otros

#### Eliminar gasto (`DELETE /expenses/:id`)
- ✅ Solo **admin**

---

### 2️⃣ **OFFICE EXPENSES (Gastos de Oficina)**

#### Acceso general
- ✅ **admin**, **supervisor** → acceso completo
- ❌ **operator** → NO

**Nota:** Los office expenses NO tienen workflow de aprobación. Todo se crea como ACTIVE.

---

### 3️⃣ **PROJECTS (Proyectos)**

#### Crear proyecto (`POST /projects`)
- ✅ **admin**, **supervisor**
- ❌ Otros

#### Editar proyecto (`PUT /projects/:id`)
- ✅ **admin**, **supervisor**
- ❌ Otros

#### Eliminar proyecto (`DELETE /projects/:id`)
- ✅ Solo **admin**
- ❌ **supervisor** → NO (¡INCONSISTENCIA!)

#### Ver detalles financieros (`GET /projects/:id/financial-summary`)
- ✅ **admin**, **supervisor**

#### Crear aditamento (`POST /projects/:id/addendums`)
- ✅ **admin**, **supervisor**

---

### 4️⃣ **PAYROLL (Nóminas)**

#### Crear nómina (`POST /payrolls`)
- ✅ Todos (no tiene restricción en router)
- ⚠️ **POTENCIAL BUG:** Sin validación de rol en router

#### Aprobar nómina (`POST /payrolls/:id/approve`)
- ✅ **admin**, **supervisor**
- ❌ **operator** → NO

#### Marcar como pagada (`POST /payrolls/:id/pay`)
- ✅ **admin**, **supervisor**
- ❌ **operator** → NO

#### Exportar nómina (`GET /payrolls/:id/export.xlsx|docx`)
- ✅ **admin**, **supervisor**
- ❌ Otros

#### Revertir a draft (`POST /payrolls/:id/revert-to-draft`)
- ✅ **admin**, **supervisor**
- ❌ **operator** → NO

#### Importar desde órdenes de pago (`POST /payrolls/:id/import-from-orders`)
- ✅ **admin**, **supervisor**
- ❌ Otros

---

### 5️⃣ **QUOTATIONS (Cotizaciones)**

#### Cambiar estado (`PATCH /quotations/:id/status`)
- ✅ **admin**, **supervisor**
- ❌ **operator** → NO

#### Eliminar (`DELETE /quotations/:id`)
- ✅ **admin**, **supervisor**

#### Crear links (`POST /quotations/:id/links`)
- ✅ **admin**, **supervisor**

#### Editar cotización (`PUT /quotations/:id`)
- ✅ **admin**, **supervisor**
- ⏳ **operator** → SÍ, pero solo dentro de **24 horas** (validado en service)

---

### 6️⃣ **PAYMENT ORDERS (Órdenes de Pago)**

```
[Requiere verificación en router - revisar payment-orders.router.ts]
```

---

## 🚨 **INCONSISTENCIAS IDENTIFICADAS**

### 🔴 **Crítica: Supervisor puede crear pero no aprobar gastos**

**Locación:** `expenses.service.ts` + `expenses.router.ts`

**Problema:**
```
- Supervisor crea gasto → se guarda como ACTIVE (correcto desde hace poco)
- Pero supervisor NO puede llamar a POST /expenses/:id/approve (solo admin y financiero)
```

**Impacto:** Confusión sobre quién puede aprobar. ¿El supervisor auto-aprueba al crear, o necesita aprobación separada?

**Estado:** ✅ PARCIALMENTE CORREGIDO (auto-approve al crear, pero endpoint approve aún bloqueado)

---

### 🟡 **Alta: Supervisor puede eliminar proyecto pero NO editarlo después**

**Locación:** `projects.router.ts`

**Problema:**
```
PUT /projects/:id  → authorize('admin', 'supervisor')  ✅
DELETE /projects/:id → authorize('admin')  ❌ supervisor bloqueado
```

**Impacto:** Supervisor puede borrar proyecto pero no editarlo = inconsistencia de permisos.

**Recomendación:** Si supervisor NO puede eliminar, también debería NO poder editar. O viceversa.

---

### 🟡 **Media: Crear nómina sin validación de rol**

**Locación:** `payroll.router.ts`

```javascript
router.post('/', ctrl.create);  // ❌ SIN authorize()
```

**Problema:** Cualquier usuario autenticado puede crear nómina (solo requiere `authenticate`).

**Impacto:** auxiliar y financiero pueden crear nóminas cuando probablemente no deberían.

**Recomendación:** Agregar `authorize('admin', 'supervisor', 'operator')` o similar.

---

### 🟡 **Media: Supervisor no puede hacer bulk import de gastos**

**Locación:** `expenses.router.ts`

```javascript
router.post('/bulk-import', authorize('admin'), ctrl.bulkImport);  // ❌ supervisor bloqueado
```

**Problema:** Solo admin puede importar CSV. Supervisor no puede, aunque sí puede crear individual.

**Impacto:** Si supervisor necesita actualizar múltiples gastos, debe crearlos uno a uno.

**Recomendación:** `authorize('admin', 'supervisor')`

---

## ✅ **AUDITORÍA CHECKLIST**

Usa esta checklist para detectar bugs similares en futuros módulos:

- [ ] ¿Todos los roles que pueden CREAR también pueden EDITAR/APROBAR?
- [ ] ¿Todos los roles que pueden EDITAR también pueden ELIMINAR?
- [ ] ¿Las restricciones son consistentes entre endpoints relacionados?
- [ ] ¿El status inicial (ACTIVE vs PENDING_APPROVAL) coincide con el rol?
- [ ] ¿Los endpoints de lista filtran correctamente por rol?
- [ ] ¿Hay validaciones en el SERVICE además del router?
- [ ] ¿Qué pasa si operator crea algo pero no tiene acceso al proyecto?
- [ ] ¿El mensaje de error es claro cuando se bloquea un endpoint por rol?

---

## 🛠️ **QUERIES DE AUDITORÍA EN BD**

### Ver todos los roles y permisos (si BD los almacena)
```sql
SELECT * FROM "roles";
```

### Ver todos los usuarios y sus roles
```sql
SELECT u.name, u.email, r.name as role, u.created_at
FROM "users" u
LEFT JOIN "roles" r ON u.role_id = r.id
ORDER BY r.name, u.name;
```

### Contar gastos por rol y status
```sql
SELECT 
  r.name as role,
  e.status,
  COUNT(e.id) as total
FROM "expenses" e
JOIN "users" u ON e.user_id = u.id
LEFT JOIN "roles" r ON u.role_id = r.id
GROUP BY r.name, e.status
ORDER BY r.name, e.status;
```

---

## 📋 **CAMBIOS REALIZADOS EN ESTA SESIÓN**

| Módulo | Cambio | Razón |
|--------|--------|-------|
| `expenses.service.ts` | Remover `supervisor` de `ROLES_NEED_APPROVAL` | Supervisor no necesita aprobación interna |
| `expenses.service.ts` | Auto-aprobar si `hasFiscalDoc = true` | Comprobante fiscal = validación externa |
| `expenses` frontend | Agregar filtro `PENDING_APPROVAL` | Visibilidad de gastos pendientes |

---

## 🎯 **Próximos pasos sugeridos**

1. **Unificar workflow de aprobación:**
   - Decidir: ¿Supervisor auto-aprueba (actual) o requiere aprobación de admin/financiero?
   - Documentar claramente

2. **Agregar validaciones faltantes:**
   - Bulk import: permitir a supervisor
   - Crear nómina: validar rol en router

3. **Revisar DELETE vs EDIT permisos:**
   - Proyecto: supervisor puede editar pero no eliminar (¿consistente?)

4. **Casos edge:**
   - ¿Qué pasa si operator crea gasto en proyecto donde supervisor es asignado?
   - ¿Supervisor ve gastos de operadores en su proyecto?

---

**Documento vivo:** Actualizar cuando se agreguen nuevos módulos o cambios de permisos.
