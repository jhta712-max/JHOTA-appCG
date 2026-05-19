/**
 * Script temporal para crear usuarios de prueba
 * Ejecutar: pnpm tsx create-test-users.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔧 Creando usuarios de prueba...\n');

  // Verificar que existan los roles
  const supervisorRole = await prisma.role.findUnique({ where: { name: 'supervisor' } });
  const operatorRole   = await prisma.role.findUnique({ where: { name: 'operator' } });

  if (!supervisorRole || !operatorRole) {
    console.error('❌ Roles no encontrados. Ejecuta el seed primero: pnpm db:seed');
    process.exit(1);
  }

  const hashSup = await bcrypt.hash('Super@2026!', 12);
  const hashOp  = await bcrypt.hash('Oper@2026!',  12);

  // ── Supervisor ────────────────────────────────────────────────
  const supervisor = await prisma.user.upsert({
    where:  { email: 'supervisor@gastos.local' },
    update: { password: hashSup, isActive: true, name: 'Supervisor Demo' },
    create: {
      roleId:   supervisorRole.id,
      name:     'Supervisor Demo',
      email:    'supervisor@gastos.local',
      password: hashSup,
      isActive: true,
    },
  });

  // ── Operador ──────────────────────────────────────────────────
  const operador = await prisma.user.upsert({
    where:  { email: 'operador@gastos.local' },
    update: { password: hashOp, isActive: true, name: 'Operador Demo' },
    create: {
      roleId:   operatorRole.id,
      name:     'Operador Demo',
      email:    'operador@gastos.local',
      password: hashOp,
      isActive: true,
    },
  });

  console.log('✅ Usuarios creados/actualizados:\n');
  console.log(`  Rol: supervisor`);
  console.log(`    Email:      ${supervisor.email}`);
  console.log(`    Contraseña: Super@2026!\n`);
  console.log(`  Rol: operador`);
  console.log(`    Email:      ${operador.email}`);
  console.log(`    Contraseña: Oper@2026!\n`);
  console.log('⚠️  Cambia estas contraseñas después de la prueba.');
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
