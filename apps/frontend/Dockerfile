# Build stage
FROM node:24-alpine AS builder

# Cache invalidation - forces fresh build
ARG BUILD_DATE=2026-06-08T16:35:00Z

RUN apk add --no-cache git
WORKDIR /app

# Clone repository
RUN git clone --depth 1 https://github.com/jhta712-max/servingmi-appCG.git . && rm -rf .git

RUN npm install -g pnpm && pnpm install --frozen-lockfile
WORKDIR /app/apps/frontend
RUN pnpm run build

# Production stage - Nginx
FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY --from=builder /app/apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
