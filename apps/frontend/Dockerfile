FROM node:20-alpine AS builder

# Instalar pnpm
RUN npm install -g pnpm

# Declarar build arg para que Render lo inyecte en el build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY src ./src
COPY public ./public
COPY index.html vite.config.ts tsconfig.json ./

RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
