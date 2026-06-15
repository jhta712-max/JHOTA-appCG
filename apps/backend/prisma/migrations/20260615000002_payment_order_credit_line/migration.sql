-- AlterTable
ALTER TABLE "payment_orders" ADD COLUMN "credit_line_id" UUID;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_credit_line_id_fkey"
  FOREIGN KEY ("credit_line_id") REFERENCES "supplier_credit_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "payment_orders_credit_line_id_idx" ON "payment_orders"("credit_line_id");
