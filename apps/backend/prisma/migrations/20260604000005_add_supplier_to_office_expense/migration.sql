-- Add supplierId to office_expenses
ALTER TABLE "office_expenses" ADD COLUMN "supplier_id" UUID;
ALTER TABLE "office_expenses" ADD CONSTRAINT "office_expenses_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "office_expenses_supplier_id_idx" ON "office_expenses"("supplier_id");
