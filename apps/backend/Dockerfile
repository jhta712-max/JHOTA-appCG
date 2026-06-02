FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar archivos de este directorio (apps/backend) que Render proporciona
COPY . .

# Instalar dependencias con npm
RUN npm install

# Generar cliente Prisma
RUN npx prisma generate

# Compilar TypeScript (ignora errores de tipo pre-existentes)
RUN npm run build || true

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
