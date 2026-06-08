# DEPLOYMENT/ — Reglas locales

## Qué va aquí
Procedimientos, guías y checklists concretos: cómo deployear, pre-deploy checks, y configuración de Render.

## Convenciones

**Nombre de archivos:**
- `DEPLOY_CHECKLIST.md` — Pasos antes de CADA push a main
- `DOCKER_GUIDE.md` — Explicación de Dockerfiles y multi-stage builds
- `RENDER_CONFIG.md` — Variables, servicios, webhooks
- `DOCKER_PROBLEMS.md` — Problemas Docker vistos + soluciones

**Contenido:**
- Pasos numerados (1, 2, 3, etc.)
- Comandos exactos con ruta completa
- Salidas esperadas (✅ qué significa "éxito")
- Links a TROUBLESHOOTING/ si aplica

## NO toques
- No cambies checklist sin probar primero
- No elimines problemas resueltos (son referencia)
- No agregues pasos "opcionales" (no se siguen)

## Objetivo
Que ANY dev pueda hacer deploy sin romper nada.
