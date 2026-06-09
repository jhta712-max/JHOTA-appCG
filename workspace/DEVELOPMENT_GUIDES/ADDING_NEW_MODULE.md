# Cómo agregar un nuevo módulo Backend

Ejemplo: Agregar módulo `suppliers` (Proveedores/Beneficiarios)

---

## 1. Estructura del módulo

Crear carpeta `apps/backend/src/modules/suppliers/` con:

```
modules/suppliers/
├── suppliers.controller.ts    # Express handlers
├── suppliers.service.ts       # Business logic
├── suppliers.router.ts        # Express router
├── suppliers.schema.ts        # Zod validation schemas
└── index.ts                   # Exports
```

---

## 2. Zod Schema (suppliers.schema.ts)

```typescript
import { z } from 'zod';

export const CreateSupplierSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  companyId: z.number().int(),
});

export type CreateSupplierDTO = z.infer<typeof CreateSupplierSchema>;
```

---

## 3. Service (suppliers.service.ts)

```typescript
import prisma from '@/config/database';
import { CreateSupplierDTO } from './suppliers.schema';

export const suppliersService = {
  async create(data: CreateSupplierDTO) {
    return prisma.supplier.create({ data });
  },

  async list(companyId: number) {
    return prisma.supplier.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getById(id: number) {
    return prisma.supplier.findUnique({ where: { id } });
  },

  async update(id: number, data: Partial<CreateSupplierDTO>) {
    return prisma.supplier.update({ where: { id }, data });
  },

  async delete(id: number) {
    return prisma.supplier.delete({ where: { id } });
  },
};
```

---

## 4. Controller (suppliers.controller.ts)

```typescript
import { Request, Response } from 'express';
import { suppliersService } from './suppliers.service';
import { CreateSupplierSchema } from './suppliers.schema';

export const suppliersController = {
  async create(req: Request, res: Response) {
    try {
      const data = CreateSupplierSchema.parse(req.body);
      const result = await suppliersService.create(data);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: String(error) });
    }
  },

  async list(req: Request, res: Response) {
    try {
      const { companyId } = req.query;
      const result = await suppliersService.list(Number(companyId));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await suppliersService.getById(Number(id));
      res.json(result || { error: 'Not found' });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  },
};
```

---

## 5. Router (suppliers.router.ts)

```typescript
import { Router } from 'express';
import { authenticate } from '@/middlewares/auth';
import { suppliersController } from './suppliers.controller';

const router = Router();

router.post('/', authenticate, suppliersController.create);
router.get('/', authenticate, suppliersController.list);
router.get('/:id', authenticate, suppliersController.getById);

export default router;
```

---

## 6. Integrar en app.ts

```typescript
import suppliersRouter from './modules/suppliers/suppliers.router';

// En app.use():
app.use('/api/v1/suppliers', suppliersRouter);
```

---

## 7. Actualizar BD (Prisma)

**apps/backend/prisma/schema.prisma:**

```prisma
model Supplier {
  id        Int     @id @default(autoincrement())
  name      String
  email     String?
  phone     String?
  companyId Int
  company   Company @relation(fields: [companyId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([companyId])
}
```

**Crear migración:**
```bash
cd apps/backend
pnpm run db:migrate
# Nombre: add_suppliers_table
```

**Ejecutar:**
```bash
pnpm run db:migrate
```

---

## 8. Frontend API integration

**apps/frontend/src/api/index.ts:**

```typescript
export const suppliersApi = {
  create: (data: CreateSupplierDTO) =>
    axios.post('/suppliers', data),

  list: (companyId: number) =>
    axios.get('/suppliers', { params: { companyId } }),

  getById: (id: number) =>
    axios.get(`/suppliers/${id}`),

  update: (id: number, data: Partial<CreateSupplierDTO>) =>
    axios.put(`/suppliers/${id}`, data),

  delete: (id: number) =>
    axios.delete(`/suppliers/${id}`),
};
```

---

## 9. Frontend Hook (si aplica)

**apps/frontend/src/pages/suppliers/SuppliersPage.tsx:**

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { suppliersApi } from '@/api';

export function SuppliersPage() {
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersApi.list(companyId),
  });

  const createMutation = useMutation({
    mutationFn: suppliersApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  return (
    <div>
      {suppliers?.map(s => <div key={s.id}>{s.name}</div>)}
    </div>
  );
}
```

---

## Checklist de implementación

- [ ] Crear carpeta `modules/suppliers/`
- [ ] Crear `.schema.ts` con Zod validators
- [ ] Crear `.service.ts` con lógica de BD
- [ ] Crear `.controller.ts` con handlers HTTP
- [ ] Crear `.router.ts` con rutas
- [ ] Actualizar `app.ts` para registrar router
- [ ] Actualizar `schema.prisma` con modelo
- [ ] Ejecutar `pnpm run db:migrate`
- [ ] Agregar API methods en `frontend/src/api/index.ts`
- [ ] Crear componente/página en frontend
- [ ] Test local: `pnpm dev`
- [ ] Test HTTP: Postman/curl
- [ ] Push a main + deploy

---

**Última actualización:** 2026-06-08
