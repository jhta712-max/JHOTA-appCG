-- Make projectId and supplierId nullable
ALTER TABLE "payment_orders" ALTER COLUMN "project_id" DROP NOT NULL;
ALTER TABLE "payment_orders" ALTER COLUMN "supplier_id" DROP NOT NULL;

-- Add new office fields
ALTER TABLE "payment_orders"
  ADD COLUMN IF NOT EXISTS "office_expense_category" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "office_supplier_name" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "office_expense_id" TEXT;
