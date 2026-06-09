-- Migration: Move expense tracking from Payroll level to PayrollLine level
-- Each payroll line gets its own expense record instead of one global one.

-- 1. Add expense_id to payroll_lines
ALTER TABLE "payroll_lines" ADD COLUMN "expense_id" UUID;
ALTER TABLE "payroll_lines"
  ADD CONSTRAINT "payroll_lines_expense_id_fkey"
  FOREIGN KEY ("expense_id") REFERENCES "expenses"("id")
  ON DELETE SET NULL;

-- 2. Migrate existing payroll-level expenses to the first line of each payroll
--    (best-effort — existing data will have expense on line 1)
UPDATE "payroll_lines" pl
SET expense_id = p.expense_id
FROM "payrolls" p
WHERE pl.payroll_id = p.id
  AND p.expense_id IS NOT NULL
  AND pl.line_number = (
    SELECT MIN(line_number) FROM "payroll_lines" WHERE payroll_id = p.id
  );

-- 3. Remove expense_id from payrolls (drop FK first, then column)
ALTER TABLE "payrolls" DROP CONSTRAINT IF EXISTS "payrolls_expense_id_fkey";
ALTER TABLE "payrolls" DROP COLUMN IF EXISTS "expense_id";

-- 4. Index for the new FK
CREATE INDEX "payroll_lines_expense_id_idx" ON "payroll_lines"("expense_id");
