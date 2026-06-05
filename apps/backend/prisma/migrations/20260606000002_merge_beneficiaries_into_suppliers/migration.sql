-- Migration: Merge beneficiaries into suppliers
-- Beneficiaries and suppliers are unified into a single table.
-- PaymentOrder.beneficiary_id → supplier_id (FK to suppliers)

-- 1. Add bank/payment fields to suppliers (all optional)
ALTER TABLE "suppliers" ADD COLUMN "cedula" VARCHAR(20);
ALTER TABLE "suppliers" ADD COLUMN "bank" VARCHAR(100);
ALTER TABLE "suppliers" ADD COLUMN "account_type" VARCHAR(30);
ALTER TABLE "suppliers" ADD COLUMN "account_number" VARCHAR(50);

-- 2. Copy bank data from beneficiaries that already link to a supplier
UPDATE "suppliers" s
SET
  bank           = b.bank,
  account_type   = b.account_type,
  account_number = b.account_number,
  cedula         = COALESCE(b.cedula, s.cedula)
FROM "beneficiaries" b
WHERE b.supplier_id = s.id
  AND EXISTS (SELECT 1 FROM "payment_orders" po WHERE po.beneficiary_id = b.id);

-- 3. Add supplier_id to payment_orders (nullable initially for data migration)
ALTER TABLE "payment_orders" ADD COLUMN "supplier_id" UUID;
ALTER TABLE "payment_orders"
  ADD CONSTRAINT "payment_orders_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");

-- 4. Point payment_orders to their beneficiary's linked supplier
UPDATE "payment_orders" po
SET supplier_id = b.supplier_id
FROM "beneficiaries" b
WHERE po.beneficiary_id = b.id
  AND b.supplier_id IS NOT NULL;

-- 5. For orphan beneficiaries (no supplier_id): create a new supplier per beneficiary
CREATE TEMP TABLE _bene_map AS
SELECT
  b.id              AS beneficiary_id,
  gen_random_uuid() AS new_supplier_id
FROM "beneficiaries" b
WHERE b.supplier_id IS NULL
  AND EXISTS (SELECT 1 FROM "payment_orders" po WHERE po.beneficiary_id = b.id);

INSERT INTO "suppliers" (id, name, phone, cedula, bank, account_type, account_number,
                         is_active, created_by, created_at, updated_at)
SELECT
  m.new_supplier_id,
  b.name,
  b.phone,
  b.cedula,
  b.bank,
  b.account_type,
  b.account_number,
  b.is_active,
  b.created_by_id,
  b.created_at,
  b.updated_at
FROM _bene_map m
JOIN "beneficiaries" b ON b.id = m.beneficiary_id;

UPDATE "payment_orders" po
SET supplier_id = m.new_supplier_id
FROM _bene_map m
WHERE po.beneficiary_id = m.beneficiary_id;

-- 6. Enforce NOT NULL (all rows should now have a supplier)
ALTER TABLE "payment_orders" ALTER COLUMN "supplier_id" SET NOT NULL;

-- 7. Remove old beneficiary_id column
DROP INDEX IF EXISTS "payment_orders_beneficiary_id_idx";
ALTER TABLE "payment_orders" DROP CONSTRAINT IF EXISTS "payment_orders_beneficiary_id_fkey";
ALTER TABLE "payment_orders" DROP COLUMN "beneficiary_id";

-- 8. Add index for the new column
CREATE INDEX "payment_orders_supplier_id_idx" ON "payment_orders"("supplier_id");

-- 9. Drop the beneficiaries table
DROP TABLE "beneficiaries";
