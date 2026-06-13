-- CreateTable
CREATE TABLE "project_items" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_items_project_id_idx" ON "project_items"("project_id");
CREATE UNIQUE INDEX "project_items_project_id_number_key" ON "project_items"("project_id", "number");

-- AddForeignKey
ALTER TABLE "project_items" ADD CONSTRAINT "project_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: expenses
ALTER TABLE "expenses" ADD COLUMN "project_item_id" UUID;
CREATE INDEX "expenses_project_item_id_idx" ON "expenses"("project_item_id");
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_item_id_fkey" FOREIGN KEY ("project_item_id") REFERENCES "project_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: payment_orders
ALTER TABLE "payment_orders" ADD COLUMN "project_item_id" UUID;
CREATE INDEX "payment_orders_project_item_id_idx" ON "payment_orders"("project_item_id");
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_project_item_id_fkey" FOREIGN KEY ("project_item_id") REFERENCES "project_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: payrolls
ALTER TABLE "payrolls" ADD COLUMN "project_item_id" UUID;
CREATE INDEX "payrolls_project_item_id_idx" ON "payrolls"("project_item_id");
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_project_item_id_fkey" FOREIGN KEY ("project_item_id") REFERENCES "project_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: quotations
ALTER TABLE "quotations" ADD COLUMN "project_item_id" UUID;
CREATE INDEX "quotations_project_item_id_idx" ON "quotations"("project_item_id");
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_project_item_id_fkey" FOREIGN KEY ("project_item_id") REFERENCES "project_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
