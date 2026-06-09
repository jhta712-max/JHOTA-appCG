# DATABASE/ — Reglas locales

## Qué va aquí
BD schema, migraciones, relaciones críticas, notas de estructura.

## Convenciones

**Nombre de archivos:**
- `SCHEMA_OVERVIEW.md` — Diagrama o tabla de modelos
- `CRITICAL_RELATIONSHIPS.md` — Foreign keys importantes
- `MIGRATIONS_PENDING.md` — Por ejecutar
- `SEED_DATA.md` — Roles, categorías, datos iniciales

**Contenido:**
- Nombres exactos de tablas/columnas
- Tipos de datos (INT, VARCHAR, TIMESTAMP, etc.)
- Indexes y constraints
- Relaciones (1:1, 1:N, N:N)

## NO toques
- No cambies schema.prisma directamente aquí (va en /apps/backend/prisma/)
- Solo DOCUMENTA lo que está en prisma/schema.prisma
- No inventes campos "futuros"

## Objetivo
Que se vea el modelo de datos sin abrir Prisma Studio.
