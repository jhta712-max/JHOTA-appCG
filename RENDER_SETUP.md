# Guía de Deploy en Render

## 📋 Prerrequisitos

- Cuenta en [Render.com](https://render.com)
- Repositorio Git (GitHub, GitLab, Gitea)
- Acceso a credenciales para variables sensibles

## 🚀 Opción 1: Deploy Automático con render.yaml (Recomendado)

### 1. Conectar repositorio en Render

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Haz clic en **"New +"** → **"Blueprint"**
3. Selecciona tu repositorio Git
4. Selecciona rama `main`
5. Render detectará automáticamente `render.yaml`

### 2. Configurar Variables de Entorno

Render te pedirá que establezca variables con `sync: false`. Debes setearlas manualmente:

**En el Dashboard de Render:**

1. Ve a tu servicio Backend
2. Haz clic en **"Environment"**
3. Agrega estas variables:

```
JWT_SECRET=tu_secreto_muy_largo_de_minimo_64_caracteres_aqui
JWT_REFRESH_SECRET=tu_refresh_secreto_muy_largo_de_minimo_64_caracteres
```

**Generar secretos seguros:**

```bash
# En bash/zsh
openssl rand -base64 64
```

### 3. Verificar Database Connection

La BD se crea automáticamente. Render inyectará `DATABASE_URL` automáticamente.

### 4. Deploy

Haz clic en **"Deploy Blueprint"**. Render ejecutará:

```
1. Crear BD PostgreSQL
2. Build Backend
3. Build Frontend
4. Deploy automático con cualquier push a main
```

---

## 🖥️ Opción 2: Deploy Manual (Sin Blueprint)

### 1. Crear servicio Base de Datos

1. **"New +"** → **"PostgreSQL"**
2. Configurar:
   - Name: `servingmi-postgres`
   - Region: `Ohio` (o tu región)
   - PostgreSQL Version: `16`
   - Database: `gastos_proyectos`
   - User: `gastos_user`

3. Render creará automáticamente una contraseña
4. Copiar el **Internal Database URL** para después

### 2. Crear servicio Backend

1. **"New +"** → **"Web Service"**
2. Conectar tu repositorio
3. Configurar:
   - **Name:** `servingmi-backend`
   - **Region:** `Ohio`
   - **Runtime:** `Node`
   - **Root Directory:** `apps/backend`
   - **Build Command:** `npm ci && npx prisma generate && npm run build`
   - **Start Command:** `npx prisma migrate deploy && node dist/server.js`

4. **Environment:**
   ```
   NODE_ENV=production
   JWT_SECRET=<secreto_seguro>
   JWT_REFRESH_SECRET=<refresh_secreto_seguro>
   FRONTEND_URL=https://servingmi-frontend.onrender.com
   STORAGE_TYPE=local
   LOG_LEVEL=info
   ```

5. **Database:** Conectar a `servingmi-postgres` (Render inyectará DATABASE_URL)

6. Deploy

### 3. Crear servicio Frontend

1. **"New +"** → **"Web Service"**
2. Conectar repositorio
3. Configurar:
   - **Name:** `servingmi-frontend`
   - **Region:** `Ohio`
   - **Runtime:** `Docker`
   - **Root Directory:** `apps/frontend`

4. **Environment:**
   ```
   VITE_API_URL=https://servingmi-backend.onrender.com/api/v1
   ```

5. Deploy

---

## 🔐 Variables de Entorno Críticas

| Variable | Ejemplo | Requerida |
|----------|---------|-----------|
| `JWT_SECRET` | `openssl rand -base64 64` | ✅ Sí |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 64` | ✅ Sí |
| `FRONTEND_URL` | `https://tu-frontend.onrender.com` | ✅ Sí |
| `VITE_API_URL` | `https://tu-backend.onrender.com/api/v1` | ✅ Sí |
| `NODE_ENV` | `production` | ✅ Sí |

## 📊 URLs Después del Deploy

Una vez deployado, obtendrás URLs como:

- **Frontend:** `https://servingmi-frontend.onrender.com`
- **Backend:** `https://servingmi-backend.onrender.com`
- **Database:** `postgresql://gastos_user:...@dpg-xxxxx.xxx.render.com/gastos_proyectos`

## ✅ Verificaciones Post-Deploy

### Verificar Frontend
```bash
curl https://servingmi-frontend.onrender.com
```

### Verificar Backend
```bash
curl https://servingmi-backend.onrender.com/api/v1/health
```

### Verificar Base de Datos (en Backend logs)
```
Prisma migrations: ✓ Applied
Database connection: ✓ Connected
```

## 🔧 Troubleshooting

### Error: "Cannot find module"

**Causa:** `package-lock.json` no está sincronizado
**Solución:**
```bash
npm ci  # En lugar de npm install
```

### Error: "DATABASE_URL not found"

**Causa:** BD no conectada al servicio Backend
**Solución:**
1. En el servicio Backend, ir a **"Environment"**
2. Verificar que DATABASE_URL existe
3. Render inyecta automáticamente si la BD está conectada

### Error: "CORS error"

**Causa:** FRONTEND_URL no coincide
**Solución:**
1. Backend debe tener `FRONTEND_URL=https://tu-frontend-real.onrender.com`
2. Redeploy Backend

### Error: "Build failed"

**Verificar:**
1. `npm run build` funciona localmente
2. `render.yaml` tiene sintaxis correcta
3. `rootDir` apunta al directorio correcto

## 📝 Ciclo de Deploy

```
1. Push a main
   ↓
2. Render detecta cambio
   ↓
3. Build servicios
   ↓
4. Ejecutar migraciones (BD)
   ↓
5. Deploy Frontend + Backend
   ↓
6. Health checks
   ↓
7. ✅ En vivo
```

## 🔄 Redeploy Manual

Si necesitas forzar un redeploy sin cambios de código:

1. Dashboard → Servicio
2. Haz clic en **"Manual Deploy"** → **"Deploy latest commit"**

## 💰 Pricing

- **PostgreSQL:** $9/mes (plan standard)
- **Backend:** $7/mes (plan standard)
- **Frontend:** $7/mes (plan standard)
- **Total:** ~$23/mes

Render ofrece tier gratuito limitado para pruebas.

## 🆘 Soporte

- Docs: https://render.com/docs
- Status: https://status.render.com
- Email: support@render.com

---

## ✨ Próximos Pasos

1. ✅ Crear cuenta Render
2. ✅ Conectar repositorio
3. ✅ Desplegar con Blueprint o manual
4. ✅ Configurar variables secretas
5. ✅ Verificar que todo funciona
6. ✅ Eliminar Railway (si ya no lo usas)
