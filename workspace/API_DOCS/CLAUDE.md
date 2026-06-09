# API_DOCS/ — Reglas locales

## Qué va aquí
Endpoints documentados: qué hace, request/response, validaciones, ejemplos.

## Convenciones

**Nombre de archivos:**
- `[MODULO]_ENDPOINTS.md` — Auth, Payroll, Expenses, etc.
- `REQUEST_VALIDATION.md` — Schemas Zod, reglas
- `ERROR_RESPONSES.md` — Códigos de error

**Estructura de endpoint:**

```markdown
## POST /api/v1/payrolls

**Description:** Crear nómina

**Request:**
```json
{
  "projectId": 1,
  "periodStart": "2026-01-01",
  "periodEnd": "2026-01-31"
}
```

**Response (201):**
```json
{
  "id": 123,
  "status": "DRAFT"
}
```

**Validations:**
- projectId must exist
- Status must be DRAFT or APPROVED

**Auth:** Requires admin or supervisor
```

## NO toques
- No documentes endpoints que NO existan
- No cambies aquí — cambios van en código primero
- Mantén sync con apps/backend/src/modules/*/router.ts

## Objetivo
Que frontend dev sepa qué esperar de cada endpoint.
