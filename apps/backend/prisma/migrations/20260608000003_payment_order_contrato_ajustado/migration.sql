-- Add contrato_ajustado_id to payment_orders
ALTER TABLE "payment_orders" ADD COLUMN "contrato_ajustado_id" UUID;

ALTER TABLE "payment_orders"
  ADD CONSTRAINT "payment_orders_contrato_ajustado_id_fkey"
  FOREIGN KEY ("contrato_ajustado_id")
  REFERENCES "contratos_ajustados"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "payment_orders_contrato_ajustado_id_idx" ON "payment_orders"("contrato_ajustado_id");
