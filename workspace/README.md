# ServingMI Workspace — Guía de navegación

Este directorio organiza notas, documentación y tareas de desarrollo para el proyecto ServingMI.

---

## 📝 SESSION_NOTES/

**Qué va:** Notas, decisiones y hallazgos de cada sesión de trabajo con Claude.

Ejemplos:
- `SESSION_2026-06-08.md` — Deploy fixes, Docker troubleshooting
- `KEY_DECISIONS.md` — Decisiones importantes tomadas
- `LEARNINGS.md` — Cosas aprendidas sobre la arquitectura

---

## 🔍 AUDITS/

**Qué va:** Reportes de auditoría, análisis de código, evaluaciones de salud de la aplicación.

Ejemplos:
- `CODEBASE_AUDIT_2026-06-08.md` — Auditoría completa de código/infraestructura
- `DOCKER_AUDIT.md` — Evaluación de Dockerfiles y deploy
- `SECURITY_AUDIT.md` — Revisión de secrets, env vars, vulnerabilidades

---

## 🐳 DEPLOYMENT/

**Qué va:** Guías Docker, configuración Render, troubleshooting de deploy, guías paso a paso.

Ejemplos:
- `DOCKER_GUIDE.md` — Cómo funcionan los Dockerfiles, multi-stage builds
- `RENDER_CONFIG.md` — Cómo configurar variables, webhooks, pre-deploy commands
- `DEPLOY_CHECKLIST.md` — Pasos antes de cada push a main
- `DOCKER_PROBLEMS.md` — Problemas comunes y cómo resolverlos

---

## 🎨 FRONTEND_TASKS/

**Qué va:** Tareas pendientes de rediseño frontend, especificaciones de UI, estado de progreso.

Ejemplos:
- `REDESIGN_DASHBOARD.md` — Especificación de nuevo dashboard
- `REDESIGN_LOGIN.md` — Login page redesign spec
- `COMPONENT_LIBRARY.md` — Componentes reutilizables definidos
- `PROGRESS.md` — Qué está hecho, qué falta

---

## 💾 DATABASE/

**Qué va:** Schema diagrams, migraciones pendientes, relaciones críticas, notas sobre BD.

Ejemplos:
- `SCHEMA_OVERVIEW.md` — Diagrama de tablas y relaciones
- `MIGRATIONS_PENDING.md` — Migraciones aún por ejecutar
- `CRITICAL_RELATIONSHIPS.md` — Foreign keys importantes (ej: PaymentOrder → Payroll)
- `SEED_DATA.md` — Categorías, roles, datos iniciales

---

## 🔌 API_DOCS/

**Qué va:** Endpoints documentados, request/response examples, validaciones.

Ejemplos:
- `AUTH_ENDPOINTS.md` — Login, refresh token, logout
- `PAYROLL_ENDPOINTS.md` — Crear nómina, vincular órdenes, exportar
- `REQUEST_VALIDATION.md` — Schemas Zod, límites, reglas
- `ERROR_RESPONSES.md` — Códigos de error, qué significa cada uno

---

## ⚠️ TROUBLESHOOTING/

**Qué va:** Problemas conocidos, soluciones testeadas, gotchas de la app.

Ejemplos:
- `DOCKER_ISSUES.md` — "Cannot find module zod", "libquery_engine not found"
- `RENDER_ISSUES.md` — Deploy fallos, webhook problems, cache issues
- `PRISMA_ISSUES.md` — Binary targets, migrations, client generation
- `FRONTEND_ISSUES.md` — State management bugs, routing issues

---

## 📚 DEVELOPMENT_GUIDES/

**Qué va:** Patrones de código, cómo hacer X, mejores prácticas, snippets.

Ejemplos:
- `ADDING_NEW_MODULE.md` — Paso a paso para crear un módulo (router, controller, service)
- `ADDING_DATABASE_FIELD.md` — Schema → migration → seed → API endpoint
- `CODE_PATTERNS.md` — Error handling, queries, mutations, invalidation
- `FRONTEND_PATTERNS.md` — useRole(), useQuery, useMutation patterns
- `PNPM_WORKSPACE.md` — Cómo funciona el monorepo, common issues

---

## Cómo usar este workspace

1. **Al empezar una sesión:** Lee `SESSION_NOTES/` para contexto anterior
2. **Cuando encuentres un problema:** Busca en `TROUBLESHOOTING/`
3. **Para agregar una feature:** Lee `DEVELOPMENT_GUIDES/`
4. **Antes de deployear:** Consulta `DEPLOYMENT/DEPLOY_CHECKLIST.md`
5. **Para entender la BD:** Abre `DATABASE/SCHEMA_OVERVIEW.md`

**Cada carpeta tiene `CLAUDE.md` con sus reglas locales** — léelo primero al entrar a esa carpeta.

---

## Convención de nombres

- Archivos: `TOPIC_SUBTOPIC.md` o `TOPIC_DATE.md`
- Títulos: Usar `# Main Topic` y `## Subtopic`
- Listas: Usar ejemplos concretos, no teóricos
- Código: Siempre marcar qué archivo y línea aproximada

---

**Última actualización:** 2026-06-08
