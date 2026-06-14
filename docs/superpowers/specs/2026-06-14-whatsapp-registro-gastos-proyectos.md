# WhatsApp — Registro de Gastos y Proyectos vía Mensajes

> **Estado:** IDEA PENDIENTE — no implementar hasta que se decida explícitamente.

## Objetivo

Módulo de integración con WhatsApp que permita registrar gastos, crear proyectos y consultar información básica utilizando mensajes de texto en lenguaje natural. WhatsApp actúa únicamente como canal de captura; toda la lógica de negocio sigue en la aplicación y el agente de IA nunca escribe directamente en la BD.

## Principios de Diseño

1. WhatsApp = canal de captura y consulta, no de procesamiento
2. Toda la lógica ejecuta dentro de la aplicación existente
3. El agente IA **nunca** escribe directo en BD — solo consume endpoints existentes
4. Todas las operaciones consumen los endpoints actuales del backend
5. Trazabilidad completa de cada interacción recibida

## Funcionalidades Iniciales

### Crear Proyecto

Ejemplos de mensajes:
- "Crear proyecto Torre Norte"
- "Nuevo proyecto Residencial Vista Mar"

IA identifica: nombre del proyecto  
Ejecuta: `POST /api/projects { "name": "Torre Norte" }`

### Registrar Gasto

Ejemplos:
- "Gasto 2500 cemento Proyecto Torre Norte"
- "Registra gasto de 5000 mano de obra en Torre Norte"

IA identifica: proyecto, monto, concepto, categoría  
Ejecuta:
```json
POST /api/expenses
{
  "projectId": "uuid",
  "description": "Compra de cemento",
  "category": "MATERIAL",
  "amount": 2500,
  "source": "WHATSAPP"
}
```

### Consulta de Proyecto

Ejemplos:
- "Balance Torre Norte"
- "Gastos de Torre Norte"
- "Presupuesto consumido Torre Norte"

IA consulta endpoints existentes y responde con resumen amigable.

## Flujo de Arquitectura

```
WhatsApp → Webhook → Servicio de Mensajes → Agente IA → API Interna → Base de Datos
```

## Nuevas Entidades (Prisma)

### WhatsAppConversation
- id, phoneNumber, userId (FK), createdAt, updatedAt, status

### WhatsAppMessage
- id, conversationId (FK), direction (incoming/outgoing), content, aiIntent, processed, createdAt

### WhatsAppAuditLog
- id, action, entityType, entityId, requestPayload, responsePayload, createdAt

## Motor de Intenciones

| Intención | Triggers |
|---|---|
| `CREATE_PROJECT` | "Crear proyecto", "Nuevo proyecto" |
| `CREATE_EXPENSE` | "Registrar gasto", "Gasto", "Compré" |
| `PROJECT_BALANCE` | "Balance", "Estado financiero" |
| `PROJECT_EXPENSES` | "Ver gastos", "Gastos del proyecto" |

## Flujo de Confirmación

Toda operación financiera requiere confirmación explícita antes de ejecutar:

```
Usuario: "Gasto 8000 cemento Torre Norte"
IA:      "Voy a registrar:
          Proyecto: Torre Norte | Categoría: Materiales | Monto: RD$8,000
          ¿Confirmar? (Sí/No)"
```

Solo ejecutar cuando el usuario responda "Sí".

## Manejo de Contexto Multi-turno

Mantener contexto temporal por conversación:

```
Usuario: "Gasto 3000"
IA:      "¿Para qué proyecto?"
Usuario: "Torre Norte"
IA:      "¿Concepto?"
Usuario: "Mano de obra"
IA:      "¿Confirmar RD$3,000 mano de obra en Torre Norte? (Sí/No)"
```

## Fase 2 — OCR para Facturas

Cuando el usuario envíe una imagen:
1. Detectar y extraer texto (monto, fecha, suplidor)
2. Solicitar proyecto asociado
3. Confirmar antes de registrar

## Requisitos Técnicos

- Compatibilidad total con estructura actual — no modificar flujos existentes de gastos/proyectos
- Servicios desacoplados (nuevo módulo `whatsapp/` en backend)
- Logs completos + manejo de errores + reintentos automáticos
- Arquitectura preparada para futuras integraciones: correo electrónico, asistentes de voz
- Proveedor actual: UltraMsg (ya integrado para notificaciones salientes)

## Integración con Stack Actual

- Backend: nuevo módulo `apps/backend/src/modules/whatsapp/`
- Webhook: `POST /api/v1/whatsapp/webhook` (validar firma UltraMsg)
- Agente IA: Claude API con tool_use → llama endpoints internos
- Autenticación interna: JWT de sistema con rol `WHATSAPP_BOT`
- Notificaciones existentes en `notifications.service.ts` no se tocan

## Resultado Esperado

Un usuario puede crear proyectos y registrar gastos desde WhatsApp en lenguaje natural. La aplicación sigue siendo la única fuente de verdad para gestión financiera y operativa.
