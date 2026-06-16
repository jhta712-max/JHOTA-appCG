-- Soft delete: add deleted_at to all key business entities
ALTER TABLE "expenses"            ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "payment_orders"      ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "suppliers"           ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "projects"            ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "users"               ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "payrolls"            ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "quotations"          ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "contratos_ajustados" ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "office_expenses"     ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "batches"             ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "supplier_credit_lines" ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- Indexes for efficient filtering of non-deleted records
CREATE INDEX "expenses_deleted_at_idx"              ON "expenses"("deleted_at")              WHERE "deleted_at" IS NULL;
CREATE INDEX "payment_orders_deleted_at_idx"        ON "payment_orders"("deleted_at")        WHERE "payment_orders"."deleted_at" IS NULL;
CREATE INDEX "suppliers_deleted_at_idx"             ON "suppliers"("deleted_at")             WHERE "deleted_at" IS NULL;
CREATE INDEX "projects_deleted_at_idx"              ON "projects"("deleted_at")              WHERE "deleted_at" IS NULL;
CREATE INDEX "users_deleted_at_idx"                 ON "users"("deleted_at")                 WHERE "deleted_at" IS NULL;
CREATE INDEX "payrolls_deleted_at_idx"              ON "payrolls"("deleted_at")              WHERE "payrolls"."deleted_at" IS NULL;
CREATE INDEX "quotations_deleted_at_idx"            ON "quotations"("deleted_at")            WHERE "deleted_at" IS NULL;
CREATE INDEX "contratos_ajustados_deleted_at_idx"   ON "contratos_ajustados"("deleted_at")   WHERE "deleted_at" IS NULL;
CREATE INDEX "office_expenses_deleted_at_idx"       ON "office_expenses"("deleted_at")       WHERE "deleted_at" IS NULL;
CREATE INDEX "batches_deleted_at_idx"               ON "batches"("deleted_at")               WHERE "deleted_at" IS NULL;
CREATE INDEX "supplier_credit_lines_deleted_at_idx" ON "supplier_credit_lines"("deleted_at") WHERE "supplier_credit_lines"."deleted_at" IS NULL;
