---
name: run-servingmi
description: Run, start, launch, screenshot, or smoke-test the ServingMI app (backend + frontend). Use when verifying changes, taking screenshots, or doing end-to-end testing.
---

ServingMI is a React 18 + Express/Prisma monorepo. The driver is
`.claude/skills/run-servingmi/driver.mjs` — it launches Playwright against the
running dev servers and produces screenshots in `/tmp/servingmi-ss/`.

## Prerequisites

Install once per container:

```bash
# Playwright package (pre-installed chromium at /opt/pw-browsers/...)
mkdir -p /tmp/pw-test && cd /tmp/pw-test
echo '{"name":"pw-test","type":"module","dependencies":{"playwright":"^1.52.0"}}' > package.json
npm install --silent
cd -
```

PostgreSQL (system-level, needs to be started once):

```bash
pg_ctlcluster 16 main start
```

## Setup (first time in a new container)

```bash
# 1. Start Postgres
pg_ctlcluster 16 main start

# 2. Create DB user and database
sudo -u postgres psql -c "CREATE USER gastos_user WITH PASSWORD 'gastos_pass_local' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE gastos_proyectos OWNER gastos_user;"

# 3. Write backend .env
cat > apps/backend/.env << 'EOF'
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://gastos_user:gastos_pass_local@localhost:5432/gastos_proyectos"
JWT_SECRET="local-dev-secret-for-skill-testing-at-least-64-chars-long-ok"
JWT_ACCESS_EXPIRES=8h
JWT_REFRESH_EXPIRES=30d
FRONTEND_URL=http://localhost:5173
STORAGE_TYPE=local
UPLOAD_PATH=./uploads
LOG_LEVEL=info
ENABLE_MONITORING=false
EOF

# 4. Apply database migrations (baseline approach — see Gotchas)
cd apps/backend
PGPASSWORD=gastos_pass_local psql -h localhost -U gastos_user -d gastos_proyectos \
  -f prisma/migrations/20260531000000_init_baseline/migration.sql

PGPASSWORD=gastos_pass_local psql -h localhost -U gastos_user -d gastos_proyectos << 'SQL'
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
  PGPASSWORD=gastos_pass_local psql -h localhost -U gastos_user -d gastos_proyectos -c \
    "INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,applied_steps_count) \
     VALUES (replace(gen_random_uuid()::text,'-',''),'skip',NOW(),'$name',1);" 2>/dev/null
done

npx prisma migrate deploy
cd -

# 5. Seed test data
cd apps/backend
DATABASE_URL="postgresql://gastos_user:gastos_pass_local@localhost:5432/gastos_proyectos" \
  npx tsx prisma/seed.ts
cd -
```

## Run — agent path

```bash
# Start backend (background)
cd apps/backend && npx tsx src/server.ts > /tmp/backend.log 2>&1 & echo $! > /tmp/backend.pid

# Start frontend (background)
cat > apps/frontend/.env << 'EOF'
VITE_API_URL=http://localhost:3001/api/v1
EOF
cd apps/frontend && npx vite --host 0.0.0.0 --port 5173 > /tmp/frontend.log 2>&1 & echo $! > /tmp/frontend.pid

# Wait for both to be ready
sleep 5 && curl -s http://localhost:3001/health | python3 -m json.tool
```

Then drive with the Playwright driver:

```bash
# Full smoke test (login → dashboard → 5 module pages → API health)
node .claude/skills/run-servingmi/driver.mjs smoke
# Screenshots land in /tmp/servingmi-ss/

# Single screenshot of any page (after auto-login)
node .claude/skills/run-servingmi/driver.mjs screenshot /tmp/out.png /suppliers

# Verify login only
node .claude/skills/run-servingmi/driver.mjs login-test
```

**Default credentials (seed):** `admin@gastos.local` / `Admin@2026!`

**Screenshots:** `/tmp/servingmi-ss/{name}.png`

## Run — human path

```bash
pnpm dev   # starts backend :3001 + frontend :5173 concurrently
```

Open `http://localhost:5173` — login with `admin@gastos.local` / `Admin@2026!`.

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

- **`chromium-browser` is a snap stub** — the binary at `/usr/bin/chromium-browser` exits immediately with "requires the chromium snap". Use Playwright's pre-installed binary at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. The driver already points there.

- **Migration conflict: `type "project_status" already exists`** — the repo has a `20260531000000_init_baseline` migration that is a full-schema snapshot. Running `prisma migrate deploy` from a blank DB will fail because earlier migrations (2026051*) are additive patches for an already-existing schema, while the baseline re-creates everything. The correct approach: apply the baseline SQL directly, then manually mark the 12 pre-baseline migrations as applied in `_prisma_migrations`, then run `prisma migrate deploy` for the post-baseline migrations. The setup steps above do this exactly.

- **`prisma migrate dev` needs CREATEDB** — the dev variant requires a shadow database. Grant the user `CREATEDB` or use `prisma migrate deploy` instead.

- **`pnpm db:migrate` at repo root** is an alias for `prisma migrate dev` inside the backend. It will fail without CREATEDB and without a proper dev environment. In this container, `npx prisma migrate deploy` (run inside `apps/backend/`) is the correct command.

- **Dashboard lives at `/`** not `/dashboard` — after login the app redirects to `/` which renders the dashboard. `page.url()` will show `http://localhost:5173/` not `.../dashboard`.

- **VITE_API_URL vs proxy** — Vite proxies `/api` to port 3001. Setting `VITE_API_URL=http://localhost:3001/api/v1` in `apps/frontend/.env` bypasses the proxy and hits the backend directly (both work in this container, direct is simpler for agents).

- **`tsx src/server.ts` loads `.env` from `apps/backend/`** — the `dotenv.config()` call in `src/config/env.ts` resolves relative to CWD. Always start the backend from `apps/backend/` or pass the env vars explicitly.

## Troubleshooting

| Error | Fix |
|---|---|
| `type "project_status" already exists` | Follow the baseline migration procedure in Setup §4 |
| `chromium-browser requires snap` | Driver already uses `/opt/pw-browsers/…/chrome`; if that path changes, run `find /opt -name chrome -type f` |
| Backend log shows `Environment variable not found: DATABASE_URL` | Write `apps/backend/.env` as shown above |
| Login stays on `/login` | Check backend is running: `curl http://localhost:3001/health` |
| Playwright package not found | Run the `npm install` line under Prerequisites |
