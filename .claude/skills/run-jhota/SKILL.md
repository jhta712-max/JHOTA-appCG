---
name: run-jhota
description: Run, start, launch, screenshot, or smoke-test the JHOTA Construcciones app (backend + frontend). Use when verifying changes, taking screenshots, or doing end-to-end testing.
---

JHOTA Construcciones es una instancia independiente de ServingMI — React 18 + Express/Prisma monorepo. El driver es `.claude/skills/run-jhota/driver.mjs` — lanza Playwright contra los dev servers y produce screenshots en `/tmp/jhota-ss/`.

## Prerequisites

Instalar una vez por contenedor:

```bash
# Playwright package (chromium pre-instalado en /opt/pw-browsers/...)
mkdir -p /tmp/pw-test && cd /tmp/pw-test
echo '{"name":"pw-test","type":"module","dependencies":{"playwright":"^1.52.0"}}' > package.json
npm install --silent
cd -
```

PostgreSQL (nivel sistema, iniciar una vez):

```bash
pg_ctlcluster 16 main start
```

## Setup (primera vez en un contenedor nuevo)

```bash
# 1. Iniciar Postgres
pg_ctlcluster 16 main start

# 2. Crear usuario y base de datos
sudo -u postgres psql -c "CREATE USER jhota_user WITH PASSWORD 'jhota_pass_local' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE jhota_gastos OWNER jhota_user;"

# 3. Escribir .env del backend
cat > apps/backend/.env << 'EOF'
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://jhota_user:jhota_pass_local@localhost:5432/jhota_gastos"
JWT_SECRET="local-dev-secret-for-jhota-testing-at-least-64-chars-long-ok"
JWT_ACCESS_EXPIRES=8h
JWT_REFRESH_EXPIRES=30d
FRONTEND_URL=http://localhost:5173
STORAGE_TYPE=local
UPLOAD_PATH=./uploads
LOG_LEVEL=info
ENABLE_MONITORING=false
EOF

# 4. Aplicar migraciones (enfoque baseline — ver Gotchas)
cd apps/backend
PGPASSWORD=jhota_pass_local psql -h localhost -U jhota_user -d jhota_gastos \
  -f prisma/migrations/20260531000000_init_baseline/migration.sql

PGPASSWORD=jhota_pass_local psql -h localhost -U jhota_user -d jhota_gastos << 'SQL'
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) NOT NULL, "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ, "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT, "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "applied_steps_count" INTEGER DEFAULT 0 NOT NULL, PRIMARY KEY ("id")
);
SQL

for name in 20260518154040_inicio_sistema 20260518171909_add_invitations \
  20260518200000_add_project_addendums 20260518210000_add_project_cubicaciones \
  20260518220000_add_project_assignments 20260518230000_add_payroll \
  20260518240000_add_payroll_line_supplier 20260518250000_add_payroll_line_bank_name \
  20260518260000_add_payroll_payment_details 20260518270000_add_payroll_receipt_fields \
  20260518280000_add_monitoring_tables 20260531000000_init_baseline; do
  PGPASSWORD=jhota_pass_local psql -h localhost -U jhota_user -d jhota_gastos -c \
    "INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,applied_steps_count) \
     VALUES (replace(gen_random_uuid()::text,'-',''),'skip',NOW(),'$name',1);" 2>/dev/null
done

npx prisma migrate deploy
cd -

# 5. Seed datos de prueba
cd apps/backend
DATABASE_URL="postgresql://jhota_user:jhota_pass_local@localhost:5432/jhota_gastos" \
  npx tsx prisma/seed.ts
cd -
```

## Run — agent path

```bash
# Iniciar backend (background)
cd apps/backend && npx tsx src/server.ts > /tmp/backend.log 2>&1 & echo $! > /tmp/backend.pid

# Iniciar frontend (background)
cat > apps/frontend/.env << 'EOF'
VITE_API_URL=http://localhost:3001/api/v1
EOF
cd apps/frontend && npx vite --host 0.0.0.0 --port 5173 > /tmp/frontend.log 2>&1 & echo $! > /tmp/frontend.pid

# Esperar que estén listos
sleep 5 && curl -s http://localhost:3001/health | python3 -m json.tool
```

Luego ejecutar con el driver Playwright:

```bash
# Smoke test completo (login → dashboard → 5 módulos → API health)
node .claude/skills/run-jhota/driver.mjs smoke
# Screenshots en /tmp/jhota-ss/

# Screenshot de una página específica (después de auto-login)
node .claude/skills/run-jhota/driver.mjs screenshot /tmp/out.png /suppliers

# Verificar solo login
node .claude/skills/run-jhota/driver.mjs login-test
```

**Credenciales por defecto (seed):** `admin@gastos.local` / `Admin@2026!`

**Screenshots:** `/tmp/jhota-ss/{name}.png`

## Run — human path

```bash
pnpm dev   # inicia backend :3001 + frontend :5173 simultáneamente
```

Abrir `http://localhost:5173` — login con `admin@gastos.local` / `Admin@2026!`.

## Stop

```bash
kill $(cat /tmp/backend.pid) 2>/dev/null; kill $(cat /tmp/frontend.pid) 2>/dev/null
```

## Tests

```bash
pnpm --filter backend test        # Vitest unit tests
pnpm build:backend                # TypeScript typecheck (exit 0 = clean)
pnpm build:frontend               # Vite build check
```

## Gotchas

- **`chromium-browser` es un snap stub** — usar el binario pre-instalado de Playwright en `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. El driver ya apunta ahí.

- **Conflicto de migración baseline** — igual que en ServingMI: aplicar el SQL baseline directamente, marcar las migraciones pre-baseline como aplicadas, luego `prisma migrate deploy`. El setup de arriba lo hace correctamente.

- **`prisma migrate dev` necesita CREATEDB** — usar `prisma migrate deploy` dentro de `apps/backend/`.

- **Dashboard en `/`** — después del login la app redirige a `/`, no a `/dashboard`.

## Troubleshooting

| Error | Fix |
|---|---|
| `type "project_status" already exists` | Seguir el procedimiento de migración baseline en Setup §4 |
| `chromium-browser requires snap` | El driver usa `/opt/pw-browsers/…/chrome`; si cambia el path, ejecutar `find /opt -name chrome -type f` |
| `Environment variable not found: DATABASE_URL` | Escribir `apps/backend/.env` como se muestra arriba |
| Login stays on `/login` | Verificar que el backend corra: `curl http://localhost:3001/health` |
| Playwright package not found | Ejecutar el `npm install` en Prerequisites |
