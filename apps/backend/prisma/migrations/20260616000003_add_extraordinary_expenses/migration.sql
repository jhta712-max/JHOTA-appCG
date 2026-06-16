-- CreateEnum
CREATE TYPE "ExtraordinaryExpenseCategory" AS ENUM ('COMISION', 'PRESTAMO', 'IMPUESTO', 'MULTA', 'OTRO');

-- CreateTable
CREATE TABLE "project_extraordinary_expenses" (
    "id"          UUID NOT NULL,
    "project_id"  UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount"      DECIMAL(15,2) NOT NULL,
    "date"        DATE NOT NULL,
    "category"    "ExtraordinaryExpenseCategory" NOT NULL,
    "notes"       TEXT,
    "created_by"  UUID NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_extraordinary_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_extraordinary_expenses_project_id_idx" ON "project_extraordinary_expenses"("project_id");

-- AddForeignKey
ALTER TABLE "project_extraordinary_expenses"
    ADD CONSTRAINT "project_extraordinary_expenses_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
