-- Modalidad de contrato ajustado: MONTO_FIJO (actual) o PRECIO_UNITARIO (precio por unidad sin volumetría fija)
DO $$ BEGIN
  CREATE TYPE "contrato_modalidad" AS ENUM ('MONTO_FIJO', 'PRECIO_UNITARIO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "contratos_ajustados"
  ADD COLUMN IF NOT EXISTS "modalidad" "contrato_modalidad" NOT NULL DEFAULT 'MONTO_FIJO',
  ADD COLUMN IF NOT EXISTS "precio_unitario" DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS "unidad" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "cantidad_estimada" DECIMAL(15, 3);
