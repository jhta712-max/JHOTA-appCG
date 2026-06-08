# AUDITS/ — Reglas locales

## Qué va aquí
Reportes de auditoría: evaluaciones de código, infraestructura, seguridad, arquitectura.

## Convenciones

**Nombre de archivos:**
- `CODEBASE_AUDIT_YYYY-MM-DD.md` — Revisión general
- `DOCKER_AUDIT.md` — Evalúa Dockerfiles, compose, images
- `SECURITY_AUDIT.md` — Secrets, env vars, vulnerabilities
- `PERFORMANCE_AUDIT.md` — DB queries, bundle size

**Estructura:**

```markdown
## [Aspecto evaluado]

### Hallazgo
✅ Qué está bien
⚠️ Qué podría mejorar
❌ Qué está roto

### Riesgo
Impacto si no se arregla

### Acción
Pasos para resolver (o "No action needed")
```

## NO toques
- No elimines auditorías pasadas (son historial)
- No hagas recomendaciones sin evidencia
- No mezcles hallazgos con opiniones

## Objetivo
Que se vea el estado de salud de la app en un snapshot.
