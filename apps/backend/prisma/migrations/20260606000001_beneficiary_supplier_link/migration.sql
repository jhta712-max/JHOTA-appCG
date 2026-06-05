ALTER TABLE "beneficiaries" ADD COLUMN "supplier_id" UUID;

ALTER TABLE "beneficiaries"
  ADD CONSTRAINT "beneficiaries_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "beneficiaries_supplier_id_idx" ON "beneficiaries"("supplier_id");
