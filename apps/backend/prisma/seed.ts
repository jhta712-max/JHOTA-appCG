import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de datos...');

  // ----------------------------------------------------------------
  // 1. ROLES
  // ----------------------------------------------------------------
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        description: 'Administrador del sistema — acceso total',
        permissions: { all: true },
      },
    }),
    prisma.role.upsert({
      where: { name: 'supervisor' },
      update: {},
      create: {
        name: 'supervisor',
        description: 'Supervisor — puede gestionar proyectos y aprobar gastos',
        permissions: {
          projects: { create: true, edit: true, view: true },
          expenses: { create: true, edit: true, view: true, void: true },
          reports: { view: true, export: true },
        },
      },
    }),
    prisma.role.upsert({
      where: { name: 'operator' },
      update: {},
      create: {
        name: 'operator',
        description: 'Operador — ingeniero de campo, registra gastos y nóminas',
        permissions: {
          projects: { view: true },
          expenses: { create: true, edit_own: true, view: true },
          payrolls: { create: true, view: true },
          quotations: { create: true, view: true },
        },
      },
    }),
    prisma.role.upsert({
      where: { name: 'auxiliar' },
      update: {},
      create: {
        name: 'auxiliar',
        description: 'Auxiliar administrativo — procesa órdenes de pago pendientes',
        permissions: {
          paymentOrders: { view: true, markPaid: true },
          beneficiaries: { view: true },
        },
      },
    }),
    prisma.role.upsert({
      where: { name: 'financiero' },
      update: {},
      create: {
        name: 'financiero',
        description: 'Gerente financiero — visibilidad de dashboard, gastos y reportes',
        permissions: {
          projects: { view: true },
          expenses: { view: true },
          reports: { view: true, export: true },
          quotations: { view: true },
          officeExpenses: { view: true },
        },
      },
    }),
  ]);
  console.log(`Roles creados: ${roles.map((r) => r.name).join(', ')}`);

  const adminRole = roles.find((r) => r.name === 'admin')!;

  // ----------------------------------------------------------------
  // 2. USUARIO ADMINISTRADOR INICIAL
  // ----------------------------------------------------------------
  const hashedPassword = await bcrypt.hash('Admin@2026!', 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@gastos.local' },
    update: {},
    create: {
      roleId: adminRole.id,
      name: 'Administrador',
      email: 'admin@gastos.local',
      password: hashedPassword,
      isActive: true,
    },
  });
  console.log(`Usuario admin creado: ${adminUser.email}`);
  console.log('  Email:    admin@gastos.local');
  console.log('  Password: Admin@2026!  <-- CAMBIAR EN PRIMER LOGIN');

  // ----------------------------------------------------------------
  // 3. CATEGORÍAS DE GASTO (sistema — no eliminables)
  // ----------------------------------------------------------------
  const systemCategories = [
    { name: 'Materiales',   description: 'Compra de materiales de construcción y suministros', icon: 'package' },
    { name: 'Servicios',    description: 'Servicios contratados externos', icon: 'wrench' },
    { name: 'Mano de obra', description: 'Pagos a trabajadores y cuadrillas', icon: 'users' },
    { name: 'Equipos',      description: 'Alquiler o compra de equipos y maquinaria', icon: 'settings' },
    { name: 'Transporte',   description: 'Fletes, envíos y traslados', icon: 'truck' },
    { name: 'Combustible',  description: 'Gasolina, gasoil y lubricantes', icon: 'fuel' },
    { name: 'Dietas',       description: 'Alimentación y viáticos del personal', icon: 'utensils' },
    { name: 'Licitacion',   description: 'Gastos generados en la realización de licitaciones', icon: 'file-text' },
    { name: 'Otros',        description: 'Gastos varios no clasificados', icon: 'more-horizontal' },
  ];

  for (const cat of systemCategories) {
    await prisma.expenseCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: { ...cat, isSystem: true, isActive: true },
    });
  }
  console.log(`Categorías creadas: ${systemCategories.map((c) => c.name).join(', ')}`);

  // ----------------------------------------------------------------
  // 4. PROYECTO DE EJEMPLO
  // ----------------------------------------------------------------
  const sampleProject = await prisma.project.upsert({
    where: { code: 'DEMO-2026-001' },
    update: {},
    create: {
      code: 'DEMO-2026-001',
      name: 'Proyecto de Demostración',
      client: 'Cliente Ejemplo S.A.',
      location: 'Santo Domingo, RD',
      startDate: new Date('2026-01-01'),
      estimatedBudget: 500000,
      status: 'ACTIVE',
      notes: 'Proyecto creado automáticamente para demostración del sistema.',
      createdById: adminUser.id,
    },
  });
  console.log(`Proyecto demo creado: ${sampleProject.code}`);

  console.log('\nSeed completado exitosamente.');
  console.log('Accede al sistema en: http://localhost:3001');
  console.log('Prisma Studio en: http://localhost:5555 (ejecuta: pnpm db:studio)');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
