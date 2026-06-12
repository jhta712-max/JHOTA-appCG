#!/bin/sh
set -e
# Las migraciones corren en preDeployCommand (render.yaml). Aquí quedan solo como
# salvaguarda para entornos sin preDeploy (p. ej. Docker local). Desactivar con
# SKIP_STARTUP_MIGRATIONS=1 cuando preDeployCommand está activo.
if [ "$SKIP_STARTUP_MIGRATIONS" != "1" ]; then
  echo "Running database migrations..."
  node /app/node_modules/.bin/prisma migrate deploy --schema /app/prisma/schema.prisma
fi
echo "Starting server..."
exec node dist/server.js
