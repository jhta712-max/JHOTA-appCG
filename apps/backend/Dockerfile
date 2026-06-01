FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Instalar pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copiar archivos de dependencias y prisma
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma/
COPY tsconfig.json ./
COPY src ./src

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Generar cliente Prisma y compilar TypeScript
RUN pnpm prisma generate
RUN pnpm run build

EXPOSE 3001

CMD ["sh", "-c", "pnpm prisma migrate resolve --applied 20260531000000_init_baseline 2>/dev/null; pnpm prisma migrate deploy && node dist/server.js 2>&1"]
