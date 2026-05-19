# Sistema de Control de Gastos por Proyectos

Sistema interno empresarial para control de gastos de proyectos de construcción/operaciones.

---

## Requisitos previos

Instala estas herramientas antes de comenzar:

| Herramienta | Link de descarga | Versión mínima |
|---|---|---|
| **Node.js** | https://nodejs.org (descargar LTS) | 20.x |
| **pnpm** | `npm install -g pnpm` | 8.x |
| **Docker Desktop** | https://www.docker.com/products/docker-desktop | cualquier reciente |
| **Git** | https://git-scm.com | cualquier reciente |

---

## Instalación y primer arranque

### 1. Copiar variables de entorno

```bash
cd apps/backend
cp .env.example .env
```

No necesitas cambiar nada para desarrollo local — los valores por defecto funcionan con Docker.

### 2. Levantar la base de datos (PostgreSQL)

```bash
# Desde la raíz del proyecto
docker-compose up -d
```

Esto levanta PostgreSQL en el puerto 5432 y Adminer (interfaz web de BD) en http://localhost:8080.

Para entrar a Adminer:
- System: PostgreSQL
- Server: postgres
- Username: gastos_user
- Password: gastos_pass_local
- Database: gastos_proyectos

### 3. Instalar dependencias

```bash
# Desde la raíz del proyecto
pnpm install
```

### 4. Generar el cliente Prisma y ejecutar migraciones

```bash
cd apps/backend
pnpm db:generate
pnpm db:migrate
```

### 5. Cargar datos iniciales (roles, categorías, usuario admin)

```bash
pnpm db:seed
```

Esto crea:
- Roles: admin, supervisor, operator
- 8 categorías de gasto del sistema
- Usuario administrador inicial:
  - Email: `admin@gastos.local`
  - Password: `Admin@2026!` ← **CAMBIAR EN PRIMER LOGIN**

### 6. Iniciar el servidor backend

```bash
pnpm dev
```

El servidor arranca en http://localhost:3001

Verifica que funciona: http://localhost:3001/health

---

## Verificar el sistema de autenticación

```bash
# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gastos.local","password":"Admin@2026!"}'

# Respuesta esperada:
# {
#   "success": true,
#   "data": {
#     "accessToken": "eyJ...",
#     "refreshToken": "eyJ...",
#     "user": { "id": "...", "name": "Administrador", "role": "admin" }
#   }
# }
```

---

## Estructura del proyecto

```
gastos-proyectos/
├── apps/
│   ├── backend/          ← API REST (Node.js + Express + TypeScript)
│   │   ├── prisma/       ← Schema de base de datos y seed
│   │   └── src/
│   │       ├── config/   ← BD, variables de entorno
│   │       ├── modules/  ← auth, projects, expenses, etc.
│   │       ├── middlewares/
│   │       └── utils/
│   └── frontend/         ← (Etapa 3)
├── docker-compose.yml    ← PostgreSQL + Adminer
└── README.md
```

---

## Comandos útiles

```bash
# Levantar/bajar base de datos
docker-compose up -d
docker-compose down

# Ver base de datos en el navegador (Prisma Studio)
cd apps/backend && pnpm db:studio   # → http://localhost:5555

# Nueva migración (cuando cambias el schema)
cd apps/backend && pnpm db:migrate

# Recargar datos semilla
cd apps/backend && pnpm db:seed
```

---

## Etapas de desarrollo

- [x] **Etapa 1** — Fundación: BD, backend base, autenticación JWT ← *aquí estamos*
- [ ] **Etapa 2** — Core API: CRUD proyectos, gastos, comprobantes fiscales
- [ ] **Etapa 3** — Frontend responsive (React + TailwindCSS)
- [ ] **Etapa 4** — Dashboard y reportes PDF/Excel
- [ ] **Etapa 5** — Despliegue en servidor/nube
