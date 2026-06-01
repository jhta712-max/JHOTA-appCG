FROM node:20-alpine AS builder

# Declarar build arg para que Render lo inyecte en el build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app

COPY package.json package-lock.json ./
COPY src ./src
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json ./
COPY public ./public

RUN npm ci
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
