# CLAUDE.md

**ServingMI** es un sistema de control de gastos por proyectos para empresas constructoras en República Dominicana. Multiusuario con RBAC, reportes, y exportación Excel/Word. Backend en Render, frontend estático en Nginx.

## Stack

- **Backend:** Node.js 24 + Express + TypeScript + Prisma ORM + PostgreSQL 16
- **Frontend:** React 18 + Vite + TailwindCSS + TanStack Query + Zustand
- **Deploy:** Render.com (Docker), monorepo pnpm workspaces
- **Rama principal:** `main` (auto-deploy en Render)

## Comandos clave

```bash
# Desarrollo (desde /home/user/servingmi-appCG)
pnpm install              # Instalar workspace completo
pnpm dev                  # Backend + frontend simultáneamente
pnpm build:backend        # Compilar TypeScript backend
pnpm build:frontend       # Build Vite frontend

# Base de datos
docker-compose up -d postgres   # Levantar PostgreSQL local
pnpm db:migrate                 # Ejecutar migraciones
pnpm db:generate                # Regenerar Prisma client
```

## Dónde vive cada cosa

| Qué | Dónde |
|-----|-------|
| Backend módulos, API | `apps/backend/src/modules/` |
| Frontend páginas, componentes | `apps/frontend/src/pages/` |
| Schema BD, migraciones | `apps/backend/prisma/` |
| Docker, Render config | `/` (raíz): `Dockerfile.*`, `render.yaml` |
| Notas, auditorías, guías | `workspace/` → Lee `workspace/README.md` |

## Reglas concretas

1. **Docker:** Siempre `COPY apps ./apps` (TODO el workspace). Nunca `COPY apps/backend ./apps/backend`. Si cambia Dockerfile → test local: `docker build -f Dockerfile.backend .`

2. **Prisma:** Si cambias `schema.prisma` → ejecuta `pnpm run db:generate` ANTES de push. Schema debe tener: `binaryTargets = ["native", "debian-openssl-3.0.x", "linux-musl-openssl-3.0.x"]`

3. **Antes de cada push a main:** Ejecuta `workspace/DEPLOYMENT/DEPLOY_CHECKLIST.md`. No hagas push directo.

4. **RBAC:** Usa `useRole()` hook en frontend (nunca `useAuthStore` para permisos). Roles: admin, supervisor, operator, auxiliar, financiero.

## Primeros pasos en una sesión

1. Lee `workspace/SESSION_NOTES/` → qué pasó antes
2. Lee `workspace/README.md` → estructura del workspace
3. Si hay error de deploy → busca en `workspace/TROUBLESHOOTING/`
4. Si necesitas agregar módulo → `workspace/DEVELOPMENT_GUIDES/ADDING_NEW_MODULE.md`
