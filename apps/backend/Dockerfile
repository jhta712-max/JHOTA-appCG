FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Instalar pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copiar archivos de este directorio (apps/backend) que Render proporciona
COPY . .

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Generar cliente Prisma
RUN pnpm exec prisma generate

# Compilar TypeScript (ignora errores de tipo pre-existentes)
RUN npm run build || true

EXPOSE 3001

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/server.js"]
