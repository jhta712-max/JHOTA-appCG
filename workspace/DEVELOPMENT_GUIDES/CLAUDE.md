# DEVELOPMENT_GUIDES/ — Reglas locales

## Qué va aquí
Cómo hacer cosas específicas: agregar módulos, cambiar BD, agregar features, patrones de código.

## Convenciones

**Nombre de archivos:**
- `ADDING_NEW_MODULE.md` — Paso a paso completo
- `ADDING_DATABASE_FIELD.md` — Schema → migrate → API
- `CODE_PATTERNS.md` — useQuery, useMutation, error handling
- `PNPM_WORKSPACE.md` — Cómo funciona el monorepo

**Contenido:**
- Estructura de carpetas con barras (`modules/x/`)
- Código completo (no fragmentos)
- Paths absolutos o relativos claros
- Checklist final (qué hacer después)

## NO toques
- No hagas guías "teóricas" sin ejemplo concreto
- No saltes pasos ("obvio" no es obvio para el que viene después)
- No cambies nombres de carpetas/archivos sin actualizar TODOS los lugares

## Objetivo
Que alguien sin contexto pueda seguir paso a paso sin ambigüedad.
