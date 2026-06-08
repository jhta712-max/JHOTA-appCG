# 🔍 Diagnóstico de Base de Datos — Guía de Procedimiento

## Credenciales de Acceso (SERVINGMI)

**🔐 DATABASE_URL:**
```
postgresql://servingmidb_kyxq_user:C0kRvO0ErKO5zPO7bFeLsRtvcTa4lG9X@dpg-d86e903tqb8s73fja6d0-a/servingmi
```

**Host:** `dpg-d86e903tqb8s73fja6d0-a`  
**Puerto:** `5432`  
**Usuario:** `servingmidb_kyxq_user`  
**Contraseña:** `C0kRvO0ErKO5zPO7bFeLsRtvcTa4lG9X`  
**Base de datos:** `servingmi`  

---

## 🛠️ Método 1: pgAdmin en Render (Recomendado)

### Paso 1: Acceder a pgAdmin desde Render

1. **Ve a Render Dashboard** → Tu proyecto PostgreSQL (servingmi)
2. **Copia la URL de pgAdmin** (generalmente se ve en la sección "Connections")
   - O accede a: `https://[your-render-pgadmin-instance]`

### Paso 2: Conectar a la BD en pgAdmin

Si es la primera vez:

1. **Abre pgAdmin** en el navegador
2. **Haz clic derecho** en "Servers" → "Create" → "Server"
3. **Pestaña "General":**
   - Name: `servingmi-render`

4. **Pestaña "Connection":**
   - Host name/address: `dpg-d86e903tqb8s73fja6d0-a`
   - Port: `5432`
   - Maintenance database: `servingmi`
   - Username: `servingmidb_kyxq_user`
   - Password: `C0kRvO0ErKO5zPO7bFeLsRtvcTa4lG9X`
   - ☑ Save password

5. **Haz clic en "Save"**

### Paso 3: Navegar a la BD

```
Servers → servingmi-render → Databases → servingmi → Schemas → public → Tables
```

---

## 🔎 Caso 1: Gasto NO aparece en Frontend pero SOSPECHAMOS que está en BD

### Síntoma:
Usuario registra gasto pero no se ve en la app, aunque guardó exitosamente.

### Diagnóstico en pgAdmin:

1. **Abre Query Tool** (Ctrl+Alt+Q o Tools → Query Tool)

2. **Ejecuta esta query:**
```sql
SELECT 
  e.id,
  e.amount,
  e.description,
  c.name as categoria,
  p.code as proyecto,
  e."expenseDate"::DATE as fecha_factura,
  e."createdAt" as fecha_ingreso,
  u.name as registrado_por,
  e.status,
  e."hasFiscalDoc" as tiene_ncf
FROM "Expense" e
JOIN "ExpenseCategory" c ON e."categoryId" = c.id
JOIN "Project" p ON e."projectId" = p.id
LEFT JOIN "User" u ON e."userId" = u.id
WHERE e.amount = 7015  -- CAMBIA ESTO POR EL MONTO
  AND c.name = 'Materiales'  -- CAMBIA ESTO POR LA CATEGORÍA
ORDER BY e."createdAt" DESC
LIMIT 10;
```

### Interpretación:

| Resultado | Significa |
|-----------|-----------|
| 📊 Aparece en resultados | Gasto SÍ está en BD → **Problema de frontend (caché/filtros)** |
| ❌ No aparece | Gasto NO se guardó → **Problema en API backend** |

---

## 🔎 Caso 2: Ver últimos gastos registrados (cualquier monto)

**Para verificar si el sistema está guardando cualquier cosa:**

```sql
SELECT 
  e.id,
  e.amount::TEXT as monto,
  e.description,
  c.name as categoria,
  p.code as proyecto,
  e."createdAt" as fecha_ingreso,
  u.name as registrado_por,
  e.status
FROM "Expense" e
JOIN "ExpenseCategory" c ON e."categoryId" = c.id
JOIN "Project" p ON e."projectId" = p.id
LEFT JOIN "User" u ON e."userId" = u.id
ORDER BY e."createdAt" DESC
LIMIT 10;
```

