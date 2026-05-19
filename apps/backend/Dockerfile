FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar archivos de dependencias y prisma
COPY package.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./
COPY src ./src

# Instalar dependencias
RUN npm install

# Generar cliente Prisma y compilar TypeScript
RUN npx prisma generate
RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js 2>&1"]
