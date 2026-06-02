FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar archivos de dependencias y prisma
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
COPY tsconfig.json ./
COPY src ./src

# Instalar dependencias (incluyendo dev para compilar TypeScript)
RUN npm ci

# Generar cliente Prisma y compilar TypeScript
RUN npx prisma generate
RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate resolve --applied 20260531000000_init_baseline 2>/dev/null; npx prisma migrate deploy && node dist/server.js 2>&1"]