**¿Qué buscar?**
- ¿Hay datos de hoy/hace poco?
- ¿El usuario registrado coincide con "Harold"?
- ¿La categoría es "Materiales"?

---

## 🔎 Caso 3: Gastos de un usuario específico

```sql
SELECT 
  e.id,
  e.amount,
  e.description,
  c.name as categoria,
  p.code as proyecto,
  e."createdAt" as fecha_ingreso,
  e.status
FROM "Expense" e
JOIN "ExpenseCategory" c ON e."categoryId" = c.id
JOIN "Project" p ON e."projectId" = p.id
WHERE LOWER(u.name) ILIKE '%harold%'  -- Busca por nombre
ORDER BY e."createdAt" DESC
LIMIT 20;
```

---

## 🔎 Caso 4: Contar gastos por proyecto

```sql
SELECT 
  p.code,
  p.name,
  COUNT(e.id) as total_gastos,
  SUM(e.amount) as total_monto,
  MAX(e."createdAt") as ultimo_ingreso
FROM "Expense" e
JOIN "Project" p ON e."projectId" = p.id
GROUP BY p.id, p.code, p.name
ORDER BY MAX(e."createdAt") DESC;
```

---

## 🔎 Caso 5: Detectar gastos con OCR validado vs no validado

```sql
SELECT 
  e.id,
  e.amount,
  e.description,
  e."hasFiscalDoc" as tiene_ncf,
  CASE 
    WHEN e."hasFiscalDoc" = true THEN 'Con comprobante'
    ELSE 'Sin comprobante'
  END as tipo_doc,
  e."createdAt",
  u.name
FROM "Expense" e
LEFT JOIN "User" u ON e."userId" = u.id
ORDER BY e."createdAt" DESC
LIMIT 20;
```

---

## 🔄 Soluciones comunes según resultado

| Problema | Solución |
|----------|----------|
| Gasto en BD pero no en frontend | Refrescar navegador (Ctrl+F5), limpiar filtros, revisar proyecto seleccionado |
| Gasto no en BD ni en frontend | Revisar logs de Render (Backend → Logs) para ver si hay error 500 al guardar |
| Duplicados | Verificar BD para gastos con mismo monto/descripción/proyecto/fecha en últimas 2 horas |
| Permisos | Verificar si el usuario tiene `canCreateExpense` en su rol |

---

## 📊 Scripts rápidos de diagnóstico

### Script: Último gasto (cualquiera)
```sql
SELECT * FROM "Expense" ORDER BY "createdAt" DESC LIMIT 1;
```

### Script: Contar todos los gastos
```sql
SELECT COUNT(*) as total_gastos FROM "Expense";
```

### Script: Ver estructura de tabla Expense
```sql
\d "Expense"
```

---

## 🚨 Procedimiento de emergencia: Gasto se perdió

Si el usuario jura que guardó pero no hay evidencia:

1. **pgAdmin → Query Tool:**
```sql
SELECT * FROM "Expense" 
WHERE "createdAt" >= NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" DESC;
```

2. **Si no aparece nada → Revisar logs de Render:**
   - Render Dashboard → Logs → Busca "error" o "500"
   - Busca timestamp cercano a cuando el usuario intentó guardar

3. **Si aparece en BD pero no en frontend:**
   - Ir a Gastos → Refrescar (Ctrl+F5)
   - Cambiar proyecto seleccionado
   - Cambiar filtros de estado
   - Limpiar caché del navegador (Ctrl+Shift+Delete)

---

## 📝 Checklista de diagnóstico

- [ ] Verificar que gasto está en BD (pgAdmin)
- [ ] Verificar monto correcto (7015)
- [ ] Verificar categoría correcta (Materiales)
- [ ] Verificar proyecto correcto
- [ ] Verificar usuario registrado (Harold)
- [ ] Verificar status (ACTIVE)
- [ ] Revisar logs de Render si no está en BD
- [ ] Refrescar frontend si está en BD pero no se ve

---

**Última actualización:** 2026-06-08  
**Creado para:** Diagnóstico de problemas de persistencia en gastos
