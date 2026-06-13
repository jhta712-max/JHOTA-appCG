ALTER TABLE "quotations" ADD COLUMN "supplier_id" UUID;
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "quotations_supplier_id_idx" ON "quotations"("supplier_id");
