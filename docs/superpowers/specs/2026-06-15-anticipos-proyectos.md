# Anticipos y NCF en Análisis Financiero de Proyectos

> **Estado:** APROBADO — listo para implementación.

## Objetivo

Registrar anticipos contractuales recibidos del cliente antes del inicio de ejecución de obras civiles, separados de las cubicaciones. Agregar campo NCF opcional a ambos modelos para trazabilidad fiscal dominicana.

## Contexto

En República Dominicana, la ley establece un anticipo para obras civiles que el cliente paga al contratista antes de iniciar la ejecución. Este pago no es una cubicación (las cubicaciones miden avance físico realizado). La amortización del anticipo ya viene incorporada en los montos de las cubicaciones que registra el usuario — no se calcula automáticamente.

## Modelos de Datos

### Nuevo: `ProjectAnticipo`

```prisma
model ProjectAnticipo {
  id          String   @id @default(uuid()) @db.Uuid
  projectId   String   @map("project_id") @db.Uuid
  number      Int
  amount      Decimal  @db.Decimal(15, 2)
  date        DateTime @db.Date
  ncf         String?  @db.VarChar(19)
  description String?  @db.Text
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, number])
  @@index([projectId])
  @@map("project_anticipos")
}
```

El campo `number` es auto-incremental por proyecto (el service calcula `MAX(number) + 1` al crear).

### Modificación: `ProjectCubicacion`

Agregar un campo opcional:

```prisma
ncf String? @db.VarChar(19)
```

### Relación inversa en `Project`

```prisma
anticipos ProjectAnticipo[]
```

## Backend

### Endpoints nuevos

Todos bajo `/api/v1/projects/:id/anticipos`. Requieren middleware `authenticate`. Autorización: `admin` o `supervisor` para write operations; todos los roles autenticados pueden leer.

```
GET    /api/v1/projects/:id/anticipos         → lista anticipos del proyecto
POST   /api/v1/projects/:id/anticipos         → crear anticipo
PATCH  /api/v1/projects/:id/anticipos/:aid    → editar anticipo
DELETE /api/v1/projects/:id/anticipos/:aid    → eliminar anticipo
```

### Validación Zod (anticipo)

```typescript
export const createAnticipoSchema = z.object({
  amount:      z.coerce.number().positive(),
  date:        z.string().date(),
  ncf:         z.string().max(19).optional().nullable()
                 .refine(v => !v || NCF_REGEX.test(v) || E_NCF_REGEX.test(v), 'NCF inválido'),
  description: z.string().max(500).optional().nullable(),
});
export const updateAnticipoSchema = createAnticipoSchema.partial();
```

Usar `NCF_REGEX` y `E_NCF_REGEX` de `utils/fiscal.utils.ts` (ya existen en el sistema).

### Análisis financiero actualizado (`getFinancialAnalysis`)

El método devuelve dos campos adicionales:

```typescript
totalAnticipos: number   // suma de todos los anticipos del proyecto
totalCobrado:   number   // totalAnticipos + totalCubicado
```

El margen (`totalCubicado - totalGastado`) no cambia — sigue siendo la diferencia entre lo facturado por avance y lo gastado.

### Endpoint de cubicaciones

Agregar `ncf` al schema Zod de create/update de cubicaciones (mismo patrón de validación).

## Frontend (`ProjectFinancialPage.tsx`)

### Tarjetas del resumen

Agregar tarjeta **"Total cobrado"** a las tarjetas existentes:

```
Presupuesto total | Total cubicado | Total gastado | Margen | Total cobrado
```

`Total cobrado = anticipos + cubicaciones`

### Nueva sección "Anticipos recibidos"

Aparece ANTES de la sección de cubicaciones (orden cronológico: anticipo primero, luego cubicaciones).

Columnas de la tabla:
| N° | Fecha | Monto | NCF | Descripción | Acciones |

- Formulario inline para crear/editar (igual al patrón de cubicaciones)
- Total acumulado al pie de la tabla
- Sin `progressPct` (los anticipos no tienen % de avance físico)

### Sección de cubicaciones

Agregar campo **NCF** opcional al formulario existente (create y edit).

## Permisos

| Operación | Roles |
|---|---|
| Ver anticipos | Todos los autenticados con acceso al proyecto |
| Crear / editar / eliminar anticipo | `admin`, `supervisor` |
| Agregar NCF a cubicación | `admin`, `supervisor` |

## Migraciones

Dos migraciones SQL necesarias:

1. `ALTER TABLE project_cubicaciones ADD COLUMN ncf VARCHAR(19);`
2. `CREATE TABLE project_anticipos (...)` con índice y constraint unique en `(project_id, number)`.

## Lo que NO cambia

- El cálculo de margen (`totalCubicado - totalGastado`) permanece igual.
- La amortización del anticipo no se calcula automáticamente — viene incorporada en los montos de las cubicaciones que registra el usuario.
- El modelo `ProjectCubicacion` mantiene todos sus campos actuales; solo se agrega `ncf`.
