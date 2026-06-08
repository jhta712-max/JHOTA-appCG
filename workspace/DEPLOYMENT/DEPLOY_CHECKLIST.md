# Deploy Checklist — Antes de cada push a main

**SIEMPRE ejecutar TODOS estos pasos antes de hacer push a main.**

---

## 📋 Pre-commit (Local)

- [ ] `git status` — Ningún archivo uncommitted
- [ ] `git diff main` — Revisar TODOS los cambios
- [ ] `pnpm install` — Dependencias actualizadas

---

## 🔍 Si cambió algo de esto: TEST LOCAL

### Cambió Dockerfile / Dockerfile.backend / Dockerfile.frontend?
```bash
cd /home/user/servingmi-appCG
docker build -f Dockerfile.backend . --progress=plain
```
✅ Debe completar sin errores

### Cambió apps/backend/prisma/schema.prisma?
```bash
cd /home/user/servingmi-appCG/apps/backend
pnpm run db:generate
```
✅ Debe ejecutar sin errores
✅ Verifica que binaryTargets incluya: ["native", "debian-openssl-3.0.x", "linux-musl-openssl-3.0.x"]

### Cambió apps/backend/package.json (dependencies)?
```bash
cd /home/user/servingmi-appCG
pnpm install
pnpm build:backend
```
✅ Build debe completar

### Cambió apps/frontend/package.json (dependencies)?
```bash
cd /home/user/servingmi-appCG
pnpm install
pnpm build:frontend
```
✅ Build debe completar

### Cambió render.yaml?
```bash
# Revisar manualmente:
# - preDeployCommand correcto
# - dockerfilePath apunta a root Dockerfile.*
# - envVars completas
# - dependencias entre servicios correctas
```

---

## 🏗️ Backend Build verification

```bash
cd /home/user/servingmi-appCG/apps/backend
pnpm run db:generate  # Regenerar Prisma
pnpm build           # Compilar TypeScript
```

✅ No hay errores TS2742 (type inference)
✅ No hay módulos faltantes

---

## 🎨 Frontend Build verification

```bash
cd /home/user/servingmi-appCG/apps/frontend
pnpm build
```

✅ Build completa sin warnings

---

## 🚀 Git & Push

- [ ] `git add <files>` — Stage los cambios específicos
- [ ] `git commit -m "..."` — Mensaje claro y descriptivo
- [ ] `git push origin main` — Push a main

⚠️ **Post-push:** Verificar en Render dashboard que el deploy inicia

---

## 🚨 Si el deploy falla en Render

1. **Ir a Render Dashboard** → servingmi-backend
2. **Revisar Build Logs**:
   - ¿Dice "CACHE"? → Posible issue con cache
   - ¿Dice "Cannot find module"? → pnpm workspace incompleto
   - ¿Dice "libquery_engine"? → Prisma binary target incorrecto
3. **Consultar** `workspace/TROUBLESHOOTING/DOCKER_ISSUES.md`
4. **No hacer push nuevamente** sin entender el error

---

## ✅ Deploy exitoso se ve así

```
==> Building...
#17 [builder 8/8] RUN pnpm run build
#17 DONE (no CACHED)

==> Deploying...
==> Setting WEB_CONCURRENCY=1

[2026-06-08T17:19:24.573Z] INFO Conectado a PostgreSQL correctamente
[2026-06-08T17:19:24.658Z] INFO Servidor corriendo en http://localhost:10000

==> Your service is live 🎉
```

---

## 🔗 Referencias rápidas

- **CLAUDE.md:** `/home/user/servingmi-appCG/CLAUDE.md` — Guía completa
- **Problemas Docker:** `workspace/TROUBLESHOOTING/DOCKER_ISSUES.md`
- **Problemas Prisma:** `workspace/TROUBLESHOOTING/PRISMA_ISSUES.md`
- **Problemas Render:** `workspace/TROUBLESHOOTING/RENDER_ISSUES.md`

---

**Última actualización:** 2026-06-08
