-- CreateTable supplier_credit_lines
CREATE TABLE "supplier_credit_lines" (
    "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id"  UUID          NOT NULL,
    "credit_limit" DECIMAL(15,2) NOT NULL,
    "notes"        TEXT,
    "is_active"    BOOLEAN       NOT NULL DEFAULT true,
    "created_by"   UUID          NOT NULL,
    "created_at"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "supplier_credit_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable supplier_credit_payments
CREATE TABLE "supplier_credit_payments" (
    "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
    "credit_line_id" UUID          NOT NULL,
    "amount"         DECIMAL(15,2) NOT NULL,
    "payment_date"   DATE          NOT NULL,
    "payment_method" "payment_method" NOT NULL,
    "reference"      VARCHAR(100),
    "notes"          TEXT,
    "created_by"     UUID          NOT NULL,
    "created_at"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_credit_payments_pkey" PRIMARY KEY ("id")
);

-- AlterTable expenses: add credit_line_id
ALTER TABLE "expenses" ADD COLUMN "credit_line_id" UUID;

-- AddForeignKey
ALTER TABLE "supplier_credit_lines" ADD CONSTRAINT "supplier_credit_lines_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_credit_lines" ADD CONSTRAINT "supplier_credit_lines_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_credit_payments" ADD CONSTRAINT "supplier_credit_payments_credit_line_id_fkey"
    FOREIGN KEY ("credit_line_id") REFERENCES "supplier_credit_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_credit_payments" ADD CONSTRAINT "supplier_credit_payments_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_credit_line_id_fkey"
    FOREIGN KEY ("credit_line_id") REFERENCES "supplier_credit_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "supplier_credit_lines_supplier_id_idx" ON "supplier_credit_lines"("supplier_id");
CREATE INDEX IF NOT EXISTS "supplier_credit_payments_credit_line_id_idx" ON "supplier_credit_payments"("credit_line_id");
CREATE INDEX IF NOT EXISTS "expenses_credit_line_id_idx" ON "expenses"("credit_line_id");

-- FK for payment_orders.credit_line_id (column added in 20260615000002, table only exists here)
DO $$ BEGIN
  ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_credit_line_id_fkey"
    FOREIGN KEY ("credit_line_id") REFERENCES "supplier_credit_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
