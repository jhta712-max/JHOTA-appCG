-- CreateEnum
CREATE TYPE "ExtraordinaryExpenseCategory" AS ENUM ('COMISION', 'PRESTAMO', 'IMPUESTO', 'MULTA', 'OTRO');

-- CreateTable
CREATE TABLE "project_extraordinary_expenses" (
    "id"          TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount"      DECIMAL(15,2) NOT NULL,
    "date"        DATE NOT NULL,
    "category"    "ExtraordinaryExpenseCategory" NOT NULL,
    "notes"       TEXT,
    "createdBy"   TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_extraordinary_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_extraordinary_expenses_projectId_idx" ON "project_extraordinary_expenses"("projectId");

-- AddForeignKey
ALTER TABLE "project_extraordinary_expenses"
    ADD CONSTRAINT "project_extraordinary_expenses_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
