# Docker Issues — Problemas comunes y soluciones

## "Cannot find module 'zod'"

**Error:**
```
Error: Cannot find module 'zod'
Require stack:
- /app/dist/config/env.js
```

**Causa:** pnpm workspace incompleto. Solo se copiaba `apps/backend`, no `apps/frontend`.

**Solución:**
- Verificar `Dockerfile`: debe tener `COPY apps ./apps` (TODO el workspace)
- Verificar que `pnpm-lock.yaml` y `pnpm-workspace.yaml` están en raíz
- Local: `pnpm install` en raíz, no en subdirectorio

**Prevención:**
- Nunca hacer `COPY apps/backend ./apps/backend` en Dockerfile
- Siempre: `COPY apps ./apps`

---

## "libquery_engine-linux-musl.so.node not found"

**Error:**
```
Unable to require(`/app/node_modules/.pnpm/@prisma+client@5.22.0/node_modules/.prisma/client/libquery_engine-linux-musl.so.node`)
```

**Causa:** Prisma generado para `linux-musl`, pero Render usa `linux-musl-openssl-3.0.x`.

**Solución:**
1. Verificar `apps/backend/prisma/schema.prisma`:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x", "linux-musl-openssl-3.0.x"]
}
```

2. Ejecutar local: `pnpm --filter backend run db:generate`
3. Verificar que Dockerfile tenga: `RUN pnpm run db:generate` ANTES de build
4. Push y redeploy

**Prevención:**
- Si cambias `schema.prisma` → siempre ejecutar `db:generate` local
- Revisar binaryTargets antes de cada deploy

---

## "libssl.so.1.1: No such file or directory"

**Error:**
```
Error loading shared library libssl.so.1.1: No such file or directory
```

**Causa:** Alpine Linux moderno tiene OpenSSL 3.0, no 1.1.

**Solución:**
- Dockerfile debe tener: `RUN apk add --no-cache openssl`
- Esto instala OpenSSL 3.0

---

## Docker build usa caché viejo (CACHED, CACHED, CACHED)

**Síntoma:** Todos los RUN steps dicen CACHED, pero cambios no aparecen en imagen.

**Causa:** Docker reutiliza layers anticuadas.

**Solución:**
- Dockerfile tiene `ARG CACHE_BUST=default` que invalida cache
- Si aún no funciona: Render Dashboard → Rebuild (no re-deploy)

**Local:** `docker build --no-cache -f Dockerfile.backend .`

---

## Dockerfile antiguo en apps/backend/ o apps/frontend/

**Síntoma:** Deploy usa Dockerfile incorrecto o viejo.

**Causa:** Dockerfiles en subdirectorios conflictúan con root Dockerfiles.

**Solución:**
- Eliminar: `apps/backend/Dockerfile` y `apps/frontend/Dockerfile`
- Mantener: `Dockerfile`, `Dockerfile.backend`, `Dockerfile.frontend` en raíz

**Verificar:**
```bash
git ls-files | grep -i dockerfile
```

Debe mostrar solo:
```
Dockerfile
Dockerfile.backend
Dockerfile.frontend
```

---

## Build contextsize too small (95.65kB)

**Error:**
```
COPY apps/backend ./apps/backend: not found
```

**Causa:** Docker build context no incluye `apps/` folder.

**Solución:**
- `.dockerignore` debe tener: `!apps/` (excepcionar)
- O verificar `render.yaml`: no debe tener `rootDir` restrictivo

---

## pnpm install toma mucho tiempo o falla

**Solución:**
```bash
# Local: limpiar y reinstalar
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Después verficar
pnpm --filter backend run db:generate
pnpm build:backend
```

---

## Útil: Test Docker build local

```bash
cd /home/user/servingmi-appCG
docker build -f Dockerfile.backend . --progress=plain 2>&1 | tail -50
```

Permite ver exactamente dónde falla sin esperar a Render.

---

**Última actualización:** 2026-06-08
