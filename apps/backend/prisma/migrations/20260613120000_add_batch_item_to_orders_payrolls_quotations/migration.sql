-- Add batch_item_id to payment_orders
ALTER TABLE "payment_orders" ADD COLUMN "batch_item_id" UUID;
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_batch_item_id_fkey" FOREIGN KEY ("batch_item_id") REFERENCES "batch_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "payment_orders_batch_item_id_idx" ON "payment_orders"("batch_item_id");

-- Add batch_item_id to payrolls
ALTER TABLE "payrolls" ADD COLUMN "batch_item_id" UUID;
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_batch_item_id_fkey" FOREIGN KEY ("batch_item_id") REFERENCES "batch_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "payrolls_batch_item_id_idx" ON "payrolls"("batch_item_id");

-- Add batch_item_id to quotations
ALTER TABLE "quotations" ADD COLUMN "batch_item_id" UUID;
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_batch_item_id_fkey" FOREIGN KEY ("batch_item_id") REFERENCES "batch_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "quotations_batch_item_id_idx" ON "quotations"("batch_item_id");
