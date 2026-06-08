# Build stage
FROM node:24-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app

# Try to copy files first (local builds), fallback to clone (CI/Render)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./ 2>/dev/null || \
    (git clone --depth 1 https://github.com/jhta712-max/servingmi-appCG.git . && rm -rf .git)

COPY apps/backend ./apps/backend 2>/dev/null || true

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
