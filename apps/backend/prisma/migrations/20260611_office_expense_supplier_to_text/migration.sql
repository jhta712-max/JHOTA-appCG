-- Drop FK relation and index, replace supplierId with supplierName text field
ALTER TABLE "office_expenses" DROP CONSTRAINT IF EXISTS "office_expenses_supplier_id_fkey";
DROP INDEX IF EXISTS "office_expenses_supplier_id_idx";
ALTER TABLE "office_expenses" ADD COLUMN IF NOT EXISTS "supplier_name" VARCHAR(200);
ALTER TABLE "office_expenses" DROP COLUMN IF EXISTS "supplier_id";
