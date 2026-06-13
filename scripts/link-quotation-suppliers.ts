/**
 * One-time script: links existing quotations to supplier records
 * by matching supplierName (normalized) against the suppliers catalog.
 *
 * Run: pnpm --filter backend exec tsx ../../scripts/link-quotation-suppliers.ts
 *
 * Output: prints each match/miss so you can review before committing.
 * Add --dry-run flag to preview without writing to DB.
 */

import prisma from '../apps/backend/src/config/database';

const DRY_RUN = process.argv.includes('--dry-run');

function normalize(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove accents
    .replace(/[.,\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log(DRY_RUN ? '--- DRY RUN (no DB writes) ---\n' : '--- LIVE MODE ---\n');

  const [quotations, suppliers] = await Promise.all([
    prisma.quotation.findMany({
      where:  { supplierId: null },
      select: { id: true, supplierName: true, number: true, projectId: true },
    }),
    prisma.supplier.findMany({
      select: { id: true, name: true, rnc: true },
    }),
  ]);

  console.log(`Cotizaciones sin supplierId: ${quotations.length}`);
  console.log(`Suplidores en catálogo:     ${suppliers.length}\n`);

  // Build normalized supplier index
  const supplierIndex = suppliers.map((s) => ({ ...s, norm: normalize(s.name) }));

  let matched = 0;
  let unmatched = 0;

  for (const q of quotations) {
    const qNorm = normalize(q.supplierName);

    // 1. Exact normalized match
    let found = supplierIndex.find((s) => s.norm === qNorm);

    // 2. Partial: quotation name contains supplier name or vice versa
    if (!found) {
      found = supplierIndex.find(
        (s) => qNorm.includes(s.norm) || s.norm.includes(qNorm),
      );
    }

    if (found) {
      console.log(`✅ COTI-${String(q.number).padStart(3,'0')} "${q.supplierName}" → "${found.name}" (${found.id})`);
      if (!DRY_RUN) {
        await prisma.quotation.update({
          where: { id: q.id },
          data:  { supplierId: found.id },
        });
      }
      matched++;
    } else {
      console.log(`❌ COTI-${String(q.number).padStart(3,'0')} "${q.supplierName}" → sin match`);
      unmatched++;
    }
  }

  console.log(`\nResumen: ${matched} vinculadas, ${unmatched} sin match`);

  if (unmatched > 0) {
    console.log('\nPara las cotizaciones sin match, edítalas manualmente desde');
    console.log('el formulario de cotización y selecciona el suplidor del catálogo.');
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
