# Build stage
FROM node:24-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/frontend ./apps/frontend
RUN npm install -g pnpm && pnpm install --frozen-lockfile
WORKDIR /app/apps/frontend
RUN pnpm run build

# Production stage - Nginx
FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
