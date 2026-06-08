#!/bin/sh
set -e
echo "Running database migrations..."
node /app/node_modules/.bin/prisma migrate deploy --schema /app/prisma/schema.prisma
echo "Migrations complete. Starting server..."
exec node dist/server.js
