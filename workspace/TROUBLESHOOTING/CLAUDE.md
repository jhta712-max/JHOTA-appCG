# TROUBLESHOOTING/ — Reglas locales

## Qué va aquí
Problemas reales encontrados + soluciones testeadas. No teoría, solo hechos observados.

## Convenciones

**Nombre de archivos:**
- `DOCKER_ISSUES.md` — Errores en Docker build/runtime
- `RENDER_ISSUES.md` — Deploy fails, webhooks, vars
- `PRISMA_ISSUES.md` — DB migrations, binary targets
- `FRONTEND_ISSUES.md` — State, routing, component issues

**Estructura de cada problema:**

```markdown
## "Error message exacto"

**Error:**
[Copiar/pegar error completo]

**Causa:**
Una línea: por qué pasa

**Solución:**
1. Paso exacto
2. Comando exacto
3. Qué esperar

**Prevención:**
Cómo NO volver a verlo
```

## NO toques
- No borres problemas resueltos
- No agregues "podría" o "tal vez" — solo hechos
- No refierase a otros archivos sin link exacto

## Objetivo
Copy-paste solution en < 2 minutos.
