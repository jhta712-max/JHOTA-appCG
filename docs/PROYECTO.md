# ServingMI — Sistema de Control de Gastos de Construcción

## ¿Qué hace este sistema?

Sistema ERP para empresas de construcción que permite controlar:
- **Gastos** de proyectos (materiales, servicios, mano de obra)
- **Nóminas** de trabajadores y subcontratistas
- **Órdenes de pago** con flujo de aprobación
- **Cotizaciones** de suplidores
- **Presupuestos** por proyecto con alertas de desbordamiento
- **Reportes** y exportaciones a Excel/Word
- **Comprobantes fiscales** (NCF/RNC para la DGII)

---

## Tecnologías usadas

| Parte       | Tecnología                          | Para qué                           |
|-------------|-------------------------------------|------------------------------------|
| Base de datos | PostgreSQL                        | Guarda todos los datos             |
| Backend     | Node.js + Express + Prisma          | API que procesa la lógica          |
| Frontend    | React + TypeScript + Tailwind CSS   | La interfaz web                    |
| Deploy      | Render.com                          | Hosting en la nube                 |
| OCR/IA      | Google Vision + Claude AI           | Análisis de recibos por foto       |

---

## Estructura de carpetas

```
servingmi-appCG/                  ← Raíz del proyecto
├── apps/
│   ├── backend/                  ← API y base de datos
│   │   ├── src/
│   │   │   └── modules/          ← Lógica de negocio por módulo
│   │   └── prisma/
│   │       ├── schema.prisma     ← Estructura de la base de datos
│   │       ├── migrations/       ← Historial de cambios en la BD
│   │       └── seed.ts           ← Datos iniciales (roles, categorías)
│   └── frontend/                 ← Interfaz web
│       └── src/
│           ├── pages/            ← Pantallas de la app
│           ├── components/       ← Componentes reutilizables
│           ├── hooks/            ← useRole (permisos por rol)
│           ├── stores/           ← Estado global (autenticación)
│           └── api/              ← Conexión con el backend
├── docs/                         ← Esta documentación
│   ├── PROYECTO.md               ← Este archivo
│   ├── COMANDOS.md               ← Comandos con directorios
│   ├── ROLES.md                  ← Permisos por rol
│   └── FLUJOS.md                 ← Flujos de negocio
├── scripts/
│   └── sql/                      ← Scripts SQL de mantenimiento de BD
├── data/
│   └── gastos/                   ← Archivos CSV con datos históricos
├── templates/
│   └── orden-de-pago.html        ← Plantilla HTML de órdenes de pago
├── CLAUDE.md                     ← Instrucciones para el asistente IA
├── docker-compose.yml            ← Base de datos local
└── render.yaml                   ← Configuración de Render
```

---

## URLs importantes

| Ambiente    | URL                                    | Para qué                    |
|-------------|----------------------------------------|-----------------------------|
| Producción  | (configurada en Render)                | App en vivo                 |
| Local API   | http://localhost:3000                  | Backend local               |
| Local Web   | http://localhost:5173                  | Frontend local              |
| Adminer BD  | http://localhost:8080                  | Ver/editar BD visualmente   |
| Prisma UI   | http://localhost:5555                  | Ver BD con Prisma Studio    |

---

## Deploy en Render

El sistema tiene **deploy automático**:
1. Se hace `git push origin main`
2. Render detecta el cambio
3. Compila y despliega backend y frontend automáticamente
4. El proceso tarda ~3-5 minutos

Ver el estado del deploy: Panel de Render → servingmi-backend / servingmi-frontend

---

## Módulos del sistema

| Módulo           | Ruta en la app         | Descripción                          |
|-----------------|------------------------|--------------------------------------|
| Dashboard        | `/`                   | Resumen general y estadísticas        |
| Proyectos        | `/projects`           | Lista y detalle de proyectos          |
| Gastos           | `/expenses`           | Registro y seguimiento de gastos      |
| Cotizaciones     | `/quotations`         | Gestión de cotizaciones               |
| Nóminas          | `/payrolls`           | Nóminas de trabajadores               |
| Órd. de Pago     | `/payment-orders`     | Órdenes de pago completas             |
| Pagos Pendientes | `/pending-orders`     | Bandeja del auxiliar                  |
| Gastos Oficina   | `/office-expenses`    | Gastos administrativos                |
| Reportes         | `/reports`            | Análisis y exportaciones              |
| Exportar Excel   | `/export`             | Exportación masiva                    |
| Usuarios         | `/users`              | Gestión de usuarios (admin)           |
| Categorías       | `/categories`         | Categorías de gastos (admin)          |
| Tarjetas         | `/cards`              | Tarjetas corporativas (admin)         |
| Monitoreo        | `/monitoring`         | Estado del sistema (admin)            |
