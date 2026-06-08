# Build stage
FROM node:24-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend ./apps/backend
RUN npm install -g pnpm && pnpm install --frozen-lockfile
WORKDIR /app/apps/backend
RUN pnpm run build

# Production stage
FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/apps/backend/prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/server.js"]
