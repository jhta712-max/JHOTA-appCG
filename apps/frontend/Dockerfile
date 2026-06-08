# Build stage
FROM node:24-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app

# Try to copy files first (local builds), fallback to clone (CI/Render)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./ 2>/dev/null || \
    (git clone --depth 1 https://github.com/jhta712-max/servingmi-appCG.git . && rm -rf .git)

COPY apps/frontend ./apps/frontend 2>/dev/null || true

RUN npm install -g pnpm && pnpm install --frozen-lockfile
WORKDIR /app/apps/frontend
RUN pnpm run build

# Production stage - Nginx
FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY --from=builder /app/apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || \
    RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
