-- CreateEnum
CREATE TYPE "payroll_status" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "payroll_type" AS ENUM ('LABOR', 'SERVICE');

-- CreateTable
CREATE TABLE "payrolls" (
    "id"           UUID         NOT NULL,
    "project_id"   UUID         NOT NULL,
    "number"       INTEGER      NOT NULL,
    "period_start" DATE         NOT NULL,
    "period_end"   DATE         NOT NULL,
    "type"         "payroll_type"   NOT NULL DEFAULT 'LABOR',
    "status"       "payroll_status" NOT NULL DEFAULT 'DRAFT',
    "description"  TEXT         NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes"        TEXT,
    "created_by"   UUID         NOT NULL,
    "approved_by"  UUID,
    "approved_at"  TIMESTAMP(3),
    "paid_at"      TIMESTAMP(3),
    "voided_at"    TIMESTAMP(3),
    "voided_by"    UUID,
    "void_reason"  TEXT,
    "expense_id"   UUID,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_lines" (
    "id"          UUID         NOT NULL,
    "payroll_id"  UUID         NOT NULL,
    "line_number" INTEGER      NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "quantity"    DECIMAL(10,3) NOT NULL,
    "unit"        VARCHAR(30)  NOT NULL,
    "unit_price"  DECIMAL(15,2) NOT NULL,
    "subtotal"    DECIMAL(15,2) NOT NULL,
    "notes"       VARCHAR(300),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payrolls_expense_id_key" ON "payrolls"("expense_id");
CREATE UNIQUE INDEX "payrolls_project_id_number_key" ON "payrolls"("project_id", "number");
CREATE INDEX "payrolls_project_id_idx" ON "payrolls"("project_id");
CREATE INDEX "payrolls_status_idx" ON "payrolls"("status");
CREATE INDEX "payrolls_period_start_idx" ON "payrolls"("period_start");

CREATE UNIQUE INDEX "payroll_lines_payroll_id_line_number_key" ON "payroll_lines"("payroll_id", "line_number");
CREATE INDEX "payroll_lines_payroll_id_idx" ON "payroll_lines"("payroll_id");

-- AddForeignKey
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_voided_by_fkey"
    FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_expense_id_fkey"
    FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_payroll_id_fkey"
    FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
