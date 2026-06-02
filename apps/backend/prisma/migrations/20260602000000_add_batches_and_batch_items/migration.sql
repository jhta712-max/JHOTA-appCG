-- AlterTable
ALTER TABLE "projects" ADD COLUMN "batches_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "total_budget" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_items" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "provincia" VARCHAR(100) NOT NULL,
    "sector" VARCHAR(200) NOT NULL,
    "budget" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN "batch_item_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "batches_project_id_code_key" ON "batches"("project_id", "code");

-- CreateIndex
CREATE INDEX "batches_project_id_idx" ON "batches"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "batch_items_batch_id_code_key" ON "batch_items"("batch_id", "code");

-- CreateIndex
CREATE INDEX "batch_items_batch_id_idx" ON "batch_items"("batch_id");

-- CreateIndex
CREATE INDEX "expenses_batch_item_id_idx" ON "expenses"("batch_item_id");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_batch_item_id_fkey" FOREIGN KEY ("batch_item_id") REFERENCES "batch_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
