#!/bin/sh
set -e
# Las migraciones corren en preDeployCommand (render.yaml). Aquí quedan solo como
# salvaguarda para entornos sin preDeploy (p. ej. Docker local). Desactivar con
# SKIP_STARTUP_MIGRATIONS=1 cuando preDeployCommand está activo.
if [ "$SKIP_STARTUP_MIGRATIONS" != "1" ]; then
  echo "Running database migrations..."
  PRISMA_BIN=$(find /app/node_modules/.pnpm -type f -name "index.js" -path "*/prisma/build/index.js" 2>/dev/null | head -1)
  node "$PRISMA_BIN" migrate deploy --schema /app/apps/backend/prisma/schema.prisma
fi
echo "Starting server..."
exec node /app/apps/backend/dist/server.js
