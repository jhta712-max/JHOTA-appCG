-- Suplidor opcional en gastos (selección manual, activada por checkbox en el formulario)
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "supplier_id" UUID;

CREATE INDEX IF NOT EXISTS "expenses_supplier_id_idx" ON "expenses"("supplier_id");

DO $$ BEGIN
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
