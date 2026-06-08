-- Link payment orders to quotations (optional, for SERVICIO orders)
ALTER TABLE "payment_orders" ADD COLUMN "quotation_id" UUID;
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_quotation_id_fkey"
  FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "payment_orders_quotation_id_idx" ON "payment_orders"("quotation_id");
