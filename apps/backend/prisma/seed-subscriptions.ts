/**
 * Seed inicial de suscripciones de servicios.
 * Ejecutar UNA sola vez desde apps/backend:
 *   npx ts-node prisma/seed-subscriptions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const subscriptions = [
  {
    name:          'Backend (Standard)',
    provider:      'Render',
    description:   'Servidor Express/Node.js — plan Standard',
    monthlyCost:   7.00,
    currency:      'USD',
    billingDay:    1,
    paymentMethod: 'Tarjeta de crédito',
    url:           'https://dashboard.render.com',
    notes:         'Auto-deploy desde rama main',
  },
  {
    name:          'Frontend (Standard)',
    provider:      'Render',
    description:   'Servidor estático Vite/React — plan Standard',
    monthlyCost:   7.00,
    currency:      'USD',
    billingDay:    1,
    paymentMethod: 'Tarjeta de crédito',
    url:           'https://dashboard.render.com',
    notes:         'CDN global incluido',
  },
  {
    name:          'PostgreSQL (Standard)',
    provider:      'Render',
    description:   'Base de datos PostgreSQL — plan Standard 1GB RAM',
    monthlyCost:   9.00,
    currency:      'USD',
    billingDay:    1,
    paymentMethod: 'Tarjeta de crédito',
    url:           'https://dashboard.render.com',
    notes:         'Backups automáticos incluidos',
  },
  {
    name:          'GitHub (Free/Pro)',
    provider:      'GitHub',
    description:   'Repositorio privado — verificar plan actual',
    monthlyCost:   0.00,
    currency:      'USD',
    billingDay:    1,
    paymentMethod: 'N/A',
    url:           'https://github.com/settings/billing',
    notes:         'Free plan si repositorio privado ≤ 3 colaboradores. Pro: $4/mes/usuario',
  },
  {
    name:          'WhatsApp (Twilio)',
    provider:      'Twilio',
    description:   'Notificaciones WhatsApp — pago por uso',
    monthlyCost:   0.00,
    currency:      'USD',
    billingDay:    1,
    paymentMethod: 'Tarjeta de crédito',
    url:           'https://console.twilio.com',
    notes:         'Costo variable por mensaje: ~$0.005/msg. Sin costo fijo mensual. Sandbox gratuito en desarrollo.',
  },
  {
    name:          'Cron-job.org',
    provider:      'Cron-job.org',
    description:   'Job programado para backup automático diario',
    monthlyCost:   0.00,
    currency:      'USD',
    billingDay:    1,
    paymentMethod: 'N/A',
    url:           'https://cron-job.org',
    notes:         'Plan gratuito — 5 cron jobs, ejecución cada 1 min',
  },
  {
    name:          'API IA (Claude)',
    provider:      'Anthropic',
    description:   'OCR inteligente de facturas — pago por uso',
    monthlyCost:   0.00,
    currency:      'USD',
    billingDay:    1,
    paymentMethod: 'Tarjeta de crédito',
    url:           'https://console.anthropic.com',
    notes:         'Costo variable por token. Solo se usa cuando se analiza una factura con IA.',
  },
];

async function main() {
  console.log('Seeding service subscriptions...');

  const existing = await prisma.serviceSubscription.count();
  if (existing > 0) {
    console.log(`Already seeded (${existing} records found). Skipping.`);
    return;
  }

  const result = await prisma.serviceSubscription.createMany({ data: subscriptions });
  console.log(`Seeded ${result.count} subscriptions.`);
}

main()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
