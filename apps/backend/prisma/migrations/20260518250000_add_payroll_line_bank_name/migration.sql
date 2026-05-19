-- Add bank_name to payroll_lines
ALTER TABLE "payroll_lines"
  ADD COLUMN "bank_name" VARCHAR(100);
