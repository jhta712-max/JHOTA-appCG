# Guía de Deploy - Sistema de Gastos por Proyectos

## 📋 Requisitos Previos

- Docker y Docker Compose instalados
- Node.js 20+ (para desarrollo local sin Docker)
- PostgreSQL 16+ (si no usas Docker)

## 🚀 Deploy con Docker (Recomendado)

### 1. Preparar variables de entorno

Crear `apps/backend/.env` basado en `.env.example`:

```bash
PORT=3001
NODE_ENV=production
DATABASE_URL="postgresql://gastos_user:gastos_pass_local@postgres:5432/gastos_proyectos"
JWT_SECRET="TU_SECRETO_SEGURO_DE_AL_MENOS_64_CARACTERES"
JWT_REFRESH_SECRET="TU_REFRESH_SECRET_SEGURO_DE_AL_MENOS_64_CARACTERES"
FRONTEND_URL=https://tu-dominio.com
STORAGE_TYPE=local
```

### 2. Levantar la aplicación completa

```bash
docker compose up -d --build
```

Esto levantará:
- **PostgreSQL** en puerto 5432
- **Adminer** en puerto 8080 (panel de BD)
- **Backend** en puerto 3001
- **Frontend** (Nginx) en puerto 3000

### 3. Verificar que todo está corriendo

```bash
docker compose ps
```

## 🖥️ Deploy en Desarrollo Local (Sin Docker)

### 1. Instalar dependencias

```bash
# Backend
cd apps/backend
npm install
npm run build

# Frontend
cd ../frontend
npm install
npm run build
```

### 2. Configurar Base de Datos

Crear archivo `.env` en `apps/backend/`:

```bash
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/gastos_proyectos"
JWT_SECRET="tu_secreto_aqui"
```

### 3. Ejecutar migraciones

```bash
cd apps/backend
npx prisma migrate deploy
```

### 4. Levantar Backend

```bash
cd apps/backend
npm run start
```

El backend estará disponible en `http://localhost:3001`

### 5. Levantar Frontend (en otra terminal)

```bash
cd apps/frontend
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

## 🌐 Deploy en Producción (Railway/Render/Heroku)

### Variables de Entorno Requeridas

```
DATABASE_URL=postgresql://...
JWT_SECRET=secreto_largo_seguro_al_menos_64_caracteres
JWT_REFRESH_SECRET=refresh_secreto_largo_seguro_64_caracteres
FRONTEND_URL=https://tu-dominio-produccion.com
NODE_ENV=production
STORAGE_TYPE=s3  # o local
```

### Para AWS S3 (Recomendado para Producción)

```
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
AWS_BUCKET_NAME=tu-bucket-name
AWS_REGION=us-east-1
STORAGE_TYPE=s3
```

## 📚 Endpoints Principales

### Backend API
- URL Base: `http://localhost:3001/api/v1`
- Docs: Swagger disponible en `/api-docs`

### Rutas de Autenticación
- `POST /auth/login` - Iniciar sesión
- `POST /auth/forgot-password` - Solicitar reset de contraseña (NUEVO)
- `POST /auth/reset-password` - Cambiar contraseña con token (NUEVO)
- `POST /auth/refresh` - Refrescar token
- `POST /auth/logout` - Cerrar sesión

### Rutas del Frontend
- `/login` - Página de login
- `/forgot-password` - Solicitar reset (NUEVO)
- `/reset-password?token=xxx` - Cambiar contraseña (NUEVO)
- `/` - Dashboard (requiere autenticación)

## 🔧 Solución de Problemas

### Error: "Database connection failed"
- Verificar que PostgreSQL está corriendo
- Verificar DATABASE_URL en .env
- Ejecutar: `npx prisma migrate deploy`

### Error: "Cannot GET /reset-password"
- Asegurarse de que el frontend está compilado
- El token debe venir en el URL: `/reset-password?token=valor`

### Frontend muestra error 404 en reset-password
- Verificar que las rutas están definidas en `main.tsx`
- Limpiar caché del navegador

## 📝 Notas Importantes

1. **JWT_SECRET**: Usar un valor aleatorio de al menos 64 caracteres en producción
2. **FRONTEND_URL**: Configurar con la URL real en producción
3. **Tokens de Reset**: Expiran en 1 hora por seguridad
4. **Migraciones**: Ejecutar automáticamente al iniciar el backend (Docker)

## 🔒 Seguridad

- Los .env con secretos NO se deben commitear (están en .gitignore)
- Usar variables de entorno seguras en cada plataforma
- Rotar JWT_SECRET periódicamente
- Monitorear logs del backend en producción

## 📞 Contacto

Para reportar problemas con el deploy, revisar los logs:

```bash
# Docker
docker compose logs backend
docker compose logs frontend
docker compose logs postgres

# Desarrollo local
cat /tmp/backend.log
```
