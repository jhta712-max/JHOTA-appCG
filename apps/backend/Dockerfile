# Build stage
FROM node:24-alpine AS builder

# Cache invalidation - forces fresh build
ARG BUILD_DATE=2026-06-08T16:35:00Z

RUN apk add --no-cache git
WORKDIR /app

# Clone repository
RUN git clone --depth 1 https://github.com/jhta712-max/servingmi-appCG.git . && rm -rf .git

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
