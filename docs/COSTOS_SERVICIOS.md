# COSTOS DE SERVICIOS — SERVINGMI

> Actualizado: 2026-06-05 | Moneda: USD

## Resumen

| Servicio                   | Proveedor    | Costo mensual | Día de cobro | Método de pago       |
|---------------------------|--------------|---------------|--------------|----------------------|
| Backend (Standard)         | Render       | $7.00         | 1            | Tarjeta de crédito   |
| Frontend (Standard)        | Render       | $7.00         | 1            | Tarjeta de crédito   |
| PostgreSQL (Standard)      | Render       | $9.00         | 1            | Tarjeta de crédito   |
| GitHub                     | GitHub       | $0.00         | 1            | N/A (plan Free)      |
| WhatsApp — Twilio          | Twilio       | Variable      | 1            | Tarjeta de crédito   |
| Cron-job.org               | Cron-job.org | $0.00         | —            | N/A (plan Free)      |
| OCR con IA (Claude API)    | Anthropic    | Variable      | 1            | Tarjeta de crédito   |

**Total fijo mensual: ~$23.00 USD**

---

## Desglose por proveedor

### Render ($23.00/mes fijos)
| Servicio        | Plan     | Costo  | Notas                                    |
|----------------|----------|--------|------------------------------------------|
| Backend        | Standard | $7.00  | Express/Node.js, auto-deploy desde main  |
| Frontend       | Standard | $7.00  | Vite/React, CDN global incluido          |
| PostgreSQL DB  | Standard | $9.00  | 1GB RAM, backups automáticos             |

- **Dashboard:** https://dashboard.render.com
- **Ciclo de facturación:** mensual, día 1 de cada mes
- **Método de pago:** Tarjeta de crédito

### GitHub ($0.00 — Plan Free)
- Repositorio privado incluido en plan Free
- Hasta 3 colaboradores sin costo
- Si se necesitan más colaboradores: Pro $4.00/usuario/mes
- **Panel:** https://github.com/settings/billing

### Twilio — WhatsApp (Variable)
- Sin costo fijo mensual
- Costo por mensaje enviado: ~$0.005 USD
- Se usa solo para notificaciones WhatsApp (alertas de presupuesto, órdenes pendientes, nóminas)
- **Dashboard:** https://console.twilio.com

### Cron-job.org ($0.00 — Plan Free)
- Usado para el job diario de backup de base de datos (POST /api/v1/backup/auto)
- Plan Free: hasta 5 cron jobs, ejecución mínima cada 1 minuto
- **Panel:** https://cron-job.org/en/members/

### Anthropic — Claude API (Variable)
- Sin costo fijo mensual
- Pago por token usado
- Se usa solo cuando un usuario analiza una factura con el botón "Analizar con IA"
- **Dashboard:** https://console.anthropic.com

---

## Estimado mensual total

| Concepto             | Estimado USD |
|---------------------|-------------|
| Render (fijo)        | $23.00      |
| GitHub               | $0.00       |
| Twilio (variable)    | < $1.00     |
| Anthropic (variable) | < $1.00     |
| **TOTAL estimado**   | **~$25.00** |

---

## Gestión de costos en la app

Los costos de servicio se pueden gestionar desde el módulo de **Monitoreo** en la pestaña **Suscripciones**. Desde ahí se puede:
- Ver todos los servicios y sus costos
- Agregar nuevos servicios cuando se contrate algo nuevo
- Recibir notificaciones automáticas 7 días antes del vencimiento de cada pago
- Descargar el listado en CSV

---

*Este documento se actualiza automáticamente cuando se agregan nuevos servicios desde el módulo de Monitoreo.*
