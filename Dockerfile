# Build stage - Backend (Force rebuild)
FROM node:24-alpine AS builder

# Cache invalidation - forces fresh build every deployment
ARG CACHE_BUST=default
RUN echo "Cache bust: $CACHE_BUST"

WORKDIR /app

# Copy monorepo files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy all apps (workspace needs all apps even if only building one)
COPY apps ./apps

# Install and build
RUN npm install -g pnpm && pnpm install --frozen-lockfile
WORKDIR /app/apps/backend
RUN pnpm run build

# Production stage
FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/apps/backend/prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/server.js"]
