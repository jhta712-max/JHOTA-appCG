-- Add credit_line_id column to payment_orders.
-- FK constraint is deferred to 20260615000003_add_credit_lines because
-- supplier_credit_lines is created there (alphabetically later).
ALTER TABLE "payment_orders" ADD COLUMN IF NOT EXISTS "credit_line_id" UUID;
CREATE INDEX IF NOT EXISTS "payment_orders_credit_line_id_idx" ON "payment_orders"("credit_line_id");
